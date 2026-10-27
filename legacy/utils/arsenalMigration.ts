import type { Card, Character, Item, Seal, Weapon } from '../types';
import {
  createArsenalCard,
  normalizeTags,
  type AbilityType,
  type ArsenalCard,
  type ArsenalEffect,
  type ArsenalHolding,
  type ArsenalLevel,
  type AmountFormula,
  type RitualNodeConfig,
  type TargetConfig,
} from './arsenal';
import { getPredefinedEffect } from './arsenalEffects';

export interface LegacyArsenalCatalog {
  cards?: Card[];
  seals?: Seal[];
  items?: Item[];
  weapons?: Weapon[];
}

function amount(flat?: number, dice?: string): AmountFormula | null {
  if (!flat && !dice) return null;
  return { flat: flat ?? 0, ...(dice ? { dice } : {}) };
}

const ritualKey = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ritualConfig = (input:Partial<RitualNodeConfig>&Pick<RitualNodeConfig,'key'|'role'>):RitualNodeConfig => ({enabled:true,connectors:['top','right','bottom','left'],rotationAllowed:true,connectionTags:[],forbiddenConnectionTags:[],...input});

function legacyEffect(name?: string, duration = 1): ArsenalEffect[] {
  if (!name) return [];
  const preset = getPredefinedEffect(name);
  if (preset) return [{ ...preset, duration: { type: 'rodadas', amount: duration } }];
  return [{
    id: `legacy-effect-${name.toLocaleLowerCase('pt-BR').replace(/\s+/g, '-')}`,
    name,
    description: 'Efeito importado do arsenal legado.',
    tags: normalizeTags([name]),
    duration: { type: 'rodadas', amount: duration },
    stackBehavior: 'renova_duracao',
    maxStacks: 1,
    triggers: [],
    modifiers: [],
    periodicDamage: null,
    periodicHealing: null,
    auraConsumed: null,
    auraRestored: null,
    attackModifier: 0,
    defenseModifier: 0,
    speedModifier: 0,
    customEffect: null,
  }];
}

function legacyLevels(levels: Card['levels'] | undefined): ArsenalLevel[] {
  return (levels ?? []).map(entry => ({
    level: entry.level,
    ...(entry.name !== undefined ? { name:entry.name } : {}),
    ...(entry.description !== undefined ? { description:entry.description } : {}),
    ...(entry.diceRoll !== undefined ? { testDice:entry.diceRoll || null } : {}),
    ...(entry.damage !== undefined ? { damage:amount(entry.damage) } : {}),
    ...(entry.damageType !== undefined ? { element:entry.damageType } : {}),
    ...(entry.auraCost !== undefined ? { auraConsumed:amount(entry.auraCost) } : {}),
    ...(entry.ammoCost !== undefined ? { ammoConsumed:amount(entry.ammoCost) } : {}),
    ...(entry.conditionEffect !== undefined ? { effects:legacyEffect(entry.conditionEffect,entry.conditionDuration) } : {}),
  }));
}

function abilityType(card: Card): AbilityType {
  if (card.type === 'reação') return 'protecao';
  if (card.type === 'combinação') return 'combo';
  if (card.type === 'forma') return 'forma';
  return 'comum';
}

function combatTarget(raw: { combatTargeting?: string; combatHeal?: number; combatAuraRecover?: number }): TargetConfig {
  if (raw.combatTargeting === 'self' || ((raw.combatHeal || raw.combatAuraRecover) && raw.combatTargeting !== 'other')) {
    return { type: 'proprio_usuario' };
  }
  if (raw.combatTargeting === 'area') return { type: 'todos_em_area' };
  return { type: 'um_alvo' };
}

function mergeEffects(...groups: Array<ArsenalEffect[] | undefined>): ArsenalEffect[] {
  return groups.flatMap(group => group ?? []);
}

function normalizeCooldown(raw: { cooldown?: ArsenalCard['cooldown'] } | undefined): ArsenalCard['cooldown'] | undefined {
  if (!raw?.cooldown || raw.cooldown.type === 'sem_cooldown') return undefined;
  return raw.cooldown;
}

function normalizeCharges(raw: { charges?: ArsenalCard['charges'] } | undefined): ArsenalCard['charges'] | undefined {
  if (!raw?.charges) return undefined;
  return {
    ...raw.charges,
    maximum: Math.max(0, raw.charges.maximum),
    current: Math.max(0, Math.min(raw.charges.current, raw.charges.maximum)),
  };
}

