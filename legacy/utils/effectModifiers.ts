import type { ArsenalActorState } from './arsenalPipeline';
import type {
  ArsenalEffect, ValueModifier, ModifierTarget, ModifierFilter, ModifierContext,
  ModifierTestKind, ModifierDirection, ModifierResource,
  ArsenalTag, AbilityType, ArsenalCategory,
} from './arsenal';
import type { Element } from '../types';

/** Contexto da ação sendo resolvida — de onde os filtros tiram elemento/tags/categoria/contexto/etc.
 *  `actor` é quem "possui" a rolagem sendo modificada (o atacante quando a direção é 'causado', o
 *  defensor quando é 'recebido'); `other` é o outro lado, usado por requiredTargetConditions/hpRange. */
export interface ModifierResolutionContext {
  actor: ArsenalActorState;
  other?: ArsenalActorState;
  element?: Element | null;
  cardId?: string;
  cardTags?: ArsenalTag[];
  category?: ArsenalCategory;
  abilityType?: AbilityType;
  context?: ModifierContext;
  testKind?: ModifierTestKind;
  direction?: ModifierDirection;
  periodic?: boolean;
  critical?: boolean;
  resource?: ModifierResource;
}

const DIE_LADDER = [4, 6, 8, 10, 12, 20];

interface DicePool { count: number; sides: number; bonus: number }

function parseDice(notation: string | undefined | null): DicePool | null {
  if (!notation) return null;
  const match = notation.match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if (!match) return null;
  return { count: parseInt(match[1], 10), sides: parseInt(match[2], 10), bonus: match[3] ? parseInt(match[3], 10) : 0 };
}

function formatDice(pool: DicePool): string {
  if (pool.count <= 0) return '';
  return `${pool.count}d${pool.sides}${pool.bonus ? (pool.bonus > 0 ? `+${pool.bonus}` : `${pool.bonus}`) : ''}`;
}

function stepDieSides(sides: number, steps: number): number {
  const index = DIE_LADDER.indexOf(sides);
  if (index < 0) return sides;
  return DIE_LADDER[Math.min(DIE_LADDER.length - 1, Math.max(0, index + steps))];
}

function matchesFilter(filter: ModifierFilter | undefined, ctx: ModifierResolutionContext, activeSourceId: string | undefined): boolean {
  if (!filter) return true;
  if (filter.elements?.length && (!ctx.element || !filter.elements.includes(ctx.element))) return false;
  if (filter.tags?.length && !filter.tags.some(tag => (ctx.cardTags ?? []).includes(tag))) return false;
  if (filter.categories?.length && (!ctx.category || !filter.categories.includes(ctx.category))) return false;
  if (filter.abilityTypes?.length && (!ctx.abilityType || !filter.abilityTypes.includes(ctx.abilityType))) return false;
  if (filter.cardIds?.length && (!ctx.cardId || !filter.cardIds.includes(ctx.cardId))) return false;
  if (filter.weaponIds?.length && !filter.weaponIds.some(id => ctx.actor.equippedWeaponIds.includes(id))) return false;
  if (filter.formIds?.length && !filter.formIds.some(id => ctx.actor.activeFormIds.includes(id))) return false;
  if (filter.testKinds?.length && (!ctx.testKind || !filter.testKinds.includes(ctx.testKind))) return false;
  if (filter.direction && ctx.direction && filter.direction !== ctx.direction) return false;
  if (filter.periodic != null && !!ctx.periodic !== filter.periodic) return false;
  if (filter.critical != null && !!ctx.critical !== filter.critical) return false;
  if (filter.contexts?.length && !filter.contexts.includes(ctx.context ?? 'normal')) return false;
  if (filter.resource && ctx.resource && filter.resource !== ctx.resource) return false;
  if (filter.sourceEntityId && filter.sourceEntityId !== activeSourceId) return false;
  if (filter.requiredUserConditions?.length) {
    const names = new Set(ctx.actor.effects.map(active => active.effect.name.toLocaleLowerCase('pt-BR')));
    if (!filter.requiredUserConditions.some(name => names.has(name.toLocaleLowerCase('pt-BR')))) return false;
  }
  if (filter.requiredTargetConditions?.length) {
    const names = new Set((ctx.other?.effects ?? []).map(active => active.effect.name.toLocaleLowerCase('pt-BR')));
    if (!filter.requiredTargetConditions.some(name => names.has(name.toLocaleLowerCase('pt-BR')))) return false;
  }
  if (filter.hpRange) {
    const subject = filter.hpRange.subject === 'alvo' ? ctx.other : ctx.actor;
    if (subject && subject.maxHp > 0) {
      const pct = (subject.currentHp / subject.maxHp) * 100;
      if (filter.hpRange.min != null && pct < filter.hpRange.min) return false;
      if (filter.hpRange.max != null && pct > filter.hpRange.max) return false;
    }
  }
  return true;
}

