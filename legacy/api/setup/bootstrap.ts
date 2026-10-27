import { json, readJson } from '../_lib/http.js';
import { hashPassword } from '../_lib/security.js';
import { dbRequest } from '../_lib/supabase.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
  try {
    const body = await readJson(req);
    if (!process.env.SESSION_SECRET || body.setupSecret !== process.env.SESSION_SECRET) {
      return json(res, 403, { error: 'Chave de instalação inválida.' });
    }
    const existing = await dbRequest<{ id: string }[]>('campaigns?select=id&limit=1');
    if (existing.length) return json(res, 409, { error: 'A instalação já foi concluída.' });

    const slug = String(body.campaign ?? '').trim().toLowerCase();
    const name = String(body.campaignName ?? '').trim();
    const username = String(body.username ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    if (!/^[a-z0-9][a-z0-9-]{2,48}$/.test(slug) || !name || !/^[a-z0-9][a-z0-9_-]{2,31}$/.test(username)) {
      return json(res, 400, { error: 'Revise o nome da mesa e o usuário do mestre.' });
    }
    const credentials = hashPassword(password);
    const campaigns = await dbRequest<{ id: string; slug: string }[]>('campaigns?select=id,slug', {
      method: 'POST', headers: { prefer: 'return=representation' }, body: JSON.stringify({ slug, name }),
    });
    const campaign = campaigns[0];
    await dbRequest('campaign_accounts', {
      method: 'POST', headers: { prefer: 'return=minimal' },
      body: JSON.stringify({ campaign_id: campaign.id, username, password_salt: credentials.salt, password_hash: credentials.hash, role: 'gm' }),
    });
    return json(res, 201, { ok: true, campaign: campaign.slug });
  } catch (error: any) {
    console.error(error);
    return json(res, 500, { error: error?.message === 'A senha precisa ter pelo menos 8 caracteres.' ? error.message : 'Não foi possível concluir a instalação.' });
  }
}
