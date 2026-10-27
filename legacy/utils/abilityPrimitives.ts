import type { Element } from '../types';
import type { ArsenalActorState } from './arsenalPipeline';
import { applyActiveEffect as stackEffect, hasDynamicDefense } from './arsenalPipeline';
import type { ArsenalEffect } from './arsenal';
import { normalizeDefenseStats, resolveDefenseHit } from './defense';
import { effectiveResourceMax } from './effectModifiers';

type Roller = (notation: string) => number;

function activeAffinityState(target: ArsenalActorState, element: Element | null) {
  if (!element) return undefined;
  for (const active of target.effects) {
    const match = (active.effect.elementalAffinities ?? []).find(a => a.element === element);
    if (match) return { active, affinity: match };
  }
  return undefined;
}

/** Elemento convertido pela primeira conversão ativa que casa 'from' (ou 'qualquer') com o elemento recebido. */
function convertElement(target: ArsenalActorState, element: Element | null): Element | null {
  if (!element) return element;
  for (const active of target.effects) {
    const conv = active.effect.damageConversion;
    if (conv && (conv.from === 'qualquer' || conv.from === element)) return conv.to;
  }
  return element;
}

/** Amplifica o dano com a primeira marca de vulnerabilidade ativa e a consome (efeito removido nesse hit). */
function consumeMarkVulnerable(target: ArsenalActorState, amount: number): number {
  if (amount <= 0) return amount;
  const index = target.effects.findIndex(a => !!a.effect.markVulnerable);
  if (index < 0) return amount;
  const amplifyPercent = target.effects[index].effect.markVulnerable!.amplifyPercent;
  target.effects.splice(index, 1);
  return Math.ceil(amount * (1 + amplifyPercent / 100));
}

export interface DamageResult { target: ArsenalActorState; appliedDamage: number; }

/** Soma os deltas de guarda/stagger de todos os efeitos ativos (buff/debuff v2 — ver ArsenalEffect.guardModifiers). */
function sumGuardModifiers(effects: ArsenalActorState['effects']) {
  return effects.reduce((acc, active) => {
    const g = active.effect.guardModifiers;
    if (!g) return acc;
    const stacks = Math.max(1, active.stacks ?? 1);
    return {
      defenseReductionDelta: acc.defenseReductionDelta + (g.defenseReductionDelta ?? 0) * stacks,
      defenseRegenerationDelta: acc.defenseRegenerationDelta + (g.defenseRegenerationDelta ?? 0) * stacks,
      staggerMaxDelta: acc.staggerMaxDelta + (g.staggerMaxDelta ?? 0) * stacks,
      staggerRecoveryDelta: acc.staggerRecoveryDelta + (g.staggerRecoveryDelta ?? 0) * stacks,
      staggerDamageMultiplierDelta: acc.staggerDamageMultiplierDelta + (g.staggerDamageMultiplierDelta ?? 0) * stacks,
    };
  }, { defenseReductionDelta: 0, defenseRegenerationDelta: 0, staggerMaxDelta: 0, staggerRecoveryDelta: 0, staggerDamageMultiplierDelta: 0 });
}

/** Absorve dano com o primeiro efeito ativo que tenha escudo; consome o escudo até esgotar. Muta `target.effects` in-place (já é uma cópia local em applyDamage). */
function consumeShield(target: ArsenalActorState, amount: number): number {
  if (amount <= 0) return amount;
  const active = target.effects.find(a => (a.effect.shield?.flat ?? 0) > 0);
  if (!active) return amount;
  const available = active.effect.shield!.flat;
  const absorbed = Math.min(available, amount);
  active.effect = { ...active.effect, shield: { flat: available - absorbed } };
  return amount - absorbed;
}

/** Aplica dano a um alvo com interações elementais e afinidade — paridade com arsenalPipeline.
 *  `piercing` (perfurante) ignora a barra de Defesa: o dano vai direto pro HP, sem redução nem consumir o escudo. */
