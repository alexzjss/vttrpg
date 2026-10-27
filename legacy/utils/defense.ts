import type { Character } from '../types';

export const DEFENSE_SCHEMA_VERSION = 2;
export const DEFAULT_DEFENSE_REDUCTION = 0.2;
export const DEFAULT_DEFENSE_ACTIVATION_THRESHOLD = 0.2;
export const DEFAULT_STAGGER_MAX = 100;
export const DEFAULT_STAGGER_RECOVERY = 15;
export const DEFAULT_STAGGER_DAMAGE_MULTIPLIER = 1.4;
export const DEFAULT_STAGGER_DURATION = 1;
export const STAGGER_EXIT_RATIO = 0.4;
export const STAGGER_RESTORE_RECOVERY_RATIO = 0.25;

export interface DefenseStats {
  defense?: number;
  defenseMax: number;
  defenseCurrent: number;
  defenseReduction: number;
  defenseRegeneration: number;
  defenseActivationThreshold: number;
  staggerMax: number;
  staggerCurrent: number;
  staggerRecovery: number;
  staggerDamageMultiplier: number;
  staggerDuration: number;
  isDefenseBroken: boolean;
  isStaggered: boolean;
  staggerTurnsRemaining: number;
}

export interface DefenseResolutionResult {
  healthDamage: number;
  defenseDamage: number;
  staggerDamage: number;
  defenseBroken: boolean;
  defenseRestored: boolean;
  enteredStaggered: boolean;
  exitedStaggered: boolean;
  skippedTurn: boolean;
  previousDefense: number;
  currentDefense: number;
  previousStagger: number;
  currentStagger: number;
  target: DefenseStats;
  events: Array<'defense-break' | 'defense-restored' | 'stagger-enter' | 'stagger-exit' | 'turn-skipped'>;
}

const finite = (value: unknown, fallback: number): number =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;
const nonNegative = (value: unknown, fallback: number): number => Math.max(0, finite(value, fallback));
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export function defaultDefenseStats(oldDefense = 10): DefenseStats {
  const defenseMax = Math.max(10, Math.floor(nonNegative(oldDefense, 10) * 2));
  return {
    defense: nonNegative(oldDefense, 10),
    defenseMax,
    defenseCurrent: defenseMax,
    defenseReduction: DEFAULT_DEFENSE_REDUCTION,
    defenseRegeneration: Math.max(1, Math.floor(defenseMax * 0.1)),
    defenseActivationThreshold: DEFAULT_DEFENSE_ACTIVATION_THRESHOLD,
    staggerMax: DEFAULT_STAGGER_MAX,
    staggerCurrent: 0,
    staggerRecovery: DEFAULT_STAGGER_RECOVERY,
    staggerDamageMultiplier: DEFAULT_STAGGER_DAMAGE_MULTIPLIER,
    staggerDuration: DEFAULT_STAGGER_DURATION,
    isDefenseBroken: false,
    isStaggered: false,
    staggerTurnsRemaining: 0,
  };
}

export function normalizeDefenseStats<T extends Partial<DefenseStats>>(input: T): T & DefenseStats {
  const defaults = defaultDefenseStats(input.defense);
  const defenseMax = nonNegative(input.defenseMax, defaults.defenseMax);
  const staggerMax = nonNegative(input.staggerMax, defaults.staggerMax);
  const defenseCurrent = clamp(nonNegative(input.defenseCurrent, defaults.defenseCurrent), 0, defenseMax);
  const staggerCurrent = clamp(nonNegative(input.staggerCurrent, defaults.staggerCurrent), 0, staggerMax);
  return {
    ...input,
    defense: nonNegative(input.defense, defaults.defense ?? 10),
    defenseMax,
    defenseCurrent,
    defenseReduction: nonNegative(input.defenseReduction, defaults.defenseReduction),
    defenseRegeneration: nonNegative(input.defenseRegeneration, defaults.defenseRegeneration),
    defenseActivationThreshold: nonNegative(input.defenseActivationThreshold, defaults.defenseActivationThreshold),
    staggerMax,
    staggerCurrent,
    staggerRecovery: nonNegative(input.staggerRecovery, defaults.staggerRecovery),
    staggerDamageMultiplier: nonNegative(input.staggerDamageMultiplier, defaults.staggerDamageMultiplier),
    staggerDuration: Math.max(0, Math.floor(nonNegative(input.staggerDuration, defaults.staggerDuration))),
    isDefenseBroken: Boolean(input.isDefenseBroken),
    isStaggered: Boolean(input.isStaggered),
    staggerTurnsRemaining: Math.max(0, Math.floor(nonNegative(input.staggerTurnsRemaining, 0))),
  };
}

