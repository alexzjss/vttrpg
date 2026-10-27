import type { Id, InitiativeEntry, ProjectedState } from '@vtt/core';
import { useState } from 'react';
import type { Send } from './types';

interface Props {
  state: ProjectedState;
  send: Send;
}

export function EncounterPanel({ state, send }: Props) {
  const [picked, setPicked] = useState<Record<Id, boolean>>({});
  const [init, setInit] = useState<Record<Id, string>>({});
  const tokens = Object.values(state.scene.tokens);
  const nameOf = (tokenId: Id) => {
    const token = state.scene.tokens[tokenId];
    return (token && state.characters[token.characterId]?.name) ?? '?';
  };

  if (state.encounter.active) {
    const { order, currentTokenId, round } = state.encounter;
    const move = (i: number, dir: -1 | 1) => {
      const ids = order.map((e) => e.tokenId);
      [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
      void send({ type: 'reorderInitiative', order: ids });
    };
    return (
      <section className="encounter-panel">
        <h3>Rodada {round}</h3>
        <ol className="initiative-list">
          {order.map((e, i) => (
            <li key={e.tokenId} className={e.tokenId === currentTokenId ? 'current' : undefined}
              aria-current={e.tokenId === currentTokenId ? 'true' : undefined}>
              <span>{nameOf(e.tokenId)} ({e.initiative})</span>
              <button type="button" aria-label={`Subir ${nameOf(e.tokenId)}`} disabled={i === 0}
                onClick={() => move(i, -1)}>↑</button>
              <button type="button" aria-label={`Descer ${nameOf(e.tokenId)}`} disabled={i === order.length - 1}
                onClick={() => move(i, 1)}>↓</button>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => void send({ type: 'nextTurn' })}>Próximo turno</button>
        <button type="button" onClick={() => void send({ type: 'endEncounter' })}>Encerrar combate</button>
      </section>
    );
  }

  const chosen = tokens.filter((t) => picked[t.id]);
  const start = () => {
    const entries: InitiativeEntry[] = chosen.map((t) => ({
      tokenId: t.id,
      initiative: Number(init[t.id]) || 0,
    }));
    void send({ type: 'startEncounter', entries });
  };
  // Provisório até a fase 3: 1d20 + velocidade, rolado localmente.
  const roll = (tokenId: Id, speed: number) =>
    setInit((prev) => ({ ...prev, [tokenId]: String(Math.floor(Math.random() * 20) + 1 + speed) }));

  return (
    <section className="encounter-panel">
      <h3>Montar combate</h3>
      {tokens.length === 0 && <p className="muted">Nenhum token na cena.</p>}
      <ul className="plain-list">
        {tokens.map((t) => {
          const c = state.characters[t.characterId];
          const name = c?.name ?? '?';
          return (
            <li key={t.id} className="initiative-row">
              <label>
                <input type="checkbox" checked={!!picked[t.id]}
                  onChange={(e) => setPicked((prev) => ({ ...prev, [t.id]: e.target.checked }))} />
                {name}
              </label>
              <input type="number" aria-label={`Iniciativa de ${name}`} value={init[t.id] ?? ''}
                onChange={(e) => setInit((prev) => ({ ...prev, [t.id]: e.target.value }))} />
              <button type="button" aria-label={`Rolar iniciativa de ${name}`}
                onClick={() => roll(t.id, c?.speed ?? 0)}>Rolar</button>
            </li>
          );
        })}
      </ul>
      <button type="button" disabled={chosen.length === 0} onClick={start}>Iniciar combate</button>
    </section>
  );
}