export function cardToArsenal(card: Card): ArsenalCard {
  const type = abilityType(card);
  const linkedWeapons = Array.isArray((card as any).weaponIds) ? (card as any).weaponIds : [];
  const linkedForms = Array.isArray((card as any).formIds) ? (card as any).formIds : [];
  return createArsenalCard({
    id: card.id,
    name: card.name,
    description: card.description,
    category: 'habilidade',
    icon: card.image,
    tags: normalizeTags([card.type, card.element ?? '', card.isAreaEffect ? 'area' : '']),
    element: card.damageType ?? card.element ?? null,
    testDice: card.diceRoll ?? null,
    damage: amount(card.damage),
    auraConsumed: amount(card.auraCost),
    ammoConsumed: amount((card as any).ammoCost),
    target: card.isAreaEffect ? { type: 'todos_em_area' } : { type: 'um_alvo' },
    area: card.isAreaEffect ? { shape: 'circulo', size: 1, unit: 'celulas' } : null,
    effects: legacyEffect(card.conditionEffect, card.conditionDuration),
    visibility: card.isHidden ? 'oculta' : 'publica',
    weaponLinks: linkedWeapons,
    formLinks: linkedForms,
    levels: legacyLevels(card.levels),
    abilityType: type,
    ...(type === 'protecao' ? {
      triggers: [{ event: 'ao_ser_atacado' }],
      conditions: [{ type: 'reacao' }],
    } : {}),
    ...(type === 'combo' ? {
      combo: {
        stackKey: `combo-${card.id}`,
        maxStacks: Math.max(1, card.comboMaxUsers ?? card.comboMinUsers ?? 2),
        abilityIds: Array.isArray((card as any).comboCardIds) ? (card as any).comboCardIds : [],
        resolution: 'sequencial',
      },
    } : {}),
    ...(type === 'forma' ? {
      form: {
        grantedAbilityIds: card.formaCardIds ?? [],
        removedAbilityIds: [],
        hpBonus: card.formaHpBonus ?? 0,
        auraBonus: card.formaAuraBonus ?? 0,
        color: card.formaColor,
        iconOverride: card.formaIcon,
      },
    } : {}),
    metadata: { legacyType: card.type, legacyCode: card.code, levels: card.levels, bonuses: card.bonuses },
  });
}

export function sealToArsenal(seal: Seal): ArsenalCard {
  const prepRounds = seal.preparationRounds ?? 0;
  return createArsenalCard({
    id: seal.id,
    name: seal.name,
    description: seal.description,
    category: 'selo',
    icon: seal.image,
    tags: normalizeTags(['selo', seal.damageType ?? '', seal.executionMode ?? '']),
    element: seal.damageType ?? null,
    testDice: seal.diceRoll ?? null,
    damage: amount(seal.damage),
    healing: amount(seal.healHp),
    auraConsumed: amount(seal.cost?.aura),
    auraRestored: amount(seal.healAura),
    target: combatTarget({ combatTargeting: seal.combatTargeting, combatHeal: seal.healHp, combatAuraRecover: seal.healAura }),
    area: seal.combatTargeting === 'area'
      ? { shape: seal.directionMode === 'cone' ? 'cone' : seal.directionMode === 'line' ? 'linha' : 'circulo', size: seal.areaSize ?? seal.range ?? 1, unit: 'celulas' }
      : null,
    ...(prepRounds > 0 ? { preparation: {
      timing: { type: 'rodadas', amount: prepRounds },
      cancellable: true,
      interruptedByDamage: true,
      persistsAfterDamage: false,
      visibility: 'visivel',
    } } : {}),
    effects: mergeEffects(legacyEffect(seal.conditionEffect, seal.conditionDuration), seal.effects),
    ...(normalizeCooldown(seal) ? { cooldown: normalizeCooldown(seal) } : {}),
    ...(normalizeCharges(seal) ? { charges: normalizeCharges(seal) } : {}),
    visibility: seal.isHidden ? 'oculta' : 'publica',
    seal: {
      kind: prepRounds > 0 ? 'ritual' : 'explosao',
      type: seal.damage ? 'ataque' : 'buff', persistent: !!seal.duration, consumable: false,
      requiredItems: [], durationRounds: seal.duration ?? null,
      ritual: ritualConfig({
        key: seal.ritualKey || ritualKey(seal.name),
        role: seal.ritualRole || (prepRounds > 0 ? 'nucleo' : 'condutor'),
        connectors: seal.connectors?.length ? seal.connectors : ['top','right','bottom','left'],
        rotationAllowed: seal.rotationAllowed ?? true,
        connectionTags: seal.connectionTags ?? [],
        forbiddenConnectionTags: seal.forbiddenConnectionTags ?? [],
        ...(typeof seal.maxPerRitual === 'number' && seal.maxPerRitual > 0 ? { maxPerRitual: seal.maxPerRitual } : {}),
      }),
    },
    metadata: {
      legacyCode: seal.code, executionModes: seal.executionModes, requirements: seal.requirements,
      directionMode: seal.directionMode, range: seal.range, areaSize: seal.areaSize,
      ritual: {
        key: seal.ritualKey, role: seal.ritualRole, connectors: seal.connectors,
        rotationAllowed: seal.rotationAllowed, maxPerRitual: seal.maxPerRitual,
        connectionTags: seal.connectionTags, forbiddenConnectionTags: seal.forbiddenConnectionTags,
      },
    },
  });
}

