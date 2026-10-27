import type { AbilityGraph } from './abilityGraph';
import type { AbilityGraphActionResult } from './abilityGraphAction';
import type { ArsenalActorState } from './arsenalPipeline';
import { logEntry, type CenaLogEntry } from './cena';

export function buildAbilityGraphCombatLog(input: {
  graph: AbilityGraph;
  beforeActor: ArsenalActorState;
  beforeTargets: ArsenalActorState[];
  result: AbilityGraphActionResult;
}): CenaLogEntry[] {
  const { graph, beforeActor, beforeTargets, result } = input;
  const entries: CenaLogEntry[] = [];
  const primaryTarget = beforeTargets[0];

  // Decomposição de teste/dano/cura (base → buffs/debuffs → dados extras → multiplicadores → final),
  // vinda de resolveModifiedValue/resolveCausedAndReceivedValue via ctx.trace nos nós teste/dano/cura.
  for (const step of result.trace) {
    if ((step.node === 'dano' || step.node === 'cura' || step.node === 'teste') && step.detail?.includes(' · ')) {
      entries.push(logEntry('system', step.detail, undefined, { actionLabel: graph.header.name, actorLabel: beforeActor.name }));
    }
  }

  if (result.rolls.test !== undefined) {
    const hit = primaryTarget ? result.hitTargetIds.includes(primaryTarget.id) : undefined;
    const comparison = primaryTarget ? ` contra Defesa ${primaryTarget.defense}` : '';
    entries.push(logEntry('roll', `${beforeActor.name} — ${graph.header.name}: teste de acerto ${result.rolls.test}${comparison}${hit === undefined ? '' : hit ? ' — SUCESSO.' : ' — FALHA.'}`,
      undefined, { actionLabel: graph.header.name, actorLabel: beforeActor.name, targetLabel: primaryTarget?.name, outcome: hit === undefined ? undefined : hit ? 'success' : 'failure' }));
  } else {
    entries.push(logEntry('roll', `${beforeActor.name} usa ${graph.header.name}${primaryTarget ? ` em ${primaryTarget.name}` : ''}.`,
      undefined, { actionLabel: graph.header.name, actorLabel: beforeActor.name, targetLabel: primaryTarget?.name }));
  }

  for (const before of beforeTargets) {
    const hit = result.hitTargetIds.includes(before.id);
    if (!hit) {
      entries.push(logEntry('system', `${before.name} evita ${graph.header.name}.`,
        undefined, { actionLabel: graph.header.name, actorLabel: beforeActor.name, targetLabel: before.name, outcome: 'failure' }));
      continue;
    }
    const after = result.targets.find(target => target.id === before.id)
      ?? result.additionalTargets.find(target => target.id === before.id)
      ?? result.areaTargets.find(target => target.id === before.id);
    if (!after) continue;
    const hpDelta = after.currentHp - before.currentHp;
    const auraDelta = after.currentAura - before.currentAura;
    if (hpDelta < 0) entries.push(logEntry('damage', `${before.name} sofre ${Math.abs(hpDelta)} de dano${graph.header.element ? ` de ${graph.header.element}` : ''}.`,
      undefined, { actionLabel: graph.header.name, actorLabel: beforeActor.name, targetLabel: before.name, amount: Math.abs(hpDelta), resource: 'HP', damageType: graph.header.element ?? undefined, outcome: 'success' }));
    if (hpDelta > 0) entries.push(logEntry('damage', `${before.name} recupera ${hpDelta} de vida.`,
      undefined, { actionLabel: graph.header.name, actorLabel: beforeActor.name, targetLabel: before.name, amount: hpDelta, resource: 'HP', outcome: 'success' }));
    if (auraDelta !== 0) entries.push(logEntry('system', `${before.name} ${auraDelta > 0 ? 'recupera' : 'perde'} ${Math.abs(auraDelta)} de aura.`,
      undefined, { actionLabel: graph.header.name, actorLabel: beforeActor.name, targetLabel: before.name, amount: Math.abs(auraDelta), resource: 'Aura' }));
    const beforeEffectIds = new Set(before.effects.map(active => active.effect.id));
    for (const active of after.effects) {
      if (beforeEffectIds.has(active.effect.id)) continue;
      const duration = active.remaining ?? active.effect.duration.amount;
      entries.push(logEntry('condition', `${before.name} recebe ${active.effect.name}${duration ? ` (${duration} rodada${duration === 1 ? '' : 's'})` : ''}.`,
        undefined, { actionLabel: graph.header.name, actorLabel: beforeActor.name, targetLabel: before.name, sourceLabel: active.effect.name, durationLabel: duration ? `${duration} rodada${duration === 1 ? '' : 's'}` : undefined, outcome: 'applied' }));
    }
  }

  return entries;
}
