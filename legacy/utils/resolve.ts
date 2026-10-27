import { rollDice, type RollResult } from './dice';
import { DEFAULT_DEFENSE, PRESET_CONDITIONS } from '../types';
import type { Affinity, Condition, Element } from '../types';
import type { BuffStat, CombatProfile, Effect } from './grimoire';
import { affinityMultiplier, elementInteraction, type InteractionResult } from './elements';
import { logEntry, type CenaLogEntry } from './cena';

export type Roller = (notation: string) => RollResult;

export interface StatDelta { hp?: number; aura?: number; ammo?: number }

/** Snapshot mínimo de um combatente para o motor (party ou NPC). */
export interface CombatantSnapshot {
  id: string; name: string;
  currentHp: number; maxHp: number;
  currentAura: number; maxAura: number;
  currentAmmo: number; maxAmmo: number;
  defense?: number;
  conditions: Condition[];
  affinities?: Partial<Record<Element, Affinity>>;
}

/** Ação pronta para resolver (nome da entrada + perfil de combate efetivo). */
export interface ActionInput {
  name: string;
  profile: CombatProfile;
}

// ─────────────────────────────────────────────────────────────────
// Etapa 1 — custos
// ─────────────────────────────────────────────────────────────────
export interface CostResult {
  blocked?: string;
  actorDelta: StatDelta;
  log: CenaLogEntry[];
}

/** Verifica e paga os custos da ação (delta negativo no ator). */
export function payCosts(actor: CombatantSnapshot, action: ActionInput): CostResult {
  const c = action.profile.costs ?? {};
  const fail = (reason: string): CostResult =>
    ({ blocked: reason, actorDelta: {}, log: [logEntry('system', `${actor.name}: ${reason} para ${action.name}.`)] });

  if ((c.aura ?? 0) > actor.currentAura) return fail('Aura insuficiente');
  if ((c.ammo ?? 0) > actor.currentAmmo) return fail('Munição insuficiente');
  if ((c.hp ?? 0) >= actor.currentHp && (c.hp ?? 0) > 0) return fail('HP insuficiente');

  const delta: StatDelta = {};
  if (c.aura) delta.aura = -c.aura;
  if (c.ammo) delta.ammo = -c.ammo;
  if (c.hp) delta.hp = -c.hp;
  return { actorDelta: delta, log: [] };
}

// ─────────────────────────────────────────────────────────────────
// Etapa 2 — acerto (crítico, fumble, reação)
// ─────────────────────────────────────────────────────────────────
export interface AttackOptions {
  /** Buffs de acerto do atacante (soma no total). */
  attackBonus?: number;
  /** Buffs de defesa do alvo (soma na defesa fixa). */
  defenseBonus?: number;
  /** Se o alvo reage: notation da reação; substitui a defesa fixa. */
  reactionDice?: string;
  roll?: Roller;
}

export interface AttackOutcome {
  /** false = ação sem teste (self/sem attackDice): hit é true direto. */
  attempted: boolean;
  roll?: RollResult;
  natural?: number;
  attackTotal?: number;
  defenseValue?: number;
  reactionRoll?: RollResult;
  crit: boolean;
  fumble: boolean;
  hit: boolean;
  log: CenaLogEntry[];
}

function conditionAttackPenalty(conditions: Condition[]): number {
  if (!conditions.some(c => c.name === 'Amaldiçoado')) return 0;
  return PRESET_CONDITIONS.find(p => p.name === 'Amaldiçoado')?.defaultValue ?? 0;
}

