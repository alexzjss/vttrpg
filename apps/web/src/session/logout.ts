import { getSupabase } from '../net/supabase';
import { clearSession } from './session';

let pendingLogout: Promise<void> | null = null;

/** Encerra a sessão da aba e, no modo online, a do Supabase (só neste navegador). */
export function logout(): Promise<void> {
  clearSession();
  const p = (async () => {
    try {
      await getSupabase()?.auth.signOut({ scope: 'local' });
    } catch {
      // sem rede: a sessão local já foi limpa
    }
  })();
  pendingLogout = p;
  void p.finally(() => {
    if (pendingLogout === p) pendingLogout = null;
  });
  return p;
}

/** Espera um logout em andamento (até `timeoutMs`), para não apagar um login novo. */
export async function awaitPendingLogout(timeoutMs = 3000): Promise<void> {
  const p = pendingLogout;
  if (!p) return;
  await Promise.race([p, new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}