export function migrateCharacterDefense<T extends Partial<Character>>(character: T): T & DefenseStats {
  const hasDefenseState = [
    character.defenseMax, character.defenseCurrent, character.defenseReduction, character.defenseRegeneration,
    character.defenseActivationThreshold, character.staggerMax, character.staggerCurrent, character.staggerRecovery,
    character.staggerDamageMultiplier, character.staggerDuration, character.isDefenseBroken, character.isStaggered,
    character.staggerTurnsRemaining,
  ].some(value => value !== undefined);
  return normalizeDefenseStats(hasDefenseState
    ? { ...defaultDefenseStats(character.defense), ...character }
    : { ...character, ...defaultDefenseStats(character.defense) });
}

export function isDefenseActive(target: DefenseStats): boolean {
  const c = normalizeDefenseStats(target);
  return c.defenseMax > 0
    && c.defenseCurrent > 0
    && !c.isDefenseBroken
    && c.defenseCurrent >= c.defenseMax * c.defenseActivationThreshold;
}

export const calculateHealthDamage = (damageValue: number, target: DefenseStats): number => {
  const c = normalizeDefenseStats(target);
  const base = Math.max(0, finite(damageValue, 0));
  // Staggered sempre significa dano amplificado — nunca reduzido pela Defesa, mesmo que ela já tenha regenerado.
  if (c.isStaggered) return Math.max(0, Math.floor(base * c.staggerDamageMultiplier));
  const reduced = isDefenseActive(c) ? base * (1 - c.defenseReduction) : base;
  return Math.max(0, Math.floor(reduced));
};

export const calculateDefenseDamage = (impactValue: number, target: DefenseStats): number =>
  isDefenseActive(target) ? Math.max(0, Math.floor(finite(impactValue, 0))) : 0;

export const calculateStaggerDamage = (impactValue: number, target: DefenseStats): number =>
  !isDefenseActive(target) ? Math.max(0, Math.floor(finite(impactValue, 0))) : 0;

export function applyHealthDamage<T extends { currentHp: number; maxHp: number }>(target: T, amount: number): T {
  return { ...target, currentHp: clamp(nonNegative(target.currentHp, 0) - nonNegative(amount, 0), 0, nonNegative(target.maxHp, 0)) };
}

export function applyDefenseDamage<T extends DefenseStats>(target: T, amount: number): T {
  const c = normalizeDefenseStats(target);
  return { ...c, defenseCurrent: clamp(c.defenseCurrent - nonNegative(amount, 0), 0, c.defenseMax) } as T;
}

export function applyStaggerDamage<T extends DefenseStats>(target: T, amount: number): T {
  const c = normalizeDefenseStats(target);
  return { ...c, staggerCurrent: clamp(c.staggerCurrent + nonNegative(amount, 0), 0, c.staggerMax) } as T;
}

export function breakDefense<T extends DefenseStats>(target: T): T {
  return { ...normalizeDefenseStats(target), defenseCurrent: 0, isDefenseBroken: true } as T;
}

export function restoreDefense<T extends DefenseStats>(target: T): T {
  const c = normalizeDefenseStats(target);
  return {
    ...c,
    isDefenseBroken: false,
    staggerCurrent: clamp(c.staggerCurrent - c.staggerMax * STAGGER_RESTORE_RECOVERY_RATIO, 0, c.staggerMax),
  } as T;
}

export function enterStaggeredState<T extends DefenseStats>(target: T): T {
  const c = normalizeDefenseStats(target);
  return { ...c, isStaggered: true, staggerTurnsRemaining: c.staggerDuration } as T;
}

export function exitStaggeredState<T extends DefenseStats>(target: T): T {
  const c = normalizeDefenseStats(target);
  return { ...c, isStaggered: false, staggerCurrent: clamp(c.staggerMax * STAGGER_EXIT_RATIO, 0, c.staggerMax), staggerTurnsRemaining: 0 } as T;
}

