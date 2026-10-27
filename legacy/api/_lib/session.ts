import { dbRequest } from './supabase.js';
import { parseCookies, tokenHash } from './security.js';

export interface SessionRow {
  id: string;
  account_id: string;
  expires_at: string;
  campaign_accounts: {
    id: string; campaign_id: string; username: string; role: 'gm' | 'player'; character_id: string | null; active: boolean;
    campaigns: { id: string; slug: string };
  };
}

export async function currentSession(req: any): Promise<SessionRow | null> {
  const headerToken = req.headers?.['x-vat-session'];
  const token = (typeof headerToken === 'string' && headerToken) || parseCookies(req.headers?.cookie).vat_session;
  if (!token) return null;
  const select = 'id,account_id,expires_at,campaign_accounts(id,campaign_id,username,role,character_id,active,campaigns(id,slug))';
  const rows = await dbRequest<SessionRow[]>(`campaign_sessions?token_hash=eq.${tokenHash(token)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=${select}`);
  const session = rows[0] ?? null;
  return session?.campaign_accounts.active ? session : null;
}
