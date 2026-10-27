import type { Card, Character, DamageType, Seal, Weapon } from '../types';
import type { ResolvedItem } from './items';
import type { ArsenalCard, ArsenalEffect } from './arsenal';
import type { AbilityGraph } from './abilityGraph';
import { mergeLevel } from './abilityGraph';
import { graphCosts } from './abilityGraphAction';
import { normalizeDefenseStats, resolveDefenseHit, type DefenseResolutionResult, type DefenseStats } from './defense';

export type ActionCategory = 'atacar' | 'habilidade' | 'item';

export interface ResolvedAction {
  source: 'card' | 'seal' | 'weapon' | 'item' | 'guard' | 'arsenal';
  id: string;
  name: string;
  category: ActionCategory;
  diceRoll: string;
  damage?: number;
  damageValue?: number;
  impactValue?: number;
  damageType?: DamageType;
  healHp?: number;
  healAura?: number;
  conditionName?: string;
  conditionDuration?: number;
  auraCost?: number;
  ammoCost?: number;
  targeting: 'self' | 'other';
  arsenalCard?: ArsenalCard;
  /** Habilidade do novo sistema de grafo (mutuamente exclusivo com arsenalCard). */
  abilityGraph?: AbilityGraph;
  abilityGraphLevel?: number;
  /** Habilidades-companhia de um combo armado junto com abilityGraph (ver actorActions/comboAbilityGraphs). */
  comboAbilityGraphs?: { graph: AbilityGraph; level: number }[];
  /** Cartas de combo clássicas (Arsenal) armadas junto com esta: [inicial, ...companheiras]. Ausente/1 item = sem combo. */
  comboArsenalCards?: ArsenalCard[];
  /** Retoma uma carta cujo tempo obrigatório de preparação terminou. */
  resumePreparation?: boolean;
  /** Texto descritivo da fonte original, para exibição no card de detalhes. */
  description?: string;
  /** Arte da carta/arma/item, exibida no cabeçalho do card de detalhes. */
  image?: string;
  item?: ResolvedItem;
  advancedEffects?: ArsenalEffect[];
}

export function normalizeCard(card: Card): ResolvedAction {
  const damageValue = card.damageValue ?? card.damage;
  const category: ActionCategory = card.type === 'ataque' || (damageValue ?? 0) > 0 || (card.impactValue ?? 0) > 0 ? 'atacar' : 'habilidade';
  return {
    source: 'card', id: card.id, name: card.name, category,
    diceRoll: card.diceRoll ?? '1d20',
    damage: damageValue, damageValue, impactValue: card.impactValue ?? damageValue, damageType: card.damageType,
    conditionName: card.conditionEffect, conditionDuration: card.conditionDuration,
    auraCost: card.auraCost, ammoCost: card.ammoCost,
    targeting: 'other', description: card.description,
    image: card.image,
  };
}

export function normalizeSeal(seal: Seal): ResolvedAction {
  const isHeal = !!(seal.healHp || seal.healAura) && !seal.damage;
  return {
    source: 'seal', id: seal.id, name: seal.name, category: (seal.damage ?? 0) > 0 ? 'atacar' : 'habilidade',
    diceRoll: seal.diceRoll ?? '1d20',
    damage: seal.damage, damageValue: seal.damage, impactValue: seal.damage, damageType: seal.damageType,
    healHp: seal.healHp, healAura: seal.healAura,
    conditionName: seal.conditionEffect, conditionDuration: seal.conditionDuration,
    auraCost: seal.cost?.aura, ammoCost: seal.cost?.ammo,
    targeting: isHeal ? 'self' : 'other', description: seal.description,
    image: seal.image,
    advancedEffects: seal.effects ?? [],
  };
}

export function normalizeWeapon(w: Weapon): ResolvedAction {
  const isHeal = !!w.combatHeal && !w.combatDamage;
  return {
    source: 'weapon', id: w.id, name: w.name, category: 'atacar',
    diceRoll: w.combatDiceRoll ?? '1d20',
    damage: w.combatDamage ?? w.damage, damageValue: w.combatDamage ?? w.damage, impactValue: w.combatDamage ?? w.damage, damageType: w.combatDamageType ?? w.damageType,
    healHp: w.combatHeal,
    conditionName: w.combatConditionEffect, conditionDuration: w.combatConditionDuration,
    ammoCost: w.combatAmmoCost,
    targeting: w.combatTargeting === 'self' || isHeal ? 'self' : 'other', description: w.description,
    image: w.image,
  };
}

