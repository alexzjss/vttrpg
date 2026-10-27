import { json, readJson } from '../_lib/http.js';
import { currentSession } from '../_lib/session.js';
import { dbRequest } from '../_lib/supabase.js';

export default async function handler(req: any, res: any) {
  try {
    const session = await currentSession(req);
    if (!session) return json(res, 401, { error: 'Sessão expirada.' });
    const account = session.campaign_accounts;
    if (account.role !== 'gm') return json(res, 403, { error: 'Somente o mestre pode decidir solicitações.' });
    if (req.method === 'GET') {
      const [requests, snapshots] = await Promise.all([
        dbRequest<any[]>(`action_requests?campaign_id=eq.${account.campaign_id}&status=eq.pending&select=id,actor_character_id,action_id,target_ids,payload,status,created_at&order=created_at.asc`),
        dbRequest<any[]>(`campaign_snapshots?campaign_id=eq.${account.campaign_id}&select=data&limit=1`),
      ]);
      const data = snapshots[0]?.data;
      const participants = [...(data?.characters ?? []), ...(data?.cena?.npcRoster ?? [])];
      return json(res, 200, { requests: requests.map(request => ({ ...request, actorName: participants.find((item: any) => item.id === request.actor_character_id)?.name ?? 'Personagem', actionName: data?.grimoire?.find((item: any) => item.id === request.action_id)?.name ?? data?.abilityGraphs?.find((item: any) => item.id === request.action_id)?.header?.name ?? data?.cards?.find((item: any) => item.id === request.action_id)?.name ?? data?.seals?.find((item: any) => item.id === request.action_id)?.name ?? data?.weapons?.find((item: any) => item.id === request.action_id)?.name ?? data?.items?.find((item: any) => item.id === request.action_id)?.name ?? 'Ação', targetNames: [...request.target_ids, ...(request.payload?.choiceTargetId ? [request.payload.choiceTargetId] : [])].map((id: string) => participants.find((item: any) => item.id === id)?.name ?? 'Alvo') })) });
    }
    if (req.method !== 'PATCH') return json(res, 405, { error: 'Método não permitido.' });
    const input = await readJson(req);
    if (typeof input?.id !== 'string' || !['approved', 'rejected'].includes(input?.status)) return json(res, 400, { error: 'Decisão inválida.' });
    const pending = await dbRequest<any[]>(`action_requests?id=eq.${encodeURIComponent(input.id)}&campaign_id=eq.${account.campaign_id}&status=eq.pending&select=id,actor_character_id,action_id,target_ids,payload&limit=1`);
    const request = pending[0];
    if (!request) return json(res, 404, { error: 'Solicitação não encontrada ou já decidida.' });
    let execution: { revision?: number; summary?: string; status?: string } = {};
    if (input.status === 'approved') {
      const snapshots = await dbRequest<any[]>(`campaign_snapshots?campaign_id=eq.${account.campaign_id}&select=data,revision,snapshot_version&limit=1`);
      const stored = snapshots[0];
      if (!stored) return json(res, 404, { error: 'Campanha sem dados online.' });
      const encounter = stored.data.cena.encounter;
      const reaction = request.payload?.reaction === true;
      if (!reaction && encounter.isActive && (encounter.isPaused || encounter.order[encounter.turnIndex]?.refId !== request.actor_character_id)) return json(res, 409, { error: 'O turno mudou; rejeite este pedido e solicite a ação novamente.' });
      const { executeOnlineAction } = await import('../../online/actionExecution.js');
      const result = executeOnlineAction(stored.data, { actorId: request.actor_character_id, actionId: request.action_id, targetIds: request.target_ids, choiceTargetId: request.payload?.choiceTargetId, destination: request.payload?.destination, reaction });
      const saved = await dbRequest<any[]>('rpc/save_campaign_snapshot', { method: 'POST', body: JSON.stringify({ p_campaign_id: account.campaign_id, p_expected_revision: Number(stored.revision), p_snapshot_version: stored.snapshot_version, p_data: result.snapshot }) });
      execution = { revision: Number(saved[0]?.revision), summary: result.summary, status: result.status };
    }
    const decided = await dbRequest<any[]>(`action_requests?id=eq.${encodeURIComponent(request.id)}&campaign_id=eq.${account.campaign_id}&status=eq.pending&select=id,status,decided_at,decision_note`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ status: input.status, decided_by: account.id, decision_note: input.status === 'approved' ? execution.summary : typeof input.note === 'string' ? input.note.slice(0, 500) : null, decided_at: new Date().toISOString() }) });
    if (!decided[0]) return json(res, 409, { error: 'A solicitação foi decidida em outra janela.' });
    return json(res, 200, { request: decided[0], execution });
  } catch (error: any) {
    console.error(error);
    const message = String(error?.message ?? '');
    if (message.includes('revision_conflict') || message.includes('(409)')) return json(res, 409, { error: 'A campanha mudou durante a aprovação. Tente novamente.' });
    if (message.includes('additional_target_required')) return json(res, 422, { error: 'A habilidade exige uma escolha intermediária de alvo que ainda não foi informada.' });
    if (message.includes('bloquead') || message.includes('cooldown') || message.includes('cargas') || message.includes('Aura') || message.includes('Muni')) return json(res, 422, { error: `A ação não pôde ser executada: ${message}` });
    return json(res, 500, { error: 'Não foi possível acessar as solicitações.' });
  }
}