/** Rola o teste de acerto contra a defesa efetiva (ou a reação do alvo). */
export function rollAttack(
  actor: CombatantSnapshot,
  target: CombatantSnapshot,
  action: ActionInput,
  opts: AttackOptions = {},
): AttackOutcome {
  const roll = opts.roll ?? rollDice;
  const needsTest = !!action.profile.attackDice && actor.id !== target.id;

  if (!needsTest) {
    return {
      attempted: false, crit: false, fumble: false, hit: true,
      log: [logEntry('roll', `${actor.name} usa ${action.name}.`, undefined, { actionLabel: action.name, actorLabel: actor.name, targetLabel: target.name, outcome: 'success' })],
    };
  }

  const r = roll(action.profile.attackDice!);
  const natural = r.numDice === 1 ? r.individualRolls[0] : undefined;
  const crit = natural !== undefined && natural === r.numSides;
  const fumble = natural === 1;

  const penalty = conditionAttackPenalty(actor.conditions);
  const attackTotal = r.total + (opts.attackBonus ?? 0) - penalty;

  let defenseValue: number;
  let reactionRoll: RollResult | undefined;
  if (opts.reactionDice) {
    reactionRoll = roll(opts.reactionDice);
    defenseValue = reactionRoll.total;
  } else {
    defenseValue = (target.defense ?? DEFAULT_DEFENSE) + (opts.defenseBonus ?? 0);
  }

  const hit = !fumble && (crit || attackTotal >= defenseValue);

  const mods = [
    opts.attackBonus ? `+${opts.attackBonus} bônus` : '',
    penalty ? `−${penalty} Amaldiçoado` : '',
  ].filter(Boolean).join(', ');
  const verdict = fumble ? 'ERRO CRÍTICO (nat 1)' : crit ? 'CRÍTICO!' : hit ? 'ACERTO' : 'ERRO';
  const defLabel = reactionRoll ? `reação ${defenseValue}` : `defesa ${defenseValue}`;
  const log = [logEntry('roll',
    `${actor.name} usa ${action.name}: rola ${attackTotal}${mods ? ` (${mods})` : ''} vs ${defLabel} — ${verdict}.`, {
      notation: r.notation, total: attackTotal, individualRolls: r.individualRolls,
      numSides: r.numSides, bonus: r.bonus + (opts.attackBonus ?? 0) - penalty,
      actorLabel: actor.name, targetLabel: target.name, targetValue: defenseValue, success: hit,
    }, { actionLabel: action.name, actorLabel: actor.name, targetLabel: target.name,
      outcome: fumble ? 'fumble' : crit ? 'critical' : hit ? 'success' : 'failure',
      notes: reactionRoll ? [`Reação: ${reactionRoll.notation} = ${reactionRoll.total}`] : undefined })];

  return { attempted: true, roll: r, natural, attackTotal, defenseValue, reactionRoll, crit, fumble, hit, log };
}

// ─────────────────────────────────────────────────────────────────
// Etapa 3 — efeitos (dano, cura, condições, buffs)
// ─────────────────────────────────────────────────────────────────

/** '5' → flat 5; senão rola a notation. */
function rollAmount(dice: string, roll: Roller): { value: number; rolled?: RollResult } {
  if (/^\s*\d+\s*$/.test(dice)) return { value: parseInt(dice, 10) };
  const r = roll(dice);
  return { value: r.total, rolled: r };
}

/** Adiciona ou renova (maior duração vence) uma condição. */
function upsertCondition(list: Condition[], name: string, duration: number): Condition[] {
  const idx = list.findIndex(c => c.name === name);
  if (idx >= 0) {
    const next = [...list];
    next[idx] = { name, duration: Math.max(next[idx].duration, duration) };
    return next;
  }
  return [...list, { name, duration }];
}

export interface DamageBreakdown {
  dice: string;
  element: Element;
  rolled: RollResult;
  interaction: InteractionResult;
  affinity?: Affinity;
  final: number;
}

export interface EffectsResult {
  damages: DamageBreakdown[];
  targetDelta: StatDelta;
  /** Lista FINAL de condições do alvo (após interações e aplicações). */
  targetConditions: Condition[];
  /** Buffs para o chamador registrar no encounter (alvo = target). */
  buffs: { stat: BuffStat; value: number; duration: number }[];
  log: CenaLogEntry[];
}

export interface EffectOptions {
  crit?: boolean;
  /** Buffs de dano do atacante (soma no dano rolado). */
  damageBonus?: number;
  roll?: Roller;
}

const PROTECT_VALUE = PRESET_CONDITIONS.find(p => p.name === 'Protegido')?.defaultValue ?? 0;