export function normalizeItem(i: ResolvedItem): ResolvedAction {
  const isHeal = !!(i.combatHeal || i.combatAuraRecover) && !i.combatDamage;
  return {
    source: 'item', id: i.id, name: i.name, category: 'item',
    diceRoll: i.combatDiceRoll ?? '1d20',
    damage: i.combatDamage, damageValue: i.combatDamage, impactValue: i.combatDamage, damageType: i.combatDamageType,
    healHp: i.combatHeal, healAura: i.combatAuraRecover,
    conditionName: i.combatConditionEffect, conditionDuration: i.combatConditionDuration,
    auraCost: i.combatAuraCost,
    ammoCost: i.combatAmmoCost,
    targeting: i.combatTargeting === 'self' || isHeal ? 'self' : 'other', description: i.description,
    image: i.image,
    item: i,
    advancedEffects: i.effects ?? [],
  };
}

export function normalizeArsenalCard(card: ArsenalCard): ResolvedAction {
  const category: ActionCategory = card.category === 'item' ? 'item'
    : card.category === 'arma' ? 'atacar'
    : arsenalCardCausesDamage(card) ? 'atacar' : 'habilidade';
  return {
    source:'arsenal', id:card.id, name:card.name, category,
    diceRoll:card.testDice??'1d20', damage:card.damage?.flat, damageValue: card.damage?.flat, impactValue: (card as any).impact?.flat ?? card.damage?.flat,
    damageType:card.element??undefined, healHp:card.healing?.flat,
    healAura:card.auraRestored?.flat, auraCost:card.auraConsumed?.flat,
    conditionName:card.effects[0]?.name,
    conditionDuration:card.effects[0]?.duration.amount,
    targeting:card.target.type==='proprio_usuario'?'self':'other', arsenalCard:card,
    description:card.description, image: card.icon || undefined,
  };
}

/** Considera dano direto, dados extras e efeitos que ferem agora ou ao longo do tempo. */
export function arsenalCardCausesDamage(card: ArsenalCard): boolean {
  const hasAmount = (amount: ArsenalCard['damage']): boolean =>
    !!amount && (amount.flat > 0 || !!amount.dice?.trim());
  return hasAmount(card.damage)
    || !!card.extraDamageDice?.trim()
    || card.effects.some(effect => hasAmount(effect.periodicDamage));
}

/** Um nó de dano é alcançável a partir de alguma raiz-gatilho (sem seguir grafo desconexo). */
function abilityGraphCausesDamage(graph: AbilityGraph, level: number): boolean {
  return mergeLevel(graph, level).nodes.some(node => node.type === 'dano');
}

/** Dado de teste exibido na UI: lê o nó 'teste' do grafo mesclado, se houver; senão '1d20' padrão. */
function abilityGraphTestDice(merged: AbilityGraph): string {
  const node = merged.nodes.find(n => n.type === 'teste');
  const props = node?.props as { dice?: string } | undefined;
  return props?.dice || '1d20';
}

export function normalizeAbilityGraph(graph: AbilityGraph, level: number): ResolvedAction {
  const merged = mergeLevel(graph, level);
  const category: ActionCategory = abilityGraphCausesDamage(graph, level) ? 'atacar' : 'habilidade';
  const costs = graphCosts(graph, level);
  return {
    source: 'arsenal', id: graph.id, name: merged.header.name, category,
    diceRoll: abilityGraphTestDice(merged), damageType: merged.header.element ?? undefined,
    auraCost: costs.aura || undefined, ammoCost: costs.municao || undefined,
    targeting: merged.header.target.type === 'proprio_usuario' ? 'self' : 'other',
    abilityGraph: graph, abilityGraphLevel: level,
    description: merged.header.description, image: merged.header.icon || undefined,
  };
}

/** Ação genérica "Guarda" (sempre disponível, alvo si mesmo, sem efeito além do log). */
export const GUARD_ACTION: ResolvedAction = {
  source: 'guard', id: 'guard', name: 'Guarda', category: 'habilidade', diceRoll: '1d20', targeting: 'self',
};

/** Agrupa as ações reais do ator por categoria do menu (GUARDA sempre presente). */
export function actorActions(args: { cards: Card[]; seals: Seal[]; weapons: Weapon[]; items: ResolvedItem[]; arsenalCards?: ArsenalCard[]; abilityGraphs?: { graph: AbilityGraph; level: number }[] }): Record<ActionCategory, ResolvedAction[]> {
  const out: Record<ActionCategory, ResolvedAction[]> = { atacar: [], habilidade: [GUARD_ACTION], item: [] };
  const canonicalIds = new Set((args.arsenalCards??[]).map(card=>card.id));
  for (const w of args.weapons) if(!canonicalIds.has(w.id)) out.atacar.push(normalizeWeapon(w));
  for (const c of args.cards) if(!canonicalIds.has(c.id)) { const a = normalizeCard(c); out[a.category].push(a); }
  for (const s of args.seals) if(!canonicalIds.has(s.id)) { const a = normalizeSeal(s); out[a.category].push(a); }
  for (const i of args.items) if (i.usableInCombat&&!canonicalIds.has(i.id)) out.item.push(normalizeItem(i));
  for (const card of args.arsenalCards??[]) {
    if(card.category==='arma') continue;
    const action=normalizeArsenalCard(card); out[action.category].push(action);
  }
  for (const { graph, level } of args.abilityGraphs??[]) {
    const action=normalizeAbilityGraph(graph, level); out[action.category].push(action);
  }
  return out;
}

