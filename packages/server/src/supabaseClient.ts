import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface ServiceEnv {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
}

/** Client com a chave secreta: só para uso no servidor. */
export function createServiceClient(env: ServiceEnv): SupabaseClient {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url) throw new Error('SUPABASE_URL ausente: configure a variável de ambiente do servidor.');
  if (!key) throw new Error('SUPABASE_SECRET_KEY ausente: configure a variável de ambiente do servidor.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
