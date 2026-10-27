import { json } from '../_lib/http.js';
import { currentSession } from '../_lib/session.js';
import { dbRequest } from '../_lib/supabase.js';
import { buildPlayerCampaignView } from '../../online/playerView.js';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'GET') return json(res, 405, { error: 'Método não permitido.' });
    const session = await currentSession(req);
    if (!session) return json(res, 401, { error: 'Sessão expirada.' });
    const account = session.campaign_accounts;
    if (account.role !== 'player' || !account.character_id) return json(res, 403, { error: 'Este acesso não está ligado a um personagem.' });
    const rows = await dbRequest<any[]>(`campaign_snapshots?campaign_id=eq.${account.campaign_id}&select=data,revision,updated_at&limit=1`);
    if (!rows[0]) return json(res, 404, { error: 'A campanha ainda não possui dados online.' });
    return json(res, 200, { view: buildPlayerCampaignView(rows[0].data, account.character_id, Number(rows[0].revision), rows[0].updated_at) });
  } catch (error: any) {
    console.error(error);
    if (error?.message === 'character_not_found') return json(res, 409, { error: 'O personagem ligado a este acesso não existe mais.' });
    return json(res, 500, { error: 'Não foi possível carregar a visão do jogador.' });
  }
}