/** Converte os campos antigos de um ArsenalEffect (modifiers/attackModifier/defenseModifier/speedModifier/
 *  reactionModifier/diceBonuses) para o modelo novo, sobre a mesma semântica de sempre — assim efeitos
 *  criados antes deste sistema continuam funcionando sem precisar de migração de dados. */
function legacyToValueModifiers(effect: ArsenalEffect): ValueModifier[] {
  const out: ValueModifier[] = [];
  const legacyFilter = (f?: { damageType?: Element[]; cardIds?: string[]; cardTags?: string[]; categories?: ArsenalCategory[]; abilityTypes?: AbilityType[]; weaponIds?: string[]; sourceEntityId?: string }): ModifierFilter | undefined => {
    if (!f) return undefined;
    return { elements: f.damageType, cardIds: f.cardIds, tags: f.cardTags, categories: f.categories, abilityTypes: f.abilityTypes, weaponIds: f.weaponIds, sourceEntityId: f.sourceEntityId };
  };

  for (const modifier of effect.modifiers ?? []) {
    const filter = legacyFilter(modifier.filter);
    switch (modifier.stat) {
      case 'ataque': out.push({ operation: modifier.operation === 'definir' ? 'definir' : modifier.operation, target: 'teste', value: modifier.value, filter: { ...filter, testKinds: ['ataque'] } }); break;
      case 'defesa': out.push({ operation: modifier.operation === 'definir' ? 'definir' : modifier.operation, target: 'defesa', value: modifier.value, filter }); break;
      case 'velocidade': out.push({ operation: modifier.operation === 'definir' ? 'definir' : modifier.operation, target: 'velocidade', value: modifier.value, filter }); break;
      case 'dano': out.push({ operation: modifier.operation === 'definir' ? 'definir' : modifier.operation, target: 'dano', value: modifier.value, filter: { ...filter, direction: 'causado' } }); break;
      case 'cura': out.push({ operation: modifier.operation === 'definir' ? 'definir' : modifier.operation, target: 'cura', value: modifier.value, filter: { ...filter, direction: 'causado' } }); break;
      case 'vida_maxima': out.push({ operation: modifier.operation === 'definir' ? 'definir' : modifier.operation, target: 'vida_maxima', value: modifier.value, filter }); break;
      case 'aura_maxima': out.push({ operation: modifier.operation === 'definir' ? 'definir' : modifier.operation, target: 'aura_maxima', value: modifier.value, filter }); break;
      case 'aura': out.push({ operation: modifier.operation === 'definir' ? 'definir' : modifier.operation, target: 'custo_aura', value: modifier.value, filter }); break;
      case 'cura_recebida':
        out.push({ operation: 'multiplicar', target: 'cura', value: modifier.operation === 'multiplicar' ? 1 + modifier.value / 100 : modifier.value, filter: { ...filter, resource: 'vida', direction: 'recebido' } });
        break;
      case 'aura_recebida':
        out.push({ operation: 'multiplicar', target: 'cura', value: modifier.operation === 'multiplicar' ? 1 + modifier.value / 100 : modifier.value, filter: { ...filter, resource: 'aura', direction: 'recebido' } });
        break;
    }
  }
  if (effect.attackModifier) out.push({ operation: 'somar', target: 'teste', value: effect.attackModifier, filter: { testKinds: ['ataque'] } });
  if (effect.defenseModifier) out.push({ operation: 'somar', target: 'defesa', value: effect.defenseModifier });
  if (effect.speedModifier) out.push({ operation: 'somar', target: 'velocidade', value: effect.speedModifier });
  if (effect.reactionModifier) out.push({ operation: 'somar', target: 'teste', value: effect.reactionModifier, filter: { testKinds: ['reacao'] } });

  for (const bonus of effect.diceBonuses ?? []) {
    const target: ModifierTarget = bonus.target === 'cura' ? 'cura' : 'dano';
    const filter = legacyFilter(bonus.filter);
    if (bonus.bonusDice) out.push({ operation: 'adicionar_dado', target, dice: bonus.bonusDice, filter });
    if (bonus.bonusFlat) out.push({ operation: 'somar', target, value: bonus.bonusFlat, filter });
    if (bonus.advantage) out.push({ operation: 'vantagem', target, filter });
    if (bonus.disadvantage) out.push({ operation: 'desvantagem', target, filter });
    if (bonus.minimumResult != null) out.push({ operation: 'definir_minimo', target, value: bonus.minimumResult, filter });
  }
  return out;
}

