import type { Id } from '@vtt/core';
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ErrorToast, type Notice } from '../components/ErrorToast';
import type { Send } from '../gm/types';
import { errorMessage } from '../i18n/errors';
import { AlliesPanel } from '../player/AlliesPanel';
import { CharacterSheet } from '../player/CharacterSheet';
import { ResourceBar } from '../player/ResourceBar';
import { TurnBanner } from '../player/TurnBanner';
import '../player/player.css';
import { clearSession, getSession, openTableWindow } from '../session/session';
import { useGame } from '../store/gameStore';

export function JogadorPage() {
  const state = useGame((s) => s.state);
  const navigate = useNavigate();
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
  const session = getSession();
  const meId: Id | null = session?.role === 'player' ? session.characterId : null;
  const me = meId ? state.characters[meId] : undefined;

  const leave = () => {
    clearSession();
    navigate('/login');
  };

  return (
    <div className="player-page">
      <header className="player-header">
        <h1>{me?.name ?? state.name}</h1>
        <div className="player-header-actions">
          <button type="button" onClick={openTableWindow}>Abrir a mesa</button>
          <button type="button" onClick={leave}>Sair</button>
        </div>
      </header>

      {me ? (
        <div className="player-body">
          <section className="player-left">
            <CharacterSheet character={me} />
          </section>
          <aside className="player-right">
            {me.resources ? (
              <div className="resource-stack">
                <ResourceBar label="HP" pool={me.resources.hp} />
                <ResourceBar label="Aura" pool={me.resources.aura} />
                {me.resources.ammo.max > 0 && <ResourceBar label="Munição" pool={me.resources.ammo} />}
              </div>
            ) : (
              <p className="muted">Recursos ocultos.</p>
            )}
            <TurnBanner state={state} meId={meId} send={send} />
            <AlliesPanel state={state} meId={meId} />
          </aside>
        </div>
      ) : (
        <main className="player-missing">
          <p role="alert">Seu personagem não está disponível.</p>
        </main>
      )}

      <ErrorToast notice={notice} onDismiss={dismiss} />
    </div>
  );
}