export function applyDamage(target: ArsenalActorState, rawAmount: number, element: Element | null, roller: Roller, piercing = false): DamageResult {
  void roller;
  const next: ArsenalActorState = { ...target, effects: target.effects.map(a => ({ ...a })) };
  let amount = Math.max(0, rawAmount);
  amount = consumeMarkVulnerable(next, amount);
  const effectiveElement = convertElement(next, element);
  const affinityMatch = activeAffinityState(next, effectiveElement);
  if (affinityMatch && amount > 0) {
    const { affinity } = affinityMatch;
    if (affinity.kind === 'imunidade') amount = 0;
    else if (affinity.kind === 'resistencia') amount = Math.max(0, Math.floor(amount * (1 - affinity.percent / 100)));
    else if (affinity.kind === 'vulnerabilidade') amount = Math.ceil(amount * (1 + affinity.percent / 100));
    else if (affinity.kind === 'absorcao') amount = 0; // absorção vira cura no chamador; núcleo trata como 0 dano
    if (affinity.consumeOnUse) next.effects = next.effects.filter(a => a !== affinityMatch.active);
  }
  amount = consumeShield(next, amount);
  if (!piercing && hasDynamicDefense(next)) {
    const baseStats = normalizeDefenseStats(next);
    const guardDelta = sumGuardModifiers(next.effects);
    const adjustedStats = {
      ...baseStats,
      defenseReduction: Math.max(0, baseStats.defenseReduction + guardDelta.defenseReductionDelta),
      defenseRegeneration: Math.max(0, baseStats.defenseRegeneration + guardDelta.defenseRegenerationDelta),
      staggerMax: Math.max(1, baseStats.staggerMax + guardDelta.staggerMaxDelta),
      staggerRecovery: Math.max(0, baseStats.staggerRecovery + guardDelta.staggerRecoveryDelta),
      staggerDamageMultiplier: Math.max(0, baseStats.staggerDamageMultiplier + guardDelta.staggerDamageMultiplierDelta),
    };
    const defenseResult = resolveDefenseHit(adjustedStats, amount, amount);
    amount = defenseResult.healthDamage;
    next.defenseCurrent = defenseResult.currentDefense;
    next.staggerCurrent = defenseResult.currentStagger;
    next.isDefenseBroken = defenseResult.target.isDefenseBroken;
    next.isStaggered = defenseResult.target.isStaggered;
    next.staggerTurnsRemaining = defenseResult.target.staggerTurnsRemaining;
  }
  const applied = Math.min(next.currentHp, amount);
  next.currentHp = Math.max(0, next.currentHp - applied);
  return { target: next, appliedDamage: applied };
}

export function applyHeal(target: ArsenalActorState, amount: number): DamageResult {
  const next = { ...target };
  const effectiveMax = effectiveResourceMax(next, 'vida_maxima');
  const applied = Math.min(effectiveMax - next.currentHp, Math.max(0, amount));
  next.currentHp += applied;
  return { target: next, appliedDamage: -applied };
}

/** Restaura Aura — mesma semântica de applyHeal, mas sobre currentAura/maxAura. */
export function applyAuraRestore(target: ArsenalActorState, amount: number): DamageResult {
  const next = { ...target };
  const effectiveMax = effectiveResourceMax(next, 'aura_maxima');
  const applied = Math.min(effectiveMax - next.currentAura, Math.max(0, amount));
  next.currentAura += applied;
  return { target: next, appliedDamage: -applied };
}

function isImmuneTo(target: ArsenalActorState, effect: ArsenalEffect): boolean {
  const nameKey = effect.name.toLocaleLowerCase('pt-BR');
  return target.effects.some(a => (a.effect.immunities ?? []).some(im => im === effect.id || im.toLocaleLowerCase('pt-BR') === nameKey));
}

/** Empilha um efeito/condição no alvo respeitando imunidade. `sourceId` (normalmente o id de quem
 *  aplicou) é necessário pra filtros `onlySource`/`sourceEntityId` (ex.: Marcado, Exposto) funcionarem
 *  quando o efeito for lido depois pelo motor de modificadores. */
export function applyCondition(target: ArsenalActorState, effect: ArsenalEffect, roller: Roller, sourceId?: string): ArsenalActorState {
  void roller;
  if (isImmuneTo(target, effect)) return target;
  return { ...target, effects: stackEffect(target.effects, effect, sourceId) };
}

export type EffectPolarity = 'positivo' | 'negativo' | 'qualquer';

function isNegativeEffect(effect: ArsenalEffect): boolean {
  return effect.modifiers.some(m => m.value < 0)
    || effect.attackModifier < 0 || effect.defenseModifier < 0 || effect.speedModifier < 0
    || !!effect.periodicDamage || !!effect.auraConsumed
    || !!effect.incapacitate || !!effect.blocksReaction || !!effect.silence
    || !!effect.attackPenaltyAgainstSource || !!effect.grantsAttackerBonus
    || (effect.diceBonuses ?? []).some(bonus => bonus.disadvantage)
    || (effect.elementalAffinities ?? []).some(a => a.kind === 'vulnerabilidade');
}

export interface RemoveEffectsResult { target: ArsenalActorState; removedNames: string[] }

/** Remove os `quantidade` efeitos mais recentes do alvo que casem com `categoria` (heurística: negativo = tem
 *  condição clássica OU algum modifier com valor negativo; positivo = nem um nem outro). */
export function removeActiveEffects(target: ArsenalActorState, categoria: EffectPolarity, quantidade: number): RemoveEffectsResult {
  if (quantidade <= 0) return { target, removedNames: [] };
  const eligible = target.effects.filter(active =>
    categoria === 'qualquer' ? true : categoria === 'negativo' ? isNegativeEffect(active.effect) : !isNegativeEffect(active.effect));
  const toRemove = eligible.slice(-quantidade);
  const removeIds = new Set(toRemove.map(active => active.effect.id));
  return {
    target: { ...target, effects: target.effects.filter(active => !removeIds.has(active.effect.id)) },
    removedNames: [...toRemove].reverse().map(active => active.effect.name),
  };
}