interface CollectedModifier { modifier: ValueModifier; stacks: number; effectName: string }

/** Todos os modificadores de `holder` que batem com `target` e o filtro de cada um contra `ctx`. Cada
 *  efeito ativo entra multiplicado por `stacks`. `includeLegacy` (default true) também converte os campos
 *  antigos (attackModifier/modifiers/diceBonuses/etc.) na hora — desative no motor CLÁSSICO
 *  (arsenalPipeline.ts), que já lê esses campos antigos diretamente por conta própria: incluí-los aqui
 *  de novo faria o mesmo bônus contar duas vezes. O motor de GRAFO nunca lê os campos antigos por conta
 *  própria, então lá o padrão (incluir) é o que faz efeitos antigos continuarem funcionando. */
export function collectValueModifiers(holder: ArsenalActorState, target: ModifierTarget, ctx: ModifierResolutionContext, includeLegacy = true): CollectedModifier[] {
  const results: CollectedModifier[] = [];
  for (const active of holder.effects) {
    const modifiers = includeLegacy ? [...(active.effect.valueModifiers ?? []), ...legacyToValueModifiers(active.effect)] : (active.effect.valueModifiers ?? []);
    for (const modifier of modifiers) {
      if (modifier.target !== target) continue;
      if (!matchesFilter(modifier.filter, ctx, active.sourceId)) continue;
      results.push({ modifier, stacks: Math.max(1, active.stacks), effectName: active.effect.name });
    }
  }
  return results;
}

export interface ModifierResolutionResult {
  total: number;
  steps: string[];
}

/** Resolve um valor (teste, dano, cura, custo, defesa, velocidade, etc.) aplicando, na ordem: valor base
 *  → alterações no pool de dados → rolagem → dado extra → soma/subtração → multiplicação/divisão →
 *  definir (override) → mínimo/máximo. `steps` traz a decomposição legível para o log de combate. */
