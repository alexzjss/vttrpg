import { json, readJson } from '../_lib/http.js';
import { currentSession } from '../_lib/session.js';
import { dbRequest } from '../_lib/supabase.js';

export default async function handler(req: any, res: any) {
  try {
    const session = await currentSession(req);
    if (!session) return json(res, 401, { error: 'Sessão expirada.' });
    const account = session.campaign_accounts;
    if (req.method === 'GET') {
      if (account.role !== 'gm') return json(res, 403, { error: 'A visão completa da campanha é exclusiva do mestre.' });
      const rows = await dbRequest<any[]>(`campaign_snapshots?campaign_id=eq.${account.campaign_id}&select=snapshot_version,data,revision,updated_at&limit=1`);
      return json(res, 200, { snapshot: rows[0] ?? null });
    }
    if (req.method !== 'PUT') return json(res, 405, { error: 'Método não permitido.' });
    if (account.role !== 'gm') return json(res, 403, { error: 'Somente o mestre pode substituir os dados da campanha.' });
    const body = await readJson(req);
    if (!body?.data || !Number.isInteger(body.snapshotVersion) || !Number.isInteger(body.expectedRevision)) return json(res, 400, { error: 'Snapshot inválido.' });
    const rows = await dbRequest<any[]>('rpc/save_campaign_snapshot', { method: 'POST', body: JSON.stringify({ p_campaign_id: account.campaign_id, p_expected_revision: body.expectedRevision, p_snapshot_version: body.snapshotVersion, p_data: body.data }) });
    return json(res, 200, { revision: rows[0]?.revision, updatedAt: rows[0]?.updated_at });
  } catch (error: any) {
    console.error(error);
    if (String(error?.message).includes('409') || String(error?.message).includes('revision_conflict')) return json(res, 409, { error: 'Os dados online mudaram. Recarregue antes de salvar novamente.' });
    return json(res, 500, { error: 'Não foi possível acessar os dados online.' });
  }
}