export function itemToArsenal(item: Item): ArsenalCard {
  return createArsenalCard({
    id: item.id,
    name: item.name,
    description: item.description,
    category: 'item',
    icon: item.image,
    tags: normalizeTags(['item', item.category ?? '', item.combatDamageType ?? '']),
    element: item.combatDamageType ?? null,
    testDice: item.combatDiceRoll ?? null,
    damage: amount(item.combatDamage),
    healing: amount(item.combatHeal),
    auraConsumed: amount(item.combatAuraCost),
    auraRestored: amount(item.combatAuraRecover),
    target: combatTarget(item),
    area: item.combatTargeting === 'area'
      ? { shape: item.combatAreaShape === 'cone' ? 'cone' : item.combatAreaShape === 'line' ? 'linha' : item.combatAreaShape === 'square' ? 'quadrado' : 'circulo', size: item.combatAreaSize ?? item.combatRange ?? 1, unit: 'celulas' }
      : null,
    effects: mergeEffects(legacyEffect(item.combatConditionEffect, item.combatConditionDuration), item.effects),
    ...(normalizeCooldown(item) ? { cooldown: normalizeCooldown(item) } : {}),
    ...(normalizeCharges(item) ? { charges: normalizeCharges(item) } : {}),
    visibility: item.isHidden ? 'oculta' : 'publica',
    item: {
      consumable: item.consumeOnUse ?? false,
      quantity: item.quantity ?? 1,
      disappearsOnUse: item.consumeOnUse ?? false,
      usesPerActivation: Math.max(1, item.usesPerActivation ?? 1),
      ritual: ritualConfig({ key: ritualKey(item.name), role: 'material', consumedOnConfirm: true }),
    },
    metadata: {
      legacyCategory: item.category, link: item.link, usableInCombat: item.usableInCombat,
      maxQuantity: item.maxQuantity, durability: item.durability, maxDurability: item.maxDurability, wearPerUse: item.wearPerUse,
      combatRange: item.combatRange, combatAreaSize: item.combatAreaSize, combatAreaShape: item.combatAreaShape,
    },
  });
}

export function weaponToArsenal(weapon: Weapon): ArsenalCard {
  const granted = Array.isArray((weapon as any).abilityIds) ? (weapon as any).abilityIds : [];
  return createArsenalCard({
    id: weapon.id,
    name: weapon.name,
    description: weapon.description,
    category: 'arma',
    icon: weapon.image,
    tags: normalizeTags(['arma', weapon.category ?? '', weapon.range ?? '', ...(weapon.traits ?? [])]),
    element: weapon.combatDamageType ?? weapon.damageType ?? null,
    testDice: weapon.combatDiceRoll ?? null,
    damage: amount(weapon.combatDamage ?? weapon.damage),
    healing: amount(weapon.combatHeal),
    auraRestored: amount(weapon.combatAuraRecover),
    target: combatTarget(weapon),
    area: weapon.combatTargeting === 'area' ? { shape: 'circulo', size: 1, unit: 'celulas' } : null,
    effects: legacyEffect(weapon.combatConditionEffect, weapon.combatConditionDuration),
    visibility: weapon.isHidden ? 'oculta' : 'publica',
    weapon: { freelyEquippable: true, grantedAbilityIds: granted },
    metadata: { range: weapon.range, bonus: weapon.bonus, usableInCombat: weapon.usableInCombat },
  });
}