export function resolveModifiedValue(params: {
  target: ModifierTarget;
  baseDice?: string | null;
  baseFlat: number;
  holder: ArsenalActorState;
  ctx: ModifierResolutionContext;
  roller: (notation: string, label?: string) => number;
  label?: string;
  /** false no motor clássico, que já lê os campos antigos por conta própria — ver collectValueModifiers. */
  includeLegacy?: boolean;
}): ModifierResolutionResult {
  const matches = collectValueModifiers(params.holder, params.target, params.ctx, params.includeLegacy ?? true);
  const steps: string[] = [];
  let dice = parseDice(params.baseDice) ?? { count: 0, sides: 0, bonus: 0 };
  steps.push(`Base: ${dice.count > 0 ? formatDice(dice) : '0'}${params.baseFlat ? ` + ${params.baseFlat}` : ''}`);

  for (const { modifier, stacks, effectName } of matches) {
    if (dice.count <= 0) continue;
    if (modifier.operation === 'remover_dado') {
      const removed = Math.min(dice.count, Math.max(1, Math.floor((modifier.value ?? 1) * stacks)));
      if (removed > 0) { dice = { ...dice, count: dice.count - removed }; steps.push(`${effectName}: -${removed} dado(s) do pool`); }
    } else if (modifier.operation === 'aumentar_dado') {
      const before = dice.sides;
      dice = { ...dice, sides: stepDieSides(dice.sides, Math.max(1, Math.floor((modifier.value ?? 1) * stacks))) };
      if (dice.sides !== before) steps.push(`${effectName}: d${before} → d${dice.sides}`);
    } else if (modifier.operation === 'reduzir_dado') {
      const before = dice.sides;
      dice = { ...dice, sides: stepDieSides(dice.sides, -Math.max(1, Math.floor((modifier.value ?? 1) * stacks))) };
      if (dice.sides !== before) steps.push(`${effectName}: d${before} → d${dice.sides}`);
    }
  }

  const advantage = matches.some(({ modifier }) => modifier.operation === 'vantagem');
  const disadvantage = matches.some(({ modifier }) => modifier.operation === 'desvantagem');
  let baseRoll = dice.count > 0 ? params.roller(formatDice(dice), params.label) : 0;
  if (dice.count > 0 && advantage !== disadvantage) {
    const second = params.roller(formatDice(dice), params.label);
    baseRoll = advantage ? Math.max(baseRoll, second) : Math.min(baseRoll, second);
    steps.push(advantage ? 'Vantagem: maior de duas rolagens' : 'Desvantagem: menor de duas rolagens');
  }
  let total = baseRoll + dice.bonus + params.baseFlat;

  for (const { modifier, stacks, effectName } of matches) {
    if (modifier.operation === 'adicionar_dado' && modifier.dice) {
      for (let i = 0; i < stacks; i += 1) {
        const extra = params.roller(modifier.dice, params.label);
        total += extra;
        steps.push(`${effectName}: +${modifier.dice} (${extra})`);
      }
    }
  }

  for (const { modifier, stacks, effectName } of matches) {
    if (modifier.operation === 'somar' && modifier.value) { const v = modifier.value * stacks; total += v; steps.push(`${effectName}: +${v}`); }
    if (modifier.operation === 'subtrair' && modifier.value) { const v = modifier.value * stacks; total -= v; steps.push(`${effectName}: -${v}`); }
  }

  for (const { modifier, stacks, effectName } of matches) {
    if (modifier.operation === 'multiplicar' && modifier.value != null) {
      const factor = modifier.value ** stacks; const before = total; total = Math.round(total * factor);
      steps.push(`${effectName}: ×${modifier.value} (${before} → ${total})`);
    }
    if (modifier.operation === 'dividir' && modifier.value) {
      const factor = modifier.value ** stacks; const before = total; total = Math.round(total / factor);
      steps.push(`${effectName}: ÷${modifier.value} (${before} → ${total})`);
    }
  }

  for (const { modifier, effectName } of matches) {
    if (modifier.operation === 'definir' && modifier.value != null) { total = modifier.value; steps.push(`${effectName}: definido em ${modifier.value}`); }
  }
  for (const { modifier, effectName } of matches) {
    if (modifier.operation === 'definir_minimo' && modifier.value != null && total < modifier.value) { total = modifier.value; steps.push(`${effectName}: mínimo ${modifier.value}`); }
    if (modifier.operation === 'definir_maximo' && modifier.value != null && total > modifier.value) { total = modifier.value; steps.push(`${effectName}: máximo ${modifier.value}`); }
  }

  steps.push(`Final: ${total}`);
  return { total, steps };
}

export interface AttackAdjustment {
  /** Somado ao ataque − subtraído da defesa: valor final = (ataque + bonus) >= (defesa - pierce). */
  attackerBonus: number;
  defensePierce: number;
  fearPenalty: number;
  steps: string[];
}

/** Ajustes de ataque/defesa vindos dos 3 campos "legados" de relação atacante↔alvo (não são um
 *  ValueModifier porque não descrevem uma alteração no PRÓPRIO stat de quem os carrega, e sim uma
 *  concessão a quem ataca/é atacado — Exposto e Marcado concedem bônus a quem ataca o portador;
 *  Amedrontado penaliza o portador quando ataca quem aplicou o medo). Compartilhado pelos dois motores
 *  (clássico e grafo) pra não duplicar a lógica nem o texto de log. */
