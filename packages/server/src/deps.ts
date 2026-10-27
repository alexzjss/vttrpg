import { createAccountsRepo, createCampaignsRepo } from './repos';
import { createAuthAdmin } from './authAdmin';
import { createIdentify } from './auth';
import { createServiceClient } from './supabaseClient';
import { createSupabaseStore } from './supabaseStore';
import type { ServerDeps, ServerEnv } from './http';

function unconfigured(): never {
  throw new Error('online_not_configured');
}

/**
 * Monta as dependências a partir do ambiente. Sem Supabase configurado devolve stubs que
 * lançam; o roteador responde 503 antes de qualquer handler tocá-los.
 */
export function createDeps(env: ServerEnv): ServerDeps {
  const newId = () => crypto.randomUUID();
  if (!(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY)) {
    const stub = new Proxy({}, { get: () => unconfigured }) as never;
    return { env, store: stub, identify: unconfigured, admin: stub, db: stub, newId };
  }
  const client = createServiceClient(env);
  const accounts = createAccountsRepo(client);
  const campaigns = createCampaignsRepo(client);
  return {
    env,
    store: createSupabaseStore(client),
    identify: createIdentify(client, accounts),
    admin: createAuthAdmin(client),
    db: { ...accounts, ...campaigns },
    newId,
  };
}
