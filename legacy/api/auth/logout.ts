import { json } from '../_lib/http.js';
import { dbRequest } from '../_lib/supabase.js';
import { parseCookies, sessionCookie, tokenHash } from '../_lib/security.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
  try {
    const headerToken = req.headers?.['x-vat-session'];
    const token = (typeof headerToken === 'string' && headerToken) || parseCookies(req.headers?.cookie).vat_session;
    if (token) await dbRequest(`campaign_sessions?token_hash=eq.${tokenHash(token)}`, { method: 'DELETE' });
    res.setHeader('set-cookie', sessionCookie('', 0));
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'Não foi possível encerrar a sessão.' });
  }
}