import { rollDice, type RollResult } from './dice';
import { DEFAULT_DEFENSE } from '../types';
import type { CenaLogEntry } from './cena';
import { logEntry } from './cena';

export interface StatSnapshot {
  currentHp: number; maxHp: number;
  currentAura: number; maxAura: number;
  currentAmmo: number; maxAmmo: number;
  defense?: number;
  defenseMax?: number;
  defenseCurrent?: number;
  defenseReduction?: number;
  defenseRegeneration?: number;
  defenseActivationThreshold?: number;
  staggerMax?: number;
  staggerCurrent?: number;
  staggerRecovery?: number;
  staggerDamageMultiplier?: number;
  staggerDuration?: number;
  isDefenseBroken?: boolean;
  isStaggered?: boolean;
  staggerTurnsRemaining?: number;
  conditions: { name: string; duration: number }[];
}

export interface StatDelta { hp?: number; aura?: number; ammo?: number }
export interface DefenseDelta {
  defenseCurrent?: number;
  staggerCurrent?: number;
  isDefenseBroken?: boolean;
  isStaggered?: boolean;
  staggerTurnsRemaining?: number;
}

function hasDynamicDefense(target: Partial<DefenseStats>): boolean {
  return target.defenseMax !== undefined
    || target.defenseCurrent !== undefined
    || target.staggerMax !== undefined
    || target.staggerCurrent !== undefined
    || target.isDefenseBroken !== undefined
    || target.isStaggered !== undefined;
}

export interface Resolution {
  blocked?: string;
  success: boolean;
  attackTotal: number;
  actorDelta: StatDelta;
  targetDelta: StatDelta;
  defenseDelta?: DefenseDelta;
  defenseResult?: DefenseResolutionResult;
  conditionApplied?: { name: string; duration: number };
  roll?: RollResult;
  log: CenaLogEntry[];
}

/** Aplica um delta a stats, clampando cada um em [0, max]. */
export function applyStatDelta(
  s: { currentHp: number; maxHp: number; currentAura: number; maxAura: number; currentAmmo: number; maxAmmo: number },
  d: StatDelta,
): { currentHp: number; currentAura: number; currentAmmo: number } {
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
  return {
    currentHp: clamp(s.currentHp + (d.hp ?? 0), s.maxHp),
    currentAura: clamp(s.currentAura + (d.aura ?? 0), s.maxAura),
    currentAmmo: clamp(s.currentAmmo + (d.ammo ?? 0), s.maxAmmo),
  };
}

/** Cura total de mestre: restaura HP/Aura/Munição ao máximo, remove condições/efeitos ativos
 *  e restaura a barra de Defesa ao máximo e o Stagger ao mínimo (zerado, sem quebra nem atordoamento). */
export function resetVitals(c: Character): Partial<Character> {
  const defense = normalizeDefenseStats(c);
  return {
    currentHp: c.maxHp, currentAura: c.maxAura, currentAmmo: c.maxAmmo, conditions: [], activeEffects: [],
    defenseCurrent: defense.defenseMax, staggerCurrent: 0,
    isDefenseBroken: false, isStaggered: false, staggerTurnsRemaining: 0,
  };
}

