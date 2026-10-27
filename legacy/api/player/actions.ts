import { json, readJson } from '../_lib/http.js';
import { currentSession } from '../_lib/session.js';
import { dbRequest } from '../_lib/supabase.js';

export default async function handler(req: any, res: any) {
  try {
    const session = await currentSession(req);
    if (!session) return json(res, 401, { error: 'Sessão expirada.' });
    const account = session.campaign_accounts;
    if (account.role !== 'player' || !account.character_id) return json(res, 403, { error: 'Acesso sem personagem.' });
    if (req.method === 'GET') {
      const rows = await dbRequest<any[]>(`action_requests?campaign_id=eq.${account.campaign_id}&account_id=eq.${account.id}&select=id,action_id,target_ids,status,created_at,decided_at,decision_note&order=created_at.desc&limit=20`);
      return json(res, 200, { requests: rows });
    }
    if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
    const input = await readJson(req);
    if (typeof input?.actionId !== 'string' || !Array.isArray(input?.targetIds)) return json(res, 400, { error: 'Solicitação inválida.' });
    const snapshots = await dbRequest<any[]>(`campaign_snapshots?campaign_id=eq.${account.campaign_id}&select=data,revision&limit=1`);
    const data = snapshots[0]?.data;
    if (!data) return json(res, 404, { error: 'Campanha sem dados online.' });
    const actor = data.characters.find((character: any) => character.id === account.character_id);
    if (!actor) return json(res, 409, { error: 'Personagem não encontrado.' });
    const owned = new Set([...(actor.cardIds ?? []), ...(actor.weaponIds ?? []), ...(actor.sealIds ?? []), ...(actor.ownedItems ?? []).map((item: any) => item.itemId), ...(actor.grimoire ?? []).map((item: any) => item.entryId), ...(actor.arsenal ?? []).map((item: any) => item.cardId)]);
    if (!owned.has(input.actionId)) return json(res, 403, { error: 'Esta ação não pertence ao seu personagem.' });
    const action = data.grimoire?.find((item: any) => item.id === input.actionId) ?? data.abilityGraphs?.find((item: any) => item.id === input.actionId) ?? data.cards?.find((item: any) => item.id === input.actionId) ?? data.seals?.find((item: any) => item.id === input.actionId) ?? data.weapons?.find((item: any) => item.id === input.actionId) ?? data.items?.find((item: any) => item.id === input.actionId);
    if (!action) return json(res, 404, { error: 'Ação não encontrada.' });
    const encounter = data.cena.encounter;
    const isOwnTurn = !encounter.isActive || (encounter.order[encounter.turnIndex]?.refId === account.character_id && !encounter.isPaused);
    const actionInfo = action.header ?? action;
    const isReaction = action.type === 'reação' || action.type === 'reacao' || (actionInfo.tags ?? []).some((tag: string) => tag.toLocaleLowerCase('pt-BR').includes('reação') || tag.toLowerCase().includes('reacao'));
    if (!isOwnTurn && !(isReaction && encounter.isActive && !encounter.reactionsUsed[account.character_id])) return json(res, 403, { error: 'Esta ação não está disponível agora.' });
    const visibleAllies = data.characters.filter((item: any) => !item.isHidden).map((item: any) => item.id);
    const visibleEnemies = data.cena.npcRoster.filter((item: any) => item.present && !item.hidden && !item.isHidden).map((item: any) => item.id);
    const visibleTargets = new Set([...visibleAllies, ...visibleEnemies]);
    const target = actionInfo.target ?? { type: action.combatTargeting === 'self' ? 'proprio_usuario' : 'um_alvo' };
    const areaScope = action.header ? action.nodes?.find((node: any) => node.type === 'alvo' && ['linha', 'cone'].includes(node.props?.scope))?.props?.scope : null;
    let targetIds = [...new Set(input.targetIds.filter((id: unknown): id is string => typeof id === 'string' && visibleTargets.has(id)))];
    if (areaScope && targetIds.length !== 1) return json(res, 400, { error: 'Escolha um alvo para definir a direção da área.' });
    if (target.type === 'proprio_usuario' && !areaScope) targetIds = [account.character_id];
    else if (target.type === 'todos_aliados') targetIds = visibleAllies;
    else if (target.type === 'todos_inimigos') targetIds = visibleEnemies;
    else if (target.type === 'um_alvo' && targetIds.length !== 1) return json(res, 400, { error: 'Escolha exatamente um alvo.' });
    else if (target.type === 'multiplos_alvos' && (targetIds.length < 1 || targetIds.length > target.maxTargets)) return json(res, 400, { error: `Escolha entre 1 e ${target.maxTargets} alvos.` });
    const requiresChoice = action.header && action.nodes?.some((node: any) => node.type === 'alvo' && node.props?.scope === 'escolha');
    const choiceTargetId = typeof input.choiceTargetId === 'string' && visibleTargets.has(input.choiceTargetId) ? input.choiceTargetId : null;
    if (requiresChoice && !choiceTargetId) return json(res, 400, { error: 'Escolha também o alvo da etapa seguinte da habilidade.' });
    const requiresDestination = action.header && action.nodes?.some((node: any) => node.type === 'mover' && node.props?.kind === 'teleportar');
    const destination = input.destination && Number.isFinite(input.destination.x) && Number.isFinite(input.destination.y) ? { x: Math.max(0, Math.min(100, Number(input.destination.x))), y: Math.max(0, Math.min(100, Number(input.destination.y))) } : null;
    if (requiresDestination && !destination) return json(res, 400, { error: 'Escolha o destino do teleporte.' });
    const rows = await dbRequest<any[]>('action_requests?select=id,action_id,target_ids,status,created_at', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ campaign_id: account.campaign_id, encounter_id: `round:${encounter.round}`, account_id: account.id, actor_character_id: account.character_id, action_id: input.actionId, target_ids: targetIds.slice(0, 20), payload: { revision: Number(snapshots[0].revision), reaction: isReaction, choiceTargetId, destination } }) });
    return json(res, 201, { request: rows[0] });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'Não foi possível registrar a solicitação.' });
  }
}
