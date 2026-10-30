/** Defesa (escudo que absorve o dano em Vida) e Stagger (barra que, cheia, deixa o alvo Desnorteado). Funções puras. */

export const DEFAULT_DEFENSE_REDUCTION = 0.2;
export const DEFAULT_DEFENSE_ACTIVATION_THRESHOLD = 0.2;
export const DEFAULT_STAGGER_MAX = 100;
export const DEFAULT_STAGGER_RECOVERY = 15;
export const DEFAULT_STAGGER_DAMAGE_MULTIPLIER = 1.4;
export const DEFAULT_STAGGER_DURATION = 1;
export const STAGGER_EXIT_RATIO = 0.4;
export const STAGGER_RESTORE_RECOVERY_RATIO = 0.25;

export interface Defense {
  /** Valor que o teste de ataque precisa alcançar (o `defense` do legado). */
  armor: number;
  max: number;
  current: number;
  reduction: number;
  regeneration: number;
  activationThreshold: number;
  broken: boolean;
}

export interface Stagger {
  max: number;
  current: number;
  recovery: number;
  damageMultiplier: number;
  duration: number;
  staggered: boolean;
  turnsRemaining: number;
}

export type DefenseEvent = 'defense-break' | 'stagger-enter';

export interface HitResolution {
  /** Dano que chega à Vida. */
  health: number;
  defense: Defense;
  stagger: Stagger;
  events: DefenseEvent[];
}

export interface DefenseRoundResult {
  defense: Defense;
  stagger: Stagger;
  restored: boolean;
}

export interface StaggerTurnResult {
  stagger: Stagger;
  skipped: boolean;
  exited: boolean;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const nonNegativeFloor = (value: number): number => Math.max(0, Math.floor(value));

export function defaultDefense(armor = 10): Defense {
  const max = Math.max(10, Math.floor(armor * 2));
  return {
    armor,
    max,
    current: max,
    reduction: DEFAULT_DEFENSE_REDUCTION,
    regeneration: Math.max(1, Math.floor(max * 0.1)),
    activationThreshold: DEFAULT_DEFENSE_ACTIVATION_THRESHOLD,
    broken: false,
  };
}

export function defaultStagger(): Stagger {
  return {
    max: DEFAULT_STAGGER_MAX,
    current: 0,
    recovery: DEFAULT_STAGGER_RECOVERY,
    damageMultiplier: DEFAULT_STAGGER_DAMAGE_MULTIPLIER,
    duration: DEFAULT_STAGGER_DURATION,
    staggered: false,
    turnsRemaining: 0,
  };
}

export function isDefenseActive(defense: Defense): boolean {
  return defense.max > 0
    && defense.current > 0
    && !defense.broken
    && defense.current >= defense.max * defense.activationThreshold;
}

/** Dano à Vida. Alvo staggered sempre recebe dano amplificado, nunca reduzido pela Defesa. */
export function calculateHealthDamage(damage: number, defense: Defense, stagger: Stagger): number {
  const base = Math.max(0, damage);
  if (stagger.staggered) return nonNegativeFloor(base * stagger.damageMultiplier);
  const reduced = isDefenseActive(defense) ? base * (1 - defense.reduction) : base;
  return nonNegativeFloor(reduced);
}

/** Impacto que vai para a Defesa (só enquanto ela está ativa). */
export function calculateDefenseDamage(impact: number, defense: Defense): number {
  return isDefenseActive(defense) ? nonNegativeFloor(impact) : 0;
}

/** Impacto que vai para o Stagger (só quando a Defesa não está ativa). */
export function calculateStaggerDamage(impact: number, defense: Defense): number {
  return isDefenseActive(defense) ? 0 : nonNegativeFloor(impact);
}

export function regenerateDefense(defense: Defense): Defense {
  return { ...defense, current: clamp(defense.current + defense.regeneration, 0, defense.max) };
}

export function recoverStagger(stagger: Stagger): Stagger {
  return { ...stagger, current: clamp(stagger.current - stagger.recovery, 0, stagger.max) };
}

function addStagger(stagger: Stagger, amount: number): Stagger {
  return { ...stagger, current: clamp(stagger.current + Math.max(0, amount), 0, stagger.max) };
}

function enterStagger(stagger: Stagger): Stagger {
  return { ...stagger, staggered: true, turnsRemaining: stagger.duration };
}

function exitStagger(stagger: Stagger): Stagger {
  return {
    ...stagger,
    staggered: false,
    current: clamp(stagger.max * STAGGER_EXIT_RATIO, 0, stagger.max),
    turnsRemaining: 0,
  };
}

/** Resolve um golpe: `damage` vai para a Vida e `impact` vai para a Defesa (ou para o Stagger, se ela não estiver ativa). */
export function resolveDefenseHit(
  defense: Defense,
  stagger: Stagger,
  damage: number,
  impact = damage,
): HitResolution {
  const health = calculateHealthDamage(damage, defense, stagger);
  const events: DefenseEvent[] = [];
  let nextDefense = defense;
  let nextStagger = stagger;

  if (isDefenseActive(defense)) {
    const defenseDamage = Math.min(defense.current, calculateDefenseDamage(impact, defense));
    const overflow = nonNegativeFloor(impact) - nonNegativeFloor(defense.current);
    nextDefense = { ...nextDefense, current: clamp(nextDefense.current - defenseDamage, 0, nextDefense.max) };
    if (nextDefense.current <= 0) {
      nextDefense = { ...nextDefense, current: 0, broken: true };
      events.push('defense-break');
      nextStagger = addStagger(nextStagger, Math.max(0, overflow));
    }
  } else {
    nextStagger = addStagger(nextStagger, calculateStaggerDamage(impact, defense));
  }

  if (!nextStagger.staggered && nextStagger.max > 0 && nextStagger.current >= nextStagger.max) {
    nextStagger = enterStagger(nextStagger);
    events.push('stagger-enter');
  }

  return { health, defense: nextDefense, stagger: nextStagger, events };
}

/** Fim de rodada: regenera Defesa, recupera Stagger e restaura a Defesa quebrada se atingir o limite de ativação. */
export function processDefenseRound(defense: Defense, stagger: Stagger): DefenseRoundResult {
  let nextDefense = regenerateDefense(defense);
  let nextStagger = recoverStagger(stagger);
  let restored = false;
  if (nextDefense.broken
    && !nextStagger.staggered
    && nextDefense.max > 0
    && nextDefense.current >= nextDefense.max * nextDefense.activationThreshold) {
    nextDefense = { ...nextDefense, broken: false };
    nextStagger = {
      ...nextStagger,
      current: clamp(nextStagger.current - nextStagger.max * STAGGER_RESTORE_RECOVERY_RATIO, 0, nextStagger.max),
    };
    restored = true;
  }
  return { defense: nextDefense, stagger: nextStagger, restored };
}

/** Turno de um alvo staggered: perde o turno e, ao acabar a duração, sai do estado com Stagger parcial. */
export function processStaggeredTurn(stagger: Stagger): StaggerTurnResult {
  let next = stagger;
  let skipped = false;
  let exited = false;
  if (next.staggered && next.turnsRemaining > 0) {
    next = { ...next, turnsRemaining: next.turnsRemaining - 1 };
    skipped = true;
    if (next.turnsRemaining <= 0) {
      next = exitStagger(next);
      exited = true;
    }
  }
  return { stagger: next, skipped, exited };
}
