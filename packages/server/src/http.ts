import type { IncomingMessage } from 'node:http';
import type { AuthAdmin } from './authAdmin';
import type { IdentifyFn } from './auth';
import type { AssetsDep } from './assetsRepo';
import type { AccountsRepo, CampaignsRepo } from './repos';
import type { CampaignStore } from './store';

export interface ApiRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: unknown;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

export interface ServerEnv {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SETUP_TOKEN?: string;
}

/** Dependências injetadas nos handlers. */
export interface ServerDeps {
  env: ServerEnv;
  store: CampaignStore;
  identify: IdentifyFn;
  admin: AuthAdmin;
  db: AccountsRepo & CampaignsRepo;
  assets: AssetsDep;
  newId: () => string;
}

export type Handler = (req: ApiRequest, deps: ServerDeps) => Promise<ApiResponse>;

export const MAX_BODY_BYTES = 1024 * 1024;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

/** Lê o corpo como JSON (até 1 MB). Corpo vazio vira `undefined`. */
export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer);
    size += buf.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'too_large');
    chunks.push(buf);
  }
  if (size === 0) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'bad_json');
  }
}

export function json(status: number, body: unknown): ApiResponse {
  return { status, body };
}
