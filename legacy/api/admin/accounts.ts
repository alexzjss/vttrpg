import { json, readJson } from '../_lib/http.js';
import { currentSession } from '../_lib/session.js';
import { hashPassword } from '../_lib/security.js';
import { dbRequest } from '../_lib/supabase.js';

export default async function handler(req: any, res: any) {
  try {
    const session = await currentSession(req);
    if (!session || session.campaign_accounts.role !== 'gm') return json(res, 403, { error: 'Acesso exclusivo do mestre.' });
    const gm = session.campaign_accounts;
    if (req.method === 'GET') {
      const rows = await dbRequest(`campaign_accounts?campaign_id=eq.${gm.campaign_id}&select=id,username,role,character_id,active,created_at&order=created_at.asc`);
      return json(res, 200, { accounts: rows });
    }
    if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
    const body = await readJson(req);
    const username = String(body.username ?? '').trim().toLowerCase();
    const characterId = String(body.characterId ?? '').trim();
    if (!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(username) || !characterId) return json(res, 400, { error: 'Informe usuário e personagem.' });
    const credentials = hashPassword(String(body.password ?? ''));
    const rows = await dbRequest('campaign_accounts?select=id,username,role,character_id,active', {
      method: 'POST', headers: { prefer: 'return=representation' },
      body: JSON.stringify({ campaign_id: gm.campaign_id, username, password_salt: credentials.salt, password_hash: credentials.hash, role: 'player', character_id: characterId }),
    });
    return json(res, 201, { account: (rows as any[])[0] });
  } catch (error: any) {
    console.error(error);
    if (error?.message === 'A senha precisa ter pelo menos 8 caracteres.') return json(res, 400, { error: error.message });
    return json(res, 500, { error: 'Não foi possível administrar os acessos.' });
  }
}
