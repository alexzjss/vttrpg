import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useGame } from '../store/gameStore';
import { createTransport, type Session, type Transport } from '../net/transport';
import { ImageSinkProvider } from '../net/ImageSinkContext';
import { createUploadSink, type ImageSink } from '../net/imageSink';
import { getSupabase } from '../net/supabase';
import { createOnlineUploadApi } from '../net/onlineUploadApi';
import { clearSession, getSession } from '../session/session';
import { SESSION_CHANGED_MESSAGE } from '../net/protocol';
import { LOAD_FAILED_MESSAGE } from '../i18n/errors';
import { ResetCampaignButton } from './ResetCampaignButton';

interface Props {
  children: ReactNode;
  transportFactory?: (session: Session) => Transport;
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
  const loadFailed = useGame((s) => s.loadFailed);
  const sessionChanged = useGame((s) => s.sessionChanged);
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('connecting');
  const [sink] = useState(() => onlineSink(getSession()));

  useEffect(() => {
    const session = getSession();
    if (!session) return;
    setPhase('connecting');
    let transport: Transport;
    try {
      transport = transportFactory(session);
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

  useEffect(() => {
    if (!sessionChanged) return;
    clearSession();
    navigate('/login', { state: { notice: SESSION_CHANGED_MESSAGE } });
  }, [sessionChanged, navigate]);

  if (sessionChanged) return null;
  if (phase === 'failed' || (phase === 'ready' && status === 'error')) {
    return (
      <div>
        <p role="alert">{loadFailed ? LOAD_FAILED_MESSAGE : 'Não foi possível conectar à mesa.'}</p>
        {loadFailed && getSession()?.actor.role === 'gm' && (
          <ResetCampaignButton onDone={() => setPhase(useGame.getState().status === 'ready' ? 'ready' : 'failed')} />
        )}
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
  return sink ? <ImageSinkProvider sink={sink}>{children}</ImageSinkProvider> : <>{children}</>;
}

/** Sessão online envia imagens ao Storage; a local mantém o destino padrão (data URL). */
function onlineSink(session: Session | null): ImageSink | null {
  if (session?.mode !== 'online') return null;
  const supabase = getSupabase();
  return supabase ? createUploadSink(session.campaignId, createOnlineUploadApi(supabase)) : null;
}