export function regenerateDefense<T extends DefenseStats>(target: T): T {
  const c = normalizeDefenseStats(target);
  return { ...c, defenseCurrent: clamp(c.defenseCurrent + c.defenseRegeneration, 0, c.defenseMax) } as T;
}

export function recoverStagger<T extends DefenseStats>(target: T): T {
  const c = normalizeDefenseStats(target);
  return { ...c, staggerCurrent: clamp(c.staggerCurrent - c.staggerRecovery, 0, c.staggerMax) } as T;
}

export function processDefenseOverflow(defenseBefore: number, impactValue: number): number {
  return Math.max(0, Math.floor(finite(impactValue, 0)) - Math.max(0, Math.floor(finite(defenseBefore, 0))));
}

function result(previous: DefenseStats, target: DefenseStats, patch: Partial<DefenseResolutionResult>): DefenseResolutionResult {
  return {
    healthDamage: 0, defenseDamage: 0, staggerDamage: 0,
    defenseBroken: false, defenseRestored: false, enteredStaggered: false, exitedStaggered: false, skippedTurn: false,
    previousDefense: previous.defenseCurrent, currentDefense: target.defenseCurrent,
    previousStagger: previous.staggerCurrent, currentStagger: target.staggerCurrent,
    target, events: [], ...patch,
  };
}

export function resolveDefenseHit<T extends DefenseStats>(target: T, damageValue: number, impactValue = damageValue): DefenseResolutionResult {
  const previous = normalizeDefenseStats(target);
  let next = { ...previous };
  const active = isDefenseActive(previous);
  const healthDamage = calculateHealthDamage(damageValue, previous);
  let defenseDamage = 0;
  let staggerDamage = 0;
  const events: DefenseResolutionResult['events'] = [];

  if (active) {
    defenseDamage = Math.min(previous.defenseCurrent, calculateDefenseDamage(impactValue, previous));
    const overflow = processDefenseOverflow(previous.defenseCurrent, impactValue);
    next = applyDefenseDamage(next, defenseDamage);
    if (next.defenseCurrent <= 0) {
      next = breakDefense(next);
      events.push('defense-break');
      staggerDamage = overflow;
      next = applyStaggerDamage(next, staggerDamage);
    }
  } else {
    staggerDamage = calculateStaggerDamage(impactValue, previous);
    next = applyStaggerDamage(next, staggerDamage);
  }

  let enteredStaggered = false;
  if (!next.isStaggered && next.staggerMax > 0 && next.staggerCurrent >= next.staggerMax) {
    next = enterStaggeredState(next);
    enteredStaggered = true;
    events.push('stagger-enter');
  }

  return result(previous, next, {
    healthDamage, defenseDamage, staggerDamage,
    defenseBroken: events.includes('defense-break'),
    enteredStaggered, events,
  });
}

export function processDefenseRound<T extends DefenseStats>(target: T): DefenseResolutionResult {
  const previous = normalizeDefenseStats(target);
  let next = recoverStagger(regenerateDefense(previous));
  const events: DefenseResolutionResult['events'] = [];
  let defenseRestored = false;
  if (next.isDefenseBroken && !next.isStaggered && next.defenseMax > 0 && next.defenseCurrent >= next.defenseMax * next.defenseActivationThreshold) {
    next = restoreDefense(next);
    defenseRestored = true;
    events.push('defense-restored');
  }
  return result(previous, next, { defenseRestored, events });
}

export function processStaggeredTurn<T extends DefenseStats>(target: T): DefenseResolutionResult {
  const previous = normalizeDefenseStats(target);
  let next = previous;
  const events: DefenseResolutionResult['events'] = [];
  let skippedTurn = false;
  let exitedStaggered = false;
  if (next.isStaggered && next.staggerTurnsRemaining > 0) {
    next = { ...next, staggerTurnsRemaining: next.staggerTurnsRemaining - 1 };
    skippedTurn = true;
    events.push('turn-skipped');
    if (next.staggerTurnsRemaining <= 0) {
      next = exitStaggeredState(next);
      exitedStaggered = true;
      events.push('stagger-exit');
    }
  }
  return result(previous, next, { skippedTurn, exitedStaggered, events });
}