export function normalizeArsenalCard(raw: Partial<ArsenalCard> & { id: string; name: string; category: ArsenalCard['category'] }): ArsenalCard {
  const legacy = raw as any;
  let source: typeof raw = raw;
  if (raw.schemaVersion !== 1 && legacy.combat) {
    const damageEffect = legacy.combat.effects?.find((effect: any) => effect.kind === 'damage');
    const healEffect = legacy.combat.effects?.find((effect: any) => effect.kind === 'heal' && effect.stat === 'hp');
    const conditionEffect = legacy.combat.effects?.find((effect: any) => effect.kind === 'condition');
    source = {
      ...raw,
      icon: legacy.icon ?? legacy.image ?? '',
      testDice: legacy.combat.attackDice ?? null,
      damage: damageEffect ? amount(0, damageEffect.dice) : null,
      healing: healEffect ? amount(0, healEffect.dice) : null,
      auraConsumed: amount(legacy.combat.costs?.aura),
      target: legacy.combat.targeting === 'self' ? { type: 'proprio_usuario' } : { type: 'um_alvo' },
      effects: conditionEffect ? legacyEffect(conditionEffect.name, conditionEffect.duration) : [],
      abilityType: legacy.forma ? 'forma' : legacy.combo ? 'combo' : raw.category === 'habilidade' ? 'comum' : undefined,
      form: legacy.forma ? {
        grantedAbilityIds: legacy.forma.grantedEntryIds ?? [], removedAbilityIds: [],
        hpBonus: legacy.forma.hpBonus ?? 0, auraBonus: legacy.forma.auraBonus ?? 0,
        color: legacy.forma.color, iconOverride: legacy.forma.icon,
      } : undefined,
      combo: legacy.combo ? {
        stackKey: `combo-${raw.id}`, maxStacks: legacy.combo.maxUsers ?? legacy.combo.minUsers ?? 2,
        abilityIds: [], resolution: 'sequencial',
      } : undefined,
      item: raw.category === 'item' ? { consumable: !!legacy.consumable, quantity: 1, disappearsOnUse: !!legacy.consumable } : undefined,
      metadata: { ...(raw.metadata ?? {}), legacyCombat: legacy.combat, legacyLevels: legacy.levels },
    };
  }
  const normalized = createArsenalCard(source);
  const migratedLevels = normalized.levels.length
    ? normalized.levels
    : legacyLevels((normalized.metadata?.levels ?? normalized.metadata?.legacyLevels) as Card['levels'] | undefined);
  const legacyCombo = normalized.combo as any;
  const legacySeal = normalized.seal as any;
  const legacyItem = normalized.item as any;
  return {
    ...normalized,
    tags: normalizeTags(normalized.tags),
    weaponLinks: [...new Set(normalized.weaponLinks)],
    formLinks: [...new Set(normalized.formLinks)],
    combo: normalized.combo ? {
      ...normalized.combo,
      stackKey: legacyCombo.stackKey || `combo-${normalized.id}`,
      maxStacks: Math.max(1, legacyCombo.maxStacks ?? legacyCombo.minimumAbilities ?? 2),
    } : undefined,
    seal: normalized.seal ? {
      ...normalized.seal,
      kind: legacySeal.kind ?? (normalized.preparation.timing.type === 'instantaneo' ? 'explosao' : 'ritual'),
      requiredItems: Array.isArray(legacySeal.requiredItems) ? legacySeal.requiredItems : [],
      durationRounds: typeof legacySeal.durationRounds === 'number' ? legacySeal.durationRounds : null,
      ritual: ritualConfig({
        key: legacySeal.ritual?.key || ritualKey(normalized.name),
        role: legacySeal.ritual?.role || (legacySeal.kind === 'ritual' ? 'nucleo' : 'condutor'),
        ...(legacySeal.ritual ?? {}),
        connectors: Array.isArray(legacySeal.ritual?.connectors) ? legacySeal.ritual.connectors : ['top','right','bottom','left'],
        connectionTags: Array.isArray(legacySeal.ritual?.connectionTags) ? legacySeal.ritual.connectionTags : [],
        forbiddenConnectionTags: Array.isArray(legacySeal.ritual?.forbiddenConnectionTags) ? legacySeal.ritual.forbiddenConnectionTags : [],
      }),
    } : undefined,
    item: normalized.item ? {
      ...normalized.item,
      ritual: ritualConfig({
        key: legacyItem.ritual?.key || ritualKey(normalized.name),
        role: legacyItem.ritual?.role || 'material',
        consumedOnConfirm: legacyItem.ritual?.consumedOnConfirm ?? true,
        ...(legacyItem.ritual ?? {}),
        connectors: Array.isArray(legacyItem.ritual?.connectors) ? legacyItem.ritual.connectors : ['top','right','bottom','left'],
        connectionTags: Array.isArray(legacyItem.ritual?.connectionTags) ? legacyItem.ritual.connectionTags : [],
        forbiddenConnectionTags: Array.isArray(legacyItem.ritual?.forbiddenConnectionTags) ? legacyItem.ritual.forbiddenConnectionTags : [],
      }),
    } : undefined,
    charges: normalized.charges ? {
      ...normalized.charges,
      maximum: Math.max(0, normalized.charges.maximum),
      current: Math.max(0, Math.min(normalized.charges.current, normalized.charges.maximum)),
    } : null,
    levels: Array.isArray(migratedLevels)
      ? migratedLevels
        .filter(level => Number.isFinite(level.level) && level.level > 1)
        .sort((a, b) => a.level - b.level)
      : [],
  };
}

