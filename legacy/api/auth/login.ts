import { readJson, json } from '../_lib/http.js';
import { dbRequest } from '../_lib/supabase.js';
import { newSessionToken, sessionCookie, tokenHash, verifyPassword } from '../_lib/security.js';

interface AccountRow {
  id: string; campaign_id: string; username: string; password_salt: string; password_hash: string;
  role: 'gm' | 'player'; character_id: string | null; active: boolean;
  campaigns: { id: string; slug: string };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
  try {
    const body = await readJson(req);
    const campaign = String(body.campaign ?? '').trim().toLowerCase();
    const username = String(body.username ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    if (!campaign || !username || !password) return json(res, 400, { error: 'Informe mesa, usuário e senha.' });
    const select = 'id,campaign_id,username,password_salt,password_hash,role,character_id,active,campaigns!inner(id,slug)';
    const rows = await dbRequest<AccountRow[]>(`campaign_accounts?username=eq.${encodeURIComponent(username)}&campaigns.slug=eq.${encodeURIComponent(campaign)}&select=${select}&limit=1`);
    const account = rows[0];
    if (!account?.active || !verifyPassword(password, account.password_salt, account.password_hash)) return json(res, 401, { error: 'Mesa, usuário ou senha inválidos.' });

    const token = newSessionToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await dbRequest('campaign_sessions', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ account_id: account.id, token_hash: tokenHash(token), expires_at: expiresAt }) });
    res.setHeader('set-cookie', sessionCookie(token));
    return json(res, 200, { token, session: { accountId: account.id, campaignId: account.campaign_id, campaignSlug: account.campaigns.slug, username: account.username, role: account.role, characterId: account.character_id, expiresAt } });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'Não foi possível entrar agora.' });
  }
}
