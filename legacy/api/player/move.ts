import { json, readJson } from '../_lib/http.js';
import { currentSession } from '../_lib/session.js';
import { dbRequest } from '../_lib/supabase.js';

const coordinate = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
    const session = await currentSession(req);
    if (!session) return json(res, 401, { error: 'Sessão expirada.' });
    const account = session.campaign_accounts;
    if (account.role !== 'player' || !account.character_id) return json(res, 403, { error: 'Acesso sem personagem.' });
    const input = await readJson(req);
    const x = coordinate(input?.x), y = coordinate(input?.y);
    if (x === null || y === null || !Number.isInteger(input?.expectedRevision)) return json(res, 400, { error: 'Movimento inválido.' });
    const rows = await dbRequest<any[]>(`campaign_snapshots?campaign_id=eq.${account.campaign_id}&select=data,revision,snapshot_version&limit=1`);
    const row = rows[0];
    if (!row) return json(res, 404, { error: 'Campanha sem dados online.' });
    if (Number(row.revision) !== input.expectedRevision) return json(res, 409, { error: 'A cena mudou. Atualize antes de mover.' });
    const encounter = row.data.cena.encounter;
    const currentTurnId = encounter.order[encounter.turnIndex]?.refId ?? null;
    if (encounter.isActive && (encounter.isPaused || currentTurnId !== account.character_id)) return json(res, 403, { error: 'Você só pode mover no seu turno.' });
    row.data.cena.tokens = { ...row.data.cena.tokens, [account.character_id]: { x, y } };
    const saved = await dbRequest<any[]>('rpc/save_campaign_snapshot', { method: 'POST', body: JSON.stringify({ p_campaign_id: account.campaign_id, p_expected_revision: Number(row.revision), p_snapshot_version: row.snapshot_version, p_data: row.data }) });
    return json(res, 200, { position: { x, y }, revision: Number(saved[0]?.revision) });
  } catch (error: any) {
    console.error(error);
    if (String(error?.message).includes('409') || String(error?.message).includes('revision_conflict')) return json(res, 409, { error: 'A cena mudou. Atualize antes de mover.' });
    return json(res, 500, { error: 'Não foi possível mover o token.' });
  }
}
