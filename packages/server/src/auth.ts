import type { SupabaseClient } from '@supabase/supabase-js';
import type { Actor } from '@vtt/core';
import type { ApiRequest } from './http';
import type { AccountsRepo } from './repos';

export interface Identity {
  userId: string;
  username: string;
  role: 'gm' | 'player';
  campaignId: string | null;
  characterId: string | null;
  active: boolean;
}

export type IdentifyFn = (req: ApiRequest) => Promise<Identity | null>;

export function bearerToken(req: ApiRequest): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers['authorization'] ?? '');
  return m ? m[1] : null;
}

/** Bearer token -> claims verificadas pelo Supabase Auth -> linha de `accounts` ativa. */
export function createIdentify(client: Pick<SupabaseClient, 'auth'>, accounts: AccountsRepo): IdentifyFn {
  return async (req) => {
    const token = bearerToken(req);
    if (!token) return null;
    const { data, error } = await client.auth.getClaims(token);
    const sub = data?.claims?.sub;
    if (error || typeof sub !== 'string') return null;
    const row = await accounts.getById(sub);
    if (!row || !row.active) return null;
    return {
      userId: row.id, username: row.username, role: row.role,
      campaignId: row.campaignId, characterId: row.characterId, active: row.active,
    };
  };
}

/** GM atua em qualquer campanha; jogador só na sua, e só com o próprio personagem. */
export function actorFor(identity: Identity, campaignId: string): Actor | null {
  if (identity.role === 'gm') return { role: 'gm' };
  if (identity.campaignId === campaignId && identity.characterId) {
    return { role: 'player', characterId: identity.characterId };
  }
  return null;
}
