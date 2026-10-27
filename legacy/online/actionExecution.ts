import type { Character } from '../types';
import type { AppSnapshot } from '../utils/database';
import { migrateCharacterDefense } from '../utils/defense';
import { resolveArsenalAction, type ArsenalActorState } from '../utils/arsenalPipeline';
import { resolveAbilityGraphAction } from '../utils/abilityGraphAction';
import { buildArsenalCombatLog } from '../utils/combatLog';
import { buildAbilityGraphCombatLog } from '../utils/combatLogGraph';
import { logEntry } from '../utils/cena';
import { resolveMovementIntents } from '../utils/movementResolver';
import { effectiveTokens } from '../utils/mapPositions';
import { graphAreaConfig, resolveAreaTargets } from '../utils/abilityArea';
import { ensureNodesRegistered } from '../utils/nodes';
import { graphFormaVisual } from '../utils/abilityGraphAction';
import { normalizeCard, normalizeItem, normalizeSeal, normalizeWeapon, resolveAction, type ResolvedAction, type StatSnapshot } from '../utils/actions';

export interface ExecuteOnlineActionInput { actorId: string; actionId: string; targetIds: string[]; choiceTargetId?: string; destination?: { x: number; y: number }; reaction?: boolean }
export interface ExecuteOnlineActionResult { snapshot: AppSnapshot; status: 'concluida' | 'preparando'; summary: string }

function allParticipants(snapshot: AppSnapshot): Character[] { return [...snapshot.characters, ...snapshot.cena.npcRoster]; }

function legacyStats(character: Character): StatSnapshot {
  const defense = migrateCharacterDefense(character);
  return { currentHp: character.currentHp, maxHp: character.maxHp, currentAura: character.currentAura, maxAura: character.maxAura, currentAmmo: character.currentAmmo, maxAmmo: character.maxAmmo, defense: character.defense, defenseMax: defense.defenseMax, defenseCurrent: defense.defenseCurrent, defenseReduction: defense.defenseReduction, defenseRegeneration: defense.defenseRegeneration, defenseActivationThreshold: defense.defenseActivationThreshold, staggerMax: defense.staggerMax, staggerCurrent: defense.staggerCurrent, staggerRecovery: defense.staggerRecovery, staggerDamageMultiplier: defense.staggerDamageMultiplier, staggerDuration: defense.staggerDuration, isDefenseBroken: defense.isDefenseBroken, isStaggered: defense.isStaggered, staggerTurnsRemaining: defense.staggerTurnsRemaining, conditions: character.conditions ?? [] };
}

function legacyAction(snapshot: AppSnapshot, actor: Character, id: string): ResolvedAction | null {
  const card = (snapshot.cards ?? []).find(item => item.id === id && (actor.cardIds ?? []).includes(id));
  if (card) return normalizeCard(card);
  const seal = (snapshot.seals ?? []).find(item => item.id === id && (actor.sealIds ?? []).includes(id));
  if (seal) return normalizeSeal(seal);
  const weapon = (snapshot.weapons ?? []).find(item => item.id === id && (actor.weaponIds ?? []).includes(id));
  if (weapon) return normalizeWeapon(weapon);
  const owned = (actor.ownedItems ?? []).find(item => item.itemId === id);
  const item = owned ? (snapshot.items ?? []).find(candidate => candidate.id === id) : null;
  return item && owned ? normalizeItem({ ...item, quantity: owned.quantity, durability: owned.durability, maxDurability: owned.maxDurability }) : null;
}