/** Resolução pura dado o total já rolado (determinística). */
export function computeResolution(
  actorName: string, actor: StatSnapshot,
  targetName: string, target: StatSnapshot,
  action: ResolvedAction, attackTotal: number, rolled?: RollResult,
): Resolution {
  const auraCost = action.auraCost ?? 0;
  const ammoCost = action.ammoCost ?? 0;
  if (actor.currentAura < auraCost) {
    return { blocked: 'Aura insuficiente', success: false, attackTotal: 0, actorDelta: {}, targetDelta: {}, log: [logEntry('system', `${actorName}: Aura insuficiente para ${action.name}.`)] };
  }
  if (actor.currentAmmo < ammoCost) {
    return { blocked: 'Munição insuficiente', success: false, attackTotal: 0, actorDelta: {}, targetDelta: {}, log: [logEntry('system', `${actorName}: Munição insuficiente para ${action.name}.`)] };
  }

  const actorDelta: StatDelta = {};
  if (auraCost) actorDelta.aura = -auraCost;
  if (ammoCost) actorDelta.ammo = -ammoCost;

  const log: CenaLogEntry[] = [];
  const isSelf = action.targeting === 'self';
  const damageValue = action.damageValue ?? action.damage ?? 0;
  const impactValue = action.impactValue ?? damageValue;
  const hasDamage = damageValue > 0 || impactValue > 0;
  const rollData = rolled ? {
    notation: rolled.notation,
    total: rolled.total,
    individualRolls: rolled.individualRolls,
    numSides: rolled.numSides,
    bonus: rolled.bonus,
    actorLabel: actorName,
    targetLabel: !isSelf && hasDamage ? targetName : undefined,
    targetValue: !isSelf && hasDamage ? (target.defense ?? DEFAULT_DEFENSE) : undefined,
    success: !isSelf && hasDamage ? attackTotal >= (target.defense ?? DEFAULT_DEFENSE) : true,
  } : undefined;

  let success = true;
  if (!isSelf && hasDamage) {
    const def = target.defense ?? DEFAULT_DEFENSE;
    success = attackTotal >= def;
    log.push(logEntry('roll', `${actorName} usa ${action.name}: rola ${attackTotal} vs defesa ${def} — ${success ? 'ACERTO' : 'ERRO'}.`, rollData));
  } else {
    log.push(logEntry('roll', `${actorName} usa ${action.name}: rola ${attackTotal}.`, rollData));
  }

  const targetDelta: StatDelta = {};
  let conditionApplied: { name: string; duration: number } | undefined;
  let defenseResult: DefenseResolutionResult | undefined;
  if (success) {
    if (hasDamage) {
      if (hasDynamicDefense(target)) {
        defenseResult = resolveDefenseHit(normalizeDefenseStats(target as DefenseStats), damageValue, impactValue);
        targetDelta.hp = -defenseResult.healthDamage;
        if (defenseResult.healthDamage > 0) log.push(logEntry('damage', `${targetName} recebeu ${defenseResult.healthDamage} de dano${action.damageType ? ` (${action.damageType})` : ''}.`));
        if (defenseResult.defenseDamage > 0) log.push(logEntry('damage', `${targetName} perdeu ${defenseResult.defenseDamage} pontos de Defesa.`));
        if (defenseResult.defenseBroken) log.push(logEntry('condition', `A Defesa de ${targetName} foi quebrada.`));
        if (defenseResult.staggerDamage > 0) log.push(logEntry('damage', `${targetName} recebeu ${defenseResult.staggerDamage} pontos de Stagger.`));
        if (defenseResult.enteredStaggered) log.push(logEntry('condition', `${targetName} ficou Desnorteado.`));
      } else {
        targetDelta.hp = -damageValue;
        log.push(logEntry('damage', `${targetName} sofre ${damageValue} de dano${action.damageType ? ` (${action.damageType})` : ''}.`));
      }
    }
    if (action.healHp) {
      targetDelta.hp = (targetDelta.hp ?? 0) + action.healHp;
      log.push(logEntry('damage', `${targetName} recupera ${action.healHp} de HP.`));
    }
    if (action.healAura) {
      targetDelta.aura = (targetDelta.aura ?? 0) + action.healAura;
      log.push(logEntry('damage', `${targetName} recupera ${action.healAura} de Aura.`));
    }
    if (action.conditionName) {
      conditionApplied = { name: action.conditionName, duration: action.conditionDuration ?? 1 };
      const duration = action.conditionDuration ?? 1;
      log.push(logEntry('condition', `${targetName} recebe ${action.conditionName} (${duration} rodada${duration === 1 ? '' : 's'}).`, undefined,
        { actionLabel: action.name, actorLabel: actorName, targetLabel: targetName, sourceLabel: action.conditionName, durationLabel: `${duration} rodada${duration === 1 ? '' : 's'}`, outcome: 'applied' }));
    }
  }
  return {
    success, attackTotal, actorDelta, targetDelta, conditionApplied, log, defenseResult,
    defenseDelta: defenseResult ? {
      defenseCurrent: defenseResult.currentDefense,
      staggerCurrent: defenseResult.currentStagger,
      isDefenseBroken: defenseResult.target.isDefenseBroken,
      isStaggered: defenseResult.target.isStaggered,
      staggerTurnsRemaining: defenseResult.target.staggerTurnsRemaining,
    } : undefined,
  };
}

/** Resolve a ação rolando o dado de ataque (default 1d20). */
export function resolveAction(
  actorName: string, actor: StatSnapshot,
  targetName: string, target: StatSnapshot,
  action: ResolvedAction,
): Resolution {
  const roll = rollDice(action.diceRoll || '1d20');
  return { ...computeResolution(actorName, actor, targetName, target, action, roll.total, roll), roll };
}
