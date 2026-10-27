import { json, type ApiRequest, type ApiResponse, type Handler, type ServerDeps } from './http';
import { health } from './handlers/health';

const routes: Record<string, Handler> = {
  'GET /api/health': health,
};

/** Roteia por método + caminho. Tudo exceto /api/health exige o Supabase configurado. */
export async function route(req: ApiRequest, deps: ServerDeps): Promise<ApiResponse> {
  const key = `${req.method.toUpperCase()} ${req.path}`;
  if (key !== 'GET /api/health' && !(deps.env.SUPABASE_URL && deps.env.SUPABASE_SECRET_KEY)) {
    return json(503, { error: 'online_not_configured' });
  }
  const handler = routes[key];
  if (!handler) return json(404, { error: 'not_found' });
  return handler(req, deps);
}