function actorState(snapshot: AppSnapshot, character: Character): ArsenalActorState {
  const defense = migrateCharacterDefense(character);
  const party = character.teamOverride ? character.teamOverride === 'party' : snapshot.characters.some(item => item.id === character.id);
  return {
    id: character.id, teamId: party ? 'party' : 'npc', name: character.name,
    currentHp: character.currentHp, maxHp: character.maxHp, currentAura: character.currentAura, maxAura: character.maxAura,
    currentAmmo: character.currentAmmo, maxAmmo: character.maxAmmo, defense: character.defense ?? 10,
    defenseCurrent: defense.defenseCurrent, defenseMax: defense.defenseMax, defenseReduction: defense.defenseReduction,
    defenseRegeneration: defense.defenseRegeneration, defenseActivationThreshold: defense.defenseActivationThreshold,
    staggerCurrent: defense.staggerCurrent, staggerMax: defense.staggerMax, staggerRecovery: defense.staggerRecovery,
    staggerDamageMultiplier: defense.staggerDamageMultiplier, staggerDuration: defense.staggerDuration,
    isDefenseBroken: defense.isDefenseBroken, isStaggered: defense.isStaggered, staggerTurnsRemaining: defense.staggerTurnsRemaining,
    speed: character.speed ?? character.baseInitiative ?? 0, tags: [],
    equippedWeaponIds: (character.arsenal ?? []).filter(item => item.equipped).map(item => item.cardId),
    activeFormIds: (character.arsenal ?? []).filter(item => item.active).map(item => item.cardId),
    effects: [...(character.activeEffects ?? []), ...snapshot.cena.encounter.fieldEffects.map(field => ({ effect: field.effect, stacks: 1, remaining: field.roundsRemaining ?? undefined }))],
    holdings: (character.arsenal ?? []).map(item => ({ ...item })),
    isCurrentTurn: snapshot.cena.encounter.order[snapshot.cena.encounter.turnIndex]?.refId === character.id,
    inCombat: snapshot.cena.encounter.isActive,
  };
}

function applyState(snapshot: AppSnapshot, state: ArsenalActorState): void {
  const fieldIds = new Set(snapshot.cena.encounter.fieldEffects.map(field => field.effect.id));
  const patch = (character: Character): Character => character.id !== state.id ? character : {
    ...character, currentHp: state.currentHp, currentAura: state.currentAura, currentAmmo: state.currentAmmo,
    defenseMax: state.defenseMax, defenseCurrent: state.defenseCurrent, defenseReduction: state.defenseReduction,
    defenseRegeneration: state.defenseRegeneration, defenseActivationThreshold: state.defenseActivationThreshold,
    staggerMax: state.staggerMax, staggerCurrent: state.staggerCurrent, staggerRecovery: state.staggerRecovery,
    staggerDamageMultiplier: state.staggerDamageMultiplier, staggerDuration: state.staggerDuration,
    isDefenseBroken: state.isDefenseBroken, isStaggered: state.isStaggered, staggerTurnsRemaining: state.staggerTurnsRemaining,
    arsenal: state.holdings, activeEffects: state.effects.filter(effect => !fieldIds.has(effect.effect.id)),
  };
  snapshot.characters = snapshot.characters.map(patch);
  snapshot.cena.npcRoster = snapshot.cena.npcRoster.map(npc => patch(npc) as typeof npc);
}

function addPreparation(snapshot: AppSnapshot, actorId: string, actionId: string, targetIds: string[], amount = 1) {
  snapshot.cena.encounter.preparations = [...snapshot.cena.encounter.preparations.filter(item => !(item.ownerId === actorId && item.entryId === actionId)), { ownerId: actorId, entryId: actionId, roundsRemaining: Math.max(1, amount), participantIds: [], targetIds }];
}

function preparationAmount(preparation: { timing: { type: string; amount?: number } } | undefined): number { return preparation?.timing.amount ?? 1; }

function replaceParticipant(snapshot: AppSnapshot, id: string, update: (character: Character) => Character) {
  snapshot.characters = snapshot.characters.map(character => character.id === id ? update(character) : character);
  snapshot.cena.npcRoster = snapshot.cena.npcRoster.map(character => character.id === id ? update(character) as typeof character : character);
}

