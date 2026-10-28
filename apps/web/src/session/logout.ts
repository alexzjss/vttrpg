import { getSupabase } from '../net/supabase';
import { clearSession } from './session';

/** Encerra a sessão da aba e, no modo online, a sessão do Supabase. */
export async function logout(): Promise<void> {
  clearSession();
  try {
    await getSupabase()?.auth.signOut();
  } catch {
    // sem rede: a sessão local já foi limpa
  }
}
