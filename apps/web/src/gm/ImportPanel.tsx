import { parseLegacyBackup, type LegacyCharacterDraft } from '@vtt/core';
import { useState, type ChangeEvent } from 'react';
import { useImageSink } from '../net/ImageSinkContext';
import { importCharacters, type ImportSummary } from './importCharacters';
import type { Send } from './types';

interface Props {
  send: Send;
  onDone(): void;
}

type Kind = LegacyCharacterDraft['input']['kind'];
interface Row { draft: LegacyCharacterDraft; checked: boolean; kind: Kind }

const NOT_RECOGNIZED = 'Arquivo não reconhecido como backup do app antigo.';
const UNSUPPORTED = 'Versão do backup não suportada.';

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function ImportPanel({ send, onDone }: Props) {
  const sink = useImageSink();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSummary(null);
    let json: unknown;
    try {
      json = JSON.parse(await readText(file));
    } catch {
      setRows(null);
      return setError(NOT_RECOGNIZED);
    }
    const parsed = parseLegacyBackup(json);
    if (!parsed.ok) {
      setRows(null);
      return setError(parsed.error === 'unsupported_version' ? UNSUPPORTED : NOT_RECOGNIZED);
    }
    setError(null);
    setRows(parsed.characters.map((draft) => ({ draft, checked: true, kind: draft.input.kind })));
  };

  const patch = (i: number, change: Partial<Row>) =>
    setRows((prev) => prev && prev.map((r, idx) => (idx === i ? { ...r, ...change } : r)));

  const selected = rows?.filter((r) => r.checked) ?? [];

  const run = async () => {
    if (busy || selected.length === 0) return;
    setBusy(true);
    try {
      const drafts = selected.map(({ draft, kind }) => ({
        ...draft,
        input: {
          ...draft.input,
          kind,
          hpVisibility: kind === 'pc' ? ('exact' as const)
            : draft.input.kind === 'npc' ? draft.input.hpVisibility : ('band' as const),
        },
      }));
      setSummary(await importCharacters(drafts, { sink, send }));
      setRows(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="import-panel">
      <h3>Importar do legado</h3>
      {!summary && (
        <label>
          Arquivo de backup (.json)
          <input type="file" accept=".json,application/json" onChange={(e) => void onFile(e)} />
        </label>
      )}
      {error && <p role="alert" className="local-error">{error}</p>}
      {rows && (
        <>
          {rows.length === 0 && <p className="muted">O backup não tem personagens.</p>}
          <ul className="plain-list">
            {rows.map((r, i) => (
              <li key={r.draft.legacyId} className="character-item">
                <input type="checkbox" checked={r.checked} aria-label={`Importar ${r.draft.input.name}`}
                  onChange={(e) => patch(i, { checked: e.target.checked })} />
                <strong>{r.draft.input.name}</strong>
                <span className="muted">HP {r.draft.input.resources.hp.current}/{r.draft.input.resources.hp.max}</span>
                <select value={r.kind} aria-label={`Tipo de ${r.draft.input.name}`}
                  onChange={(e) => patch(i, { kind: e.target.value as Kind })}>
                  <option value="pc">Jogador</option>
                  <option value="npc">NPC</option>
                </select>
              </li>
            ))}
          </ul>
          <button type="button" disabled={busy || selected.length === 0} onClick={() => void run()}>
            {busy ? 'Importando…' : `Importar ${selected.length} personagens`}
          </button>
        </>
      )}
      {summary && (
        <div role="status">
          <p>{summary.imported} importados; {summary.failed.length} falharam</p>
          {summary.failed.length > 0 && (
            <ul>{summary.failed.map((f, i) => <li key={i}>{f.name}: {f.reason}</li>)}</ul>
          )}
        </div>
      )}
      <button type="button" disabled={busy} onClick={onDone}>{summary ? 'Concluir' : 'Cancelar'}</button>
    </div>
  );
}