function materializeTransform(snapshot: AppSnapshot, targetId: string, formId: string) {
  const target = allParticipants(snapshot).find(item => item.id === targetId);
  if (!target) return;
  const old = snapshot.cena.encounter.activeFormas.find(item => item.ownerId === targetId);
  const card = snapshot.grimoire.find(item => item.id === formId);
  const graph = (snapshot.abilityGraphs ?? []).find(item => item.id === formId);
  if (!card && !graph) throw new Error('form_not_found');
  const level = Math.max(1, target.arsenal?.find(item => item.cardId === formId)?.maxLevel ?? 1);
  const visual = graph ? graphFormaVisual(graph, level) : null;
  const hpBonus = card?.form?.hpBonus ?? visual?.hpBonus ?? 0;
  const auraBonus = card?.form?.auraBonus ?? visual?.auraBonus ?? 0;
  replaceParticipant(snapshot, targetId, character => {
    const baseMaxHp = Math.max(1, character.maxHp - (old?.hpBonusApplied ?? 0));
    const baseMaxAura = Math.max(0, character.maxAura - (old?.auraBonusApplied ?? 0));
    const holdings = (character.arsenal ?? []).map(item => ({ ...item, active: item.cardId === formId }));
    if (!holdings.some(item => item.cardId === formId)) holdings.push({ cardId: formId, quantity: 1, equipped: false, active: true });
    return { ...character, arsenal: holdings, maxHp: baseMaxHp + hpBonus, currentHp: Math.min(baseMaxHp + hpBonus, Math.max(1, character.currentHp - (old?.hpBonusApplied ?? 0) + hpBonus)), maxAura: baseMaxAura + auraBonus, currentAura: Math.min(baseMaxAura + auraBonus, Math.max(0, character.currentAura - (old?.auraBonusApplied ?? 0) + auraBonus)) };
  });
  snapshot.cena.encounter.activeFormas = [...snapshot.cena.encounter.activeFormas.filter(item => item.ownerId !== targetId), { ownerId: targetId, entryId: formId, roundsRemaining: card?.form?.durationRounds ?? 0, hpBonusApplied: hpBonus, auraBonusApplied: auraBonus }];
}

function materializeSummon(snapshot: AppSnapshot, actorId: string, intent: { entityName: string; teamId: 'party' | 'npc'; rounds: number; maxHp: number; maxAura: number; speed: number }) {
  const id = `summon-${crypto.randomUUID()}`;
  snapshot.cena.npcRoster.push({ id, name: intent.entityName, icon: '', maxHp: intent.maxHp, currentHp: intent.maxHp, maxAura: intent.maxAura, currentAura: intent.maxAura, maxAmmo: 0, currentAmmo: 0, baseInitiative: intent.speed, speed: intent.speed, cardIds: [], conditions: [], items: [], isNpc: true, hidden: false, present: true, teamOverride: intent.teamId, summonedRoundsRemaining: intent.rounds });
  const actorPosition = snapshot.cena.tokens[actorId] ?? { x: 50, y: 50 };
  snapshot.cena.tokens[id] = { x: Math.min(100, actorPosition.x + 5), y: actorPosition.y };
  if (snapshot.cena.encounter.isActive) snapshot.cena.encounter.order.push({ refId: id, side: intent.teamId, initiative: intent.speed });
  snapshot.cena.log.push(logEntry('system', `${intent.entityName} é invocado.`));
}

function applyResolvedStates(snapshot: AppSnapshot, beforeActor: ArsenalActorState, resultActor: ArsenalActorState, resultTargets: ArsenalActorState[]) {
  const selfTarget = resultTargets.find(target => target.id === resultActor.id);
  if (selfTarget) {
    applyState(snapshot, { ...selfTarget, holdings: resultActor.holdings, currentHp: resultActor.currentHp + (selfTarget.currentHp - beforeActor.currentHp), currentAura: resultActor.currentAura + (selfTarget.currentAura - beforeActor.currentAura), currentAmmo: resultActor.currentAmmo + (selfTarget.currentAmmo - beforeActor.currentAmmo) });
  } else applyState(snapshot, resultActor);
  resultTargets.filter(target => target.id !== resultActor.id).forEach(state => applyState(snapshot, state));
}

