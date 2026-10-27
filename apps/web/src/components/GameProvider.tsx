import { useEffect, type ReactNode } from 'react';
import { useGame } from '../store/gameStore';
import { createTransport, type Transport } from '../net/transport';
import { getSession } from '../session/session';

/**
 * Conecta a store uma vez por aba, com a sessão atual, e só renderiza os filhos
 * depois do snapshot. Em StrictMode o efeito roda duas vezes: o cleanup fecha a
 * primeira conexão antes da segunda, então nunca há duas conexões vivas.
 */
export function GameProvider({ children }: { children: ReactNode }) {
  const status = useGame((s) => s.status);

  useEffect(() => {
    const session = getSession();
    if (!session) return;
    const transport: Transport = createTransport();
    void useGame.getState().connect(transport, session);
    return () => transport.close();
  }, []);

  if (status === 'error') return <p role="alert">Não foi possível conectar à mesa.</p>;
  if (status !== 'ready') return <p>Conectando…</p>;
  return <>{children}</>;
}
