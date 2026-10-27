import { json } from '../_lib/http.js';
import { currentSession } from '../_lib/session.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Método não permitido.' });
  try {
    const row = await currentSession(req);
    if (!row) return json(res, 200, { session: null });
    const account = row.campaign_accounts;
    return json(res, 200, { session: { accountId: account.id, campaignId: account.campaign_id, campaignSlug: account.campaigns.slug, username: account.username, role: account.role, characterId: account.character_id, expiresAt: row.expires_at } });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'Não foi possível verificar a sessão.' });
  }
}
