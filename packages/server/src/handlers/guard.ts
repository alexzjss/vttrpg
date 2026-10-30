import type { Identity } from '../auth';
import { json, type ApiRequest, type ApiResponse, type ServerDeps } from '../http';

export const unauthorized = (): ApiResponse => json(401, { error: 'unauthorized' });
export const forbidden = (): ApiResponse => json(403, { error: 'forbidden' });
export const badRequest = (error = 'bad_request'): ApiResponse => json(400, { error });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);
export const badCampaign = (): ApiResponse => badRequest('bad_campaign');

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function isFailure(v: Identity | ApiResponse): v is ApiResponse {
  return 'status' in v;
}

/** Exige identidade; devolve a resposta de erro (401) ou a identidade. */
export async function requireIdentity(req: ApiRequest, deps: ServerDeps): Promise<Identity | ApiResponse> {
  return (await deps.identify(req)) ?? unauthorized();
}

/** Exige identidade de GM (401 sem identidade, 403 para jogador). */
export async function requireGm(req: ApiRequest, deps: ServerDeps): Promise<Identity | ApiResponse> {
  const who = await requireIdentity(req, deps);
  if (isFailure(who)) return who;
  return who.role === 'gm' ? who : forbidden();
}
