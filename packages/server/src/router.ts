import { json, type ApiRequest, type ApiResponse, type Handler, type ServerDeps } from './http';
import { health } from './handlers/health';
import { me } from './handlers/me';
import { state } from './handlers/state';
import { command } from './handlers/command';
import { listCampaigns, createCampaignHandler } from './handlers/campaigns';
import { listAccounts, createAccount, patchAccount } from './handlers/accounts';
import { uploadUrl, usage } from './handlers/assets';
import { setup } from './handlers/setup';

const routes: Record<string, Handler> = {
  'GET /api/health': health,
  'GET /api/me': me,
  'GET /api/state': state,
  'POST /api/command': command,
  'GET /api/campaigns': listCampaigns,
  'POST /api/campaigns': createCampaignHandler,
  'GET /api/accounts': listAccounts,
  'POST /api/accounts': createAccount,
  'PATCH /api/accounts': patchAccount,
  'POST /api/assets/upload-url': uploadUrl,
  'GET /api/assets/usage': usage,
  'POST /api/setup': setup,
};

/**
 * Rotas que funcionam sem o Supabase configurado. `POST /api/setup` não usa Bearer,
 * mas precisa do Supabase para criar o GM, então fica de fora.
 */
export const PUBLIC_ROUTES: ReadonlySet<string> = new Set(['GET /api/health']);

export async function route(req: ApiRequest, deps: ServerDeps): Promise<ApiResponse> {
  const key = `${req.method.toUpperCase()} ${req.path}`;
  if (!PUBLIC_ROUTES.has(key) && !(deps.env.SUPABASE_URL && deps.env.SUPABASE_SECRET_KEY)) {
    return json(503, { error: 'online_not_configured' });
  }
  const handler = routes[key];
  if (!handler) return json(404, { error: 'not_found' });
  return handler(req, deps);
}
