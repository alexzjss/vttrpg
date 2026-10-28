import type { Cell, Id } from '@vtt/core';
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ErrorToast, type Notice } from '../components/ErrorToast';
import { errorMessage } from '../i18n/errors';
import { TurnStrip } from '../mesa/TurnStrip';
import '../mesa/mesa.css';
import { logout } from '../session/logout';
import { getSession } from '../session/session';
import { useGame } from '../store/gameStore';
import { Tabletop } from '../tabletop/Tabletop';
import { defaultTheme } from '../theme/themes';

export function MesaPage() {
  const state = useGame((s) => s.state);
  const navigate = useNavigate();
  const [notice, setNotice] = useState<Notice | null>(null);
  const counter = useRef(0);

  // Cada falha ganha um id novo, então o mesmo código de erro reaparece no toast.
  const move = useCallback(async (tokenId: Id, to: Cell) => {
    const result = await useGame.getState().send({ type: 'moveToken', tokenId, to });
    if (!result.ok) setNotice({ id: ++counter.current, text: errorMessage(result.error) });
  }, []);
  const dismiss = useCallback(() => setNotice(null), []);

  if (!state) return null;
  const session = getSession();
  const isGm = session?.actor.role === 'gm';

  const canDrag = (tokenId: Id): boolean => {
    if (isGm) return true;
    if (session?.actor.role !== 'player') return false;
    const characterId = session.actor.characterId;
    const token = state.scene.tokens[tokenId];
    if (!token || token.characterId !== characterId) return false;
    return !state.encounter.active || state.encounter.currentTokenId === tokenId;
  };

  return (
    <div className="mesa-page">
      <Tabletop
        state={state}
        theme={defaultTheme}
        gmView={isGm}
        canDrag={canDrag}
        onTokenDrop={(tokenId, to) => void move(tokenId, to)}
      />
      <TurnStrip state={state} />
      <button type="button" className="mesa-leave" onClick={() => { void logout(); navigate('/login'); }}>Sair</button>
      <ErrorToast notice={notice} onDismiss={dismiss} />
    </div>
  );
}
