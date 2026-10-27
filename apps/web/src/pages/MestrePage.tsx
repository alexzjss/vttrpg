import type { Id } from '@vtt/core';
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ResetCampaignButton } from '../components/ResetCampaignButton';
import { ErrorToast, type Notice } from '../components/ErrorToast';
import { CharacterForm } from '../gm/CharacterForm';
import { CharacterList } from '../gm/CharacterList';
import { EncounterPanel } from '../gm/EncounterPanel';
import { ScenePanel } from '../gm/ScenePanel';
import { TokenPanel } from '../gm/TokenPanel';
import type { Send } from '../gm/types';
import '../gm/gm.css';
import { errorMessage } from '../i18n/errors';
import { clearSession, openTableWindow } from '../session/session';
import { useGame } from '../store/gameStore';
import { Tabletop } from '../tabletop/Tabletop';
import { defaultTheme } from '../theme/themes';

type Tab = 'personagens' | 'cena' | 'encontro';
const TABS: Array<[Tab, string]> = [
  ['personagens', 'Personagens'],
  ['cena', 'Cena'],
  ['encontro', 'Encontro'],
];

export function MestrePage() {
  const state = useGame((s) => s.state);
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('personagens');
  const [editing, setEditing] = useState<Id | 'new' | null>(null);
  const [selected, setSelected] = useState<Id | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const counter = useRef(0);

  // Cada falha ganha um id novo, então o mesmo código de erro reaparece no toast.
  const send: Send = useCallback(async (cmd) => {
    const result = await useGame.getState().send(cmd);
    if (!result.ok) setNotice({ id: ++counter.current, text: errorMessage(result.error) });
    return result;
  }, []);
  const dismiss = useCallback(() => setNotice(null), []);

  if (!state) return null;
  const editingCharacter = editing && editing !== 'new' ? state.characters[editing] : undefined;

  return (
    <div className="gm-page">
      <header className="gm-header">
        <h1>{state.name}</h1>
        <div className="gm-header-actions">
          <button type="button" onClick={openTableWindow}>Abrir a mesa</button>
          <ResetCampaignButton />
          <button type="button" onClick={() => { clearSession(); navigate('/login'); }}>Sair</button>
        </div>
      </header>

      <aside className="gm-left">
        <div role="tablist" className="gm-tabs">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id}
              onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        {tab === 'personagens' && (editing === 'new' || editingCharacter ? (
          <CharacterForm key={editing} character={editingCharacter} send={send} onDone={() => setEditing(null)} />
        ) : (
          <CharacterList state={state} send={send} onNew={() => setEditing('new')} onEdit={setEditing} />
        ))}
        {tab === 'cena' && <ScenePanel state={state} send={send} />}
        {tab === 'encontro' && <EncounterPanel state={state} send={send} />}
      </aside>

      <main className="gm-center">
        <Tabletop
          state={state}
          theme={defaultTheme}
          gmView
          canDrag={() => true}
          onTokenDrop={(tokenId, to) => void send({ type: 'moveToken', tokenId, to })}
          onTokenSelect={setSelected}
        />
      </main>

      <aside className="gm-right">
        <TokenPanel state={state} tokenId={selected} send={send} />
      </aside>

      <ErrorToast notice={notice} onDismiss={dismiss} />
    </div>
  );
}