export function resolveAttackAdjustments(attacker: ArsenalActorState, defender: ArsenalActorState): AttackAdjustment {
  const steps: string[] = [];
  let attackerBonus = 0;
  let defensePierce = 0;
  let fearPenalty = 0;
  for (const active of defender.effects) {
    const bonus = active.effect.grantsAttackerBonus;
    if (bonus && !(bonus.onlySource && active.sourceId !== attacker.id)) {
      const value = bonus.value * active.stacks;
      attackerBonus += value;
      steps.push(`${active.effect.name}: +${value} no ataque contra ${defender.name}`);
    }
    const pierce = active.effect.defensePierce;
    if (pierce && !(pierce.onlySource && active.sourceId !== attacker.id)) {
      const value = pierce.value * active.stacks;
      defensePierce += value;
      steps.push(`${active.effect.name}: ignora ${value} de defesa de ${defender.name}`);
    }
  }
  for (const active of attacker.effects) {
    const penalty = active.effect.attackPenaltyAgainstSource;
    if (penalty && active.sourceId === defender.id) {
      const value = penalty * active.stacks;
      fearPenalty += value;
      steps.push(`${active.effect.name}: -${value} no ataque contra quem aplicou`);
    }
  }
  return { attackerBonus, defensePierce, fearPenalty, steps };
}

/** Teto efetivo de vida/aura máxima, somando modificadores 'vida_maxima'/'aura_maxima' SEM filtro (um
 *  bônus temporário de vida máxima não é condicionado a "cartas de fogo" — é sempre ativo enquanto durar).
 *  Não muta `actor.maxHp`/`maxAura`: o valor base nunca muda, então não há nada para "desfazer" quando o
 *  efeito expira — a cura simplesmente passa a poder preencher até este teto enquanto o buff estiver ativo. */
export function effectiveResourceMax(actor: ArsenalActorState, target: 'vida_maxima' | 'aura_maxima'): number {
  const base = target === 'vida_maxima' ? actor.maxHp : actor.maxAura;
  let bonus = 0;
  for (const active of actor.effects) {
    for (const modifier of active.effect.valueModifiers ?? []) {
      if (modifier.target !== target || modifier.filter) continue;
      if (modifier.operation === 'somar') bonus += (modifier.value ?? 0) * Math.max(1, active.stacks);
      if (modifier.operation === 'subtrair') bonus -= (modifier.value ?? 0) * Math.max(1, active.stacks);
    }
  }
  return Math.max(0, base + bonus);
}

/** Dano/cura têm dois lados: quem causa (direção 'causado', efeitos do `source`) e quem recebe
 *  (direção 'recebido', efeitos do `recipient`) — cada lado roda sua própria passada de modificadores,
 *  na ordem, e o total do primeiro alimenta o segundo como valor base (sem dado, já é um número). */
export function resolveCausedAndReceivedValue(params: {
  target: 'dano' | 'cura';
  baseDice?: string | null;
  baseFlat: number;
  source: ArsenalActorState;
  recipient: ArsenalActorState;
  ctx: Omit<ModifierResolutionContext, 'actor' | 'other' | 'direction'>;
  roller: (notation: string, label?: string) => number;
  label?: string;
  includeLegacy?: boolean;
}): ModifierResolutionResult {
  const caused = resolveModifiedValue({
    target: params.target, baseDice: params.baseDice, baseFlat: params.baseFlat, holder: params.source,
    ctx: { ...params.ctx, actor: params.source, other: params.recipient, direction: 'causado' },
    roller: params.roller, label: params.label, includeLegacy: params.includeLegacy,
  });
  const received = resolveModifiedValue({
    target: params.target, baseDice: null, baseFlat: caused.total, holder: params.recipient,
    ctx: { ...params.ctx, actor: params.recipient, other: params.source, direction: 'recebido' },
    roller: params.roller, label: params.label, includeLegacy: params.includeLegacy,
  });
  return { total: received.total, steps: [...caused.steps.slice(0, -1), ...received.steps] };
}