/** Aplica a lista de efeitos de uma ação que conectou no alvo. */
export function applyEffects(
  actorName: string,
  target: CombatantSnapshot,
  effects: Effect[],
  opts: EffectOptions = {},
): EffectsResult {
  const roll = opts.roll ?? rollDice;
  let conditions = [...target.conditions];
  const delta: StatDelta = {};
  const damages: DamageBreakdown[] = [];
  const buffs: EffectsResult['buffs'] = [];
  const log: CenaLogEntry[] = [];

  for (const ef of effects) {
    if (ef.kind === 'damage') {
      const rolled = roll(ef.dice);
      // damageBonus entra ANTES dos multiplicadores (decisão de design):
      // buff de dano é amplificado por fraqueza/interação, como o dado.
      let dmg = (opts.crit ? rolled.dieRoll * 2 + rolled.bonus : rolled.total) + (opts.damageBonus ?? 0);
      const interaction = elementInteraction(ef.element, conditions);
      dmg = Math.floor(dmg * interaction.multiplier) + interaction.flatBonus;
      const affinity = target.affinities?.[ef.element];
      dmg = Math.floor(dmg * affinityMultiplier(affinity));
      const isProtected = conditions.some(c => c.name === 'Protegido');
      const protApplied = isProtected && dmg > 0;
      if (protApplied) dmg = Math.max(0, dmg - PROTECT_VALUE);

      for (const rem of interaction.removeConditions) conditions = conditions.filter(c => c.name !== rem);
      for (const ren of interaction.renewConditions) conditions = upsertCondition(conditions, ren.name, ren.duration);
      for (const add of interaction.addConditions) conditions = upsertCondition(conditions, add.name, add.duration);

      delta.hp = (delta.hp ?? 0) - dmg;
      damages.push({ dice: ef.dice, element: ef.element, rolled, interaction, affinity, final: dmg });

      const affNote = affinity === 'fraco' ? ' — FRAQUEZA!' : affinity === 'resistente' ? ' — resistiu' : affinity === 'imune' ? ' — IMUNE' : '';
      const protNote = protApplied ? ` (Protegido −${PROTECT_VALUE})` : '';
      log.push(logEntry('damage',
        `${target.name} sofre ${dmg} de dano de ${ef.element} [${rolled.notation}: ${rolled.individualRolls.join('+')}]${affNote}${protNote}.`, {
          notation: rolled.notation, total: rolled.total, individualRolls: rolled.individualRolls,
          numSides: rolled.numSides, bonus: rolled.bonus, actorLabel: actorName, targetLabel: target.name, success: dmg > 0,
        }, { actorLabel: actorName, targetLabel: target.name, amount: dmg, resource: 'HP', damageType: ef.element,
          outcome: affinity === 'imune' ? 'immune' : undefined,
          notes: [...interaction.notes, ...(protApplied ? [`Protegido reduziu ${PROTECT_VALUE}`] : [])] }));
      for (const n of interaction.notes) log.push(logEntry('condition', `${n}.`));
    } else if (ef.kind === 'heal') {
      const { value, rolled } = rollAmount(ef.dice, roll);
      delta[ef.stat] = (delta[ef.stat] ?? 0) + value;
      const label = ef.stat === 'hp' ? 'HP' : ef.stat === 'aura' ? 'Aura' : 'Munição';
      log.push(logEntry('damage', `${target.name} recupera ${value} de ${label}.`, rolled ? {
        notation: rolled.notation, total: rolled.total, individualRolls: rolled.individualRolls,
        numSides: rolled.numSides, bonus: rolled.bonus, actorLabel: actorName, targetLabel: target.name, success: true,
      } : undefined, { actorLabel: actorName, targetLabel: target.name, amount: value, resource: label as 'HP' | 'Aura' | 'Munição' }));
    } else if (ef.kind === 'condition') {
      // ef.value é ignorado de propósito na v1: o tick usa os defaults dos presets.
      conditions = upsertCondition(conditions, ef.name, ef.duration);
      log.push(logEntry('condition', `${target.name} recebe ${ef.name} (${ef.duration} rodada(s)).`, undefined,
        { actorLabel: actorName, targetLabel: target.name, sourceLabel: ef.name, durationLabel: `${ef.duration} rodada${ef.duration === 1 ? '' : 's'}`, outcome: 'applied' }));
    } else if (ef.kind === 'buff') {
      buffs.push({ stat: ef.stat, value: ef.value, duration: ef.duration });
      log.push(logEntry('condition', `${target.name} ganha ${ef.value >= 0 ? '+' : ''}${ef.value} de ${ef.stat} por ${ef.duration} rodada(s).`, undefined,
        { actorLabel: actorName, targetLabel: target.name, sourceLabel: ef.stat, durationLabel: `${ef.duration} rodada${ef.duration === 1 ? '' : 's'}`, outcome: 'applied' }));
    }
  }

  return { damages, targetDelta: delta, targetConditions: conditions, buffs, log };
}

// ─────────────────────────────────────────────────────────────────
// Conveniência — resolve as 3 etapas de uma vez ("resolver tudo")
// ─────────────────────────────────────────────────────────────────
export interface FullResolution {
  blocked?: string;
  actorDelta: StatDelta;
  outcome?: AttackOutcome;
  effects?: EffectsResult;
  log: CenaLogEntry[];
}

/**
 * Encadeia custos → acerto → efeitos. A UI passo a passo (Fase 3) chama as
 * etapas individualmente; este wrapper serve o botão "resolver tudo" e testes.
 * Requisitos (checkRequirements) são verificados ANTES, pelo chamador, pois
 * dependem do acervo (holdings) — fora do escopo do snapshot.
 *
 * Os efeitos sempre incidem sobre `target`. Para ações `targeting: 'self'`
 * (auto-buff/cura), o chamador deve passar o próprio ator como `target`.
 */
export function resolveV2(
  actor: CombatantSnapshot,
  target: CombatantSnapshot,
  action: ActionInput,
  opts: AttackOptions & EffectOptions = {},
): FullResolution {
  const costs = payCosts(actor, action);
  if (costs.blocked) return { blocked: costs.blocked, actorDelta: {}, log: costs.log };

  const outcome = rollAttack(actor, target, action, opts);
  const log = [...costs.log, ...outcome.log];
  if (!outcome.hit) return { actorDelta: costs.actorDelta, outcome, log };

  const effects = applyEffects(actor.name, target, action.profile.effects, { ...opts, crit: outcome.crit });
  return { actorDelta: costs.actorDelta, outcome, effects, log: [...log, ...effects.log] };
}
