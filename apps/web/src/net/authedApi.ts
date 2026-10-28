import { createApi, type Api } from './api';
import { getSupabase } from './supabase';

/** Api com o access token da sessão atual do Supabase. */
export function createAuthedApi(): Api {
  return createApi(async () => {
    const supabase = getSupabase();
    if (!supabase) return null;
    return (await supabase.auth.getSession()).data.session?.access_token ?? null;
  });
}
