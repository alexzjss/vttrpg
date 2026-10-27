import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useGame } from '../store/gameStore';
import { createTransport, type Transport } from '../net/transport';
import { clearSession, getSession } from '../session/session';

interface Props {
  children: ReactNode;
  transportFactory?: () => Transport;
}

type Phase = 'connecting' | 'ready' | 'failed';

/**
 * Conecta a store com a sessão atual enquanto esta montagem existir. Filhos só
 * aparecem quando esta montagem concluiu a própria conexão, então um estado de
 * uma sessão anterior nunca é renderizado. Ao desmontar, solta a store e fecha
 * o transporte. Em StrictMode o efeito roda duas vezes: a primeira conexão é
 * descartada pelo cleanup antes da segunda.
 */
export function GameProvider({ children, transportFactory = createTransport }: Props) {
  const status = useGame((s) => s.status);
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('connecting');

  useEffect(() => {
    const session = getSession();
    if (!session) return;
    setPhase('connecting');
    let transport: Transport;
    try {
      transport = transportFactory();
    } catch {
      setPhase('failed');
      return;
    }
    let cancelled = false;
    void useGame
      .getState()
      .connect(transport, session)
      .then(() => {
        if (!cancelled) setPhase(useGame.getState().status === 'ready' ? 'ready' : 'failed');
      });
    return () => {
      cancelled = true;
      useGame.getState().disconnect();
      transport.close();
    };
  }, [transportFactory]);

  if (phase === 'failed' || (phase === 'ready' && status === 'error')) {
    return (
      <div>
        <p role="alert">Não foi possível conectar à mesa.</p>
        <button
          type="button"
          onClick={() => {
            clearSession();
            navigate('/login');
          }}
        >
          Voltar ao login
        </button>
      </div>
    );
  }
  if (phase !== 'ready' || status !== 'ready') return <p>Conectando…</p>;
  return <>{children}</>;
}
