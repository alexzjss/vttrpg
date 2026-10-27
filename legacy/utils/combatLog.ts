import type { RollResult } from './dice';
import type { ArsenalCard, EffectDuration } from './arsenal';
import type { ActionResolutionResult, ArsenalActorState, ActiveEffectState } from './arsenalPipeline';
import { logEntry, type CenaLogEntry } from './cena';

function durationLabel(duration: EffectDuration): string {
  if (duration.type === 'permanente') return 'permanente';
  if (duration.type === 'enquanto_equipado') return 'enquanto equipado';
  if (duration.type === 'enquanto_forma_ativa') return 'enquanto a forma estiver ativa';
  const amount = duration.amount ?? 1;
  const unit = duration.type === 'turnos' ? 'turno' : duration.type === 'rodadas' ? 'rodada' : 'uso';
  return `${amount} ${unit}${amount === 1 ? '' : 's'}`;
}

function remainingLabel(active: ActiveEffectState): string | undefined {
  if (active.remaining == null) return undefined;
  return `${active.remaining} restante${active.remaining === 1 ? '' : 's'}`;
}

function rollData(roll: RollResult, actor: string, target: ArsenalActorState | undefined, success: boolean | undefined) {
  return {
    notation: roll.notation, total: roll.total, individualRolls: roll.individualRolls,
    numSides: roll.numSides, bonus: roll.bonus, actorLabel: actor,
    targetLabel: target?.name, targetValue: target?.defense, success,
  };
}

/** Converte o resultado canônico do Arsenal em um relato completo e estável. */
export function buildArsenalCombatLog(input: {
  card: ArsenalCard;
  beforeActor: ArsenalActorState;
  beforeTargets: ArsenalActorState[];
  result: ActionResolutionResult;
  rolls?: RollResult[];
}): CenaLogEntry[] {
  const { card, beforeActor, beforeTargets, result, rolls = [] } = input;
  const entries: CenaLogEntry[] = [];
  const primaryTarget = beforeTargets[0];

  let attackRollClaimed = false;
  rolls.forEach((roll, index) => {
    const isAttack = !attackRollClaimed && !!card.testDice && result.rolls.test !== undefined && roll.total === result.rolls.test;
    if (isAttack) attackRollClaimed = true;
    const conditionFailure = result.status === 'bloqueada' && result.trace.some(item => item.step === 'verificar_condicoes' && item.detail);
    const hit = isAttack && primaryTarget ? result.hitTargetIds.includes(primaryTarget.id) : conditionFailure ? false : undefined;
    const label = isAttack ? 'teste de acerto' : conditionFailure ? 'teste de condição' : `rolagem ${index + 1}`;
    const comparison = isAttack && primaryTarget ? ` contra Defesa ${primaryTarget.defense}` : '';
    entries.push(logEntry('roll', `${beforeActor.name} — ${card.name}: ${label} ${roll.total}${comparison}${hit === undefined ? '' : hit ? ' — SUCESSO.' : ' — FALHA.'}`,
      rollData(roll, beforeActor.name, isAttack ? primaryTarget : undefined, hit),
      { actionLabel: card.name, actorLabel: beforeActor.name, targetLabel: isAttack ? primaryTarget?.name : undefined, outcome: hit === undefined ? undefined : hit ? 'success' : 'failure' }));
  });

  if (!rolls.length) entries.push(logEntry('roll', `${beforeActor.name} usa ${card.name}${primaryTarget ? ` em ${primaryTarget.name}` : ''}.`, undefined,
    { actionLabel: card.name, actorLabel: beforeActor.name, targetLabel: primaryTarget?.name }));

  for (const before of beforeTargets) {
    if (result.status !== 'concluida') continue;
    const after = result.targets.find(target => target.id === before.id);
    if (!after) continue;
    const hit = result.hitTargetIds.includes(before.id);
    if (!hit) {
      entries.push(logEntry('system', `${before.name} evita ${card.name}.`, undefined,
        { actionLabel: card.name, actorLabel: beforeActor.name, targetLabel: before.name, outcome: 'failure' }));
      continue;
    }

    const hpDelta = after.currentHp - before.currentHp;
    const auraDelta = after.currentAura - before.currentAura;
    if (hpDelta < 0) entries.push(logEntry('damage', `${before.name} sofre ${Math.abs(hpDelta)} de dano${card.element ? ` de ${card.element}` : ''}.`, undefined,
      { actionLabel: card.name, actorLabel: beforeActor.name, targetLabel: before.name, amount: Math.abs(hpDelta), resource: 'HP', damageType: card.element ?? undefined }));
    if (hpDelta > 0) entries.push(logEntry('damage', `${before.name} recupera ${hpDelta} de HP.`, undefined,
      { actionLabel: card.name, actorLabel: beforeActor.name, targetLabel: before.name, amount: hpDelta, resource: 'HP' }));
    if (auraDelta > 0) entries.push(logEntry('damage', `${before.name} recupera ${auraDelta} de Aura.`, undefined,
      { actionLabel: card.name, actorLabel: beforeActor.name, targetLabel: before.name, amount: auraDelta, resource: 'Aura' }));
    if (card.damage && hpDelta === 0) entries.push(logEntry('damage', `${before.name} não sofre dano de ${card.name}.`, undefined,
      { actionLabel: card.name, actorLabel: beforeActor.name, targetLabel: before.name, amount: 0, resource: 'HP', damageType: card.element ?? undefined, outcome: 'immune' }));

    const oldEffects = new Map(before.effects.map(active => [active.effect.id, active]));
    for (const active of after.effects) {
      const old = oldEffects.get(active.effect.id);
      if (old && old.stacks === active.stacks && old.remaining === active.remaining) continue;
      const renewed = !!old;
      const stacks = active.stacks > 1 ? `, ${active.stacks} acúmulos` : '';
      const duration = durationLabel(active.effect.duration);
      entries.push(logEntry('condition', `${before.name} ${renewed ? 'renova' : 'recebe'} ${active.effect.name} (${duration}${stacks}).`, undefined,
        { actionLabel: card.name, actorLabel: beforeActor.name, targetLabel: before.name, sourceLabel: active.effect.name,
          durationLabel: duration, remainingLabel: remainingLabel(active), outcome: renewed ? 'renewed' : 'applied' }));
    }
    if (after.currentHp <= 0 && before.currentHp > 0) entries.push(logEntry('system', `${before.name} foi derrotado.`, undefined,
      { actionLabel: card.name, actorLabel: beforeActor.name, targetLabel: before.name, outcome: 'defeated' }));
  }

  const auraCost = Math.max(0, beforeActor.currentAura - result.actor.currentAura);
  if (auraCost > 0) entries.push(logEntry('system', `${beforeActor.name} consome ${auraCost} de Aura para usar ${card.name}.`, undefined,
    { actionLabel: card.name, actorLabel: beforeActor.name, amount: auraCost, resource: 'Aura' }));
  if (result.reason) entries.push(logEntry('system', `${beforeActor.name}: ${result.reason}.`, undefined,
    { actionLabel: card.name, actorLabel: beforeActor.name, targetLabel: primaryTarget?.name, outcome: 'failure' }));
  return entries;
}