/** Converte os quatro catálogos sem duplicar IDs já presentes no catálogo canônico. */
export function migrateLegacyArsenal(catalog: LegacyArsenalCatalog, existing: ArsenalCard[] = []): ArsenalCard[] {
  const byId = new Map(existing.map(entry => [entry.id, normalizeArsenalCard(entry)]));
  const converted = [
    ...(catalog.cards ?? []).map(cardToArsenal),
    ...(catalog.seals ?? []).map(sealToArsenal),
    ...(catalog.items ?? []).map(itemToArsenal),
    ...(catalog.weapons ?? []).map(weaponToArsenal),
  ];
  for (const entry of converted) if (!byId.has(entry.id)) byId.set(entry.id, entry);
  for (const ability of byId.values()) {
    if (ability.category !== 'habilidade') continue;
    for (const weaponId of ability.weaponLinks) {
      const weapon = byId.get(weaponId);
      if (weapon?.category === 'arma' && weapon.weapon && !weapon.weapon.grantedAbilityIds.includes(ability.id)) {
        weapon.weapon.grantedAbilityIds.push(ability.id);
      }
    }
    for (const formId of ability.formLinks) {
      const form = byId.get(formId);
      if (form?.abilityType === 'forma' && form.form && !form.form.grantedAbilityIds.includes(ability.id)) {
        form.form.grantedAbilityIds.push(ability.id);
      }
    }
  }
  return [...byId.values()];
}

/** Une posse antiga e nova. IDs repetidos preservam o maior estoque conhecido. */
export function migrateCharacterArsenalHoldings(character: Partial<Character>): ArsenalHolding[] {
  const byId = new Map<string, ArsenalHolding>();
  const add = (cardId: string, quantity = 1, patch: Partial<ArsenalHolding> = {}) => {
    if (!cardId) return;
    const previous = byId.get(cardId);
    byId.set(cardId, {
      cardId,
      quantity: Math.max(previous?.quantity ?? 0, quantity),
      equipped: previous?.equipped ?? false,
      active: previous?.active ?? false,
      ...previous,
      ...patch,
    });
  };

  for (const holding of character.arsenal ?? []) add(holding.cardId, holding.quantity, holding);
  for (const holding of character.grimoire ?? []) add(holding.entryId, holding.quantity ?? 1);
  for (const id of character.cardIds ?? []) add(id);
  for (const id of character.weaponIds ?? []) add(id);
  for (const id of character.sealIds ?? []) add(id);
  for (const owned of character.ownedItems ?? []) add(owned.itemId, owned.quantity);
  return [...byId.values()];
}