export function executeOnlineAction(source: AppSnapshot, input: ExecuteOnlineActionInput): ExecuteOnlineActionResult {
  const snapshot = structuredClone(source);
  const participants = allParticipants(snapshot);
  const actor = participants.find(item => item.id === input.actorId);
  if (!actor) throw new Error('actor_not_found');
  const targets = input.targetIds.map(id => participants.find(item => item.id === id)).filter((item): item is Character => !!item);
  const beforeActor = actorState(snapshot, actor);
  const beforeTargets = targets.map(target => actorState(snapshot, target));
  const card = snapshot.grimoire.find(item => item.id === input.actionId);
  if (card) {
    const result = resolveArsenalAction({ card, actor: beforeActor, targets: beforeTargets, isReaction: input.reaction });
    if (result.status === 'bloqueada' || result.status === 'cancelada') throw new Error(result.reason || 'action_blocked');
    applyResolvedStates(snapshot, beforeActor, result.actor, result.targets);
    if (result.status === 'preparando') addPreparation(snapshot, actor.id, card.id, input.targetIds, preparationAmount(result.preparation));
    result.fieldEffects.forEach((effect, index) => snapshot.cena.encounter.fieldEffects.push({ id: `online-field-${Date.now()}-${index}`, sourceId: actor.id, sourceName: actor.name, entryId: card.id, effect, roundsRemaining: effect.duration.type === 'rodadas' ? effect.duration.amount ?? null : null }));
    snapshot.cena.log.push(...buildArsenalCombatLog({ card, beforeActor, beforeTargets, result }));
    if (!input.reaction) snapshot.cena.encounter.turn = { ...snapshot.cena.encounter.turn, majorUsed: true };
    return { snapshot, status: result.status, summary: `${actor.name} usou ${card.name}.` };
  }
  const legacy = legacyAction(snapshot, actor, input.actionId);
  if (legacy) {
    const target = legacy.targeting === 'self' ? actor : targets[0];
    if (!target) throw new Error('target_required');
    const result = resolveAction(actor.name, legacyStats(actor), target.name, legacyStats(target), legacy);
    replaceParticipant(snapshot, actor.id, current => ({ ...current, currentHp: Math.max(0, Math.min(current.maxHp, current.currentHp + (result.actorDelta.hp ?? 0))), currentAura: Math.max(0, Math.min(current.maxAura, current.currentAura + (result.actorDelta.aura ?? 0))), currentAmmo: Math.max(0, Math.min(current.maxAmmo, current.currentAmmo + (result.actorDelta.ammo ?? 0))) }));
    replaceParticipant(snapshot, target.id, current => ({ ...current, currentHp: Math.max(0, Math.min(current.maxHp, current.currentHp + (result.targetDelta.hp ?? 0))), currentAura: Math.max(0, Math.min(current.maxAura, current.currentAura + (result.targetDelta.aura ?? 0))), currentAmmo: Math.max(0, Math.min(current.maxAmmo, current.currentAmmo + (result.targetDelta.ammo ?? 0))), ...(result.defenseDelta ?? {}), conditions: result.conditionApplied ? [...(current.conditions ?? []), result.conditionApplied] : current.conditions }));
    snapshot.cena.log.push(...result.log);
    if (!input.reaction) snapshot.cena.encounter.turn = { ...snapshot.cena.encounter.turn, majorUsed: true };
    if (input.reaction) snapshot.cena.encounter.reactionsUsed[actor.id] = true;
    return { snapshot, status: 'concluida', summary: `${actor.name} usou ${legacy.name}.` };
  }
  const graph = (snapshot.abilityGraphs ?? []).find(item => item.id === input.actionId);
  if (!graph) throw new Error('action_not_found');
  ensureNodesRegistered();
  const holding = actor.arsenal?.find(item => item.cardId === graph.id);
  const level = Math.max(1, holding?.maxLevel ?? 1);
  const tokenMap = effectiveTokens(snapshot.cena.tokens, participants.map(item => item.id));
  const areaConfig = graphAreaConfig(graph, level);
  const areaIds = areaConfig ? resolveAreaTargets(areaConfig, actor.id, input.targetIds[0] ?? null, tokenMap, participants.filter(item => item.id !== actor.id).map(item => item.id)) : [];
  const areaCharacters = areaIds.map(id => participants.find(item => item.id === id)).filter((item): item is Character => !!item);
  const beforeAreaTargets = areaCharacters.map(target => actorState(snapshot, target));
  const graphTargets = beforeTargets.length ? beforeTargets : [beforeActor];
  let result = resolveAbilityGraphAction({ graph, level, actor: beforeActor, targets: graphTargets, areaTargets: beforeAreaTargets, isReaction: input.reaction });
  if (result.status === 'bloqueada') throw new Error(result.reason || 'action_blocked');
  let choiceDepth = 0;
  while (result.pendingTargetChoice) {
    const chosenCharacter = input.choiceTargetId ? participants.find(item => item.id === input.choiceTargetId) : null;
    if (!chosenCharacter) throw new Error('additional_target_required');
    const chosenState = result.targets.find(item => item.id === chosenCharacter.id) ?? result.areaTargets.find(item => item.id === chosenCharacter.id) ?? actorState(snapshot, chosenCharacter);
    result = resolveAbilityGraphAction({ graph, level, actor: result.actor, targets: [chosenState], entryNodeIds: result.pendingTargetChoice.nodeIds, resumePreparation: true, isReaction: input.reaction });
    if (result.status === 'bloqueada') throw new Error(result.reason || 'action_blocked');
    choiceDepth += 1;
    if (choiceDepth > 4) throw new Error('too_many_target_choices');
  }
  applyResolvedStates(snapshot, beforeActor, result.actor, result.targets);
  if (!result.targets.some(target => target.id === result.actor.id)) applyState(snapshot, result.actor);
  result.areaTargets.filter(state => !result.targets.some(target => target.id === state.id)).forEach(state => applyState(snapshot, state));
  if (result.status === 'preparando') addPreparation(snapshot, actor.id, graph.id, input.targetIds, preparationAmount(result.preparation));
  result.ongoingEffectIntents.forEach(intent => snapshot.cena.encounter.activeOngoingEffects.push({ id: `online-ongoing-${crypto.randomUUID()}`, ownerId: intent.targetId, casterId: intent.casterId, graphId: graph.id, roundsRemaining: intent.rounds, ...(intent.pendingReactions?.length ? { pendingReactions: intent.pendingReactions } : {}), ...(intent.unlockCardIntents?.length ? { unlockCardIntents: intent.unlockCardIntents } : {}) }));
  const movedTokens = resolveMovementIntents(result.movementIntents, tokenMap, actor.id);
  if (input.destination) result.movementIntents.filter(intent => intent.kind === 'teleportar').forEach(intent => { movedTokens[intent.targetId] = { x: Math.max(0, Math.min(100, input.destination!.x)), y: Math.max(0, Math.min(100, input.destination!.y)) }; });
  if (Object.keys(movedTokens).length) snapshot.cena.tokens = { ...snapshot.cena.tokens, ...movedTokens };
  (result.summonIntents ?? []).forEach(intent => materializeSummon(snapshot, actor.id, intent));
  (result.transformIntents ?? []).forEach(intent => materializeTransform(snapshot, intent.targetId, intent.intoFormId));
  snapshot.cena.log.push(...buildAbilityGraphCombatLog({ graph, beforeActor, beforeTargets: [...beforeTargets, ...beforeAreaTargets.filter(area => !beforeTargets.some(target => target.id === area.id))], result }));
  if (!input.reaction) snapshot.cena.encounter.turn = { ...snapshot.cena.encounter.turn, majorUsed: true };
  if (input.reaction) snapshot.cena.encounter.reactionsUsed[actor.id] = true;
  if (!snapshot.cena.log.length) snapshot.cena.log.push(logEntry('system', `${actor.name} usa ${graph.header.name}.`));
  return { snapshot, status: result.status, summary: `${actor.name} usou ${graph.header.name}.` };
}
