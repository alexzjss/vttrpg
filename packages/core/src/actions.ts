import type { ConditionId } from './conditions';
import { isConditionId } from './conditions';
import { parseDice } from './dice';
import type { Id, ResourceKey } from './model';
import { ELEMENTS, type Element } from './rules/elements';

export type ActionCategory = 'habilidade' | 'ataque' | 'item' | 'reacao' | 'movimento';
export type EffectWhen = 'hit' | 'miss' | 'always';

export type ActionTarget =
  | { kind: 'self' }
  | { kind: 'single'; range: number }
  | { kind: 'multi'; count: number; range: number };

export type ActionTest =
  | { kind: 'auto' }
  | { kind: 'attack'; dice: string }
  | { kind: 'save'; dice: string; dc: number };

export type Effect =
  | { kind: 'damage'; when: EffectWhen; dice: string; element: Element; staggerBonus?: number }
  | { kind: 'heal'; when: EffectWhen; dice: string; resource: ResourceKey }
  | { kind: 'applyCondition'; when: EffectWhen; conditionId: ConditionId; duration: number }
  | { kind: 'removeCondition'; when: EffectWhen; conditionId: ConditionId };

export interface Action {
  id: Id;
  name: string;
  description: string;
  category: ActionCategory;
  costs: Partial<Record<ResourceKey, number>>;
  cooldown: number;
  target: ActionTarget;
  test: ActionTest;
  effects: Effect[];
  approval: 'auto' | 'gm';
}

export const MAX_ACTION_TEXT = 200;
export const MAX_ACTION_DESCRIPTION = 4000;
export const MAX_ACTIONS_PER_CHARACTER = 30;
export const MAX_EFFECTS = 8;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const intIn = (v: unknown, min: number, max: number): boolean => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const oneOf = (v: unknown, opts: readonly string[]): boolean => typeof v === 'string' && opts.includes(v);
const shortText = (v: unknown, minLen: number): boolean =>
  typeof v === 'string' && v.length >= minLen && v.length <= MAX_ACTION_TEXT;
const validDice = (v: unknown): boolean => typeof v === 'string' && parseDice(v) !== null;
const RESOURCE_KEYS = ['hp', 'aura', 'ammo'] as const;
const CATEGORIES = ['habilidade', 'ataque', 'item', 'reacao', 'movimento'] as const;
const WHEN = ['hit', 'miss', 'always'] as const;

const onlyKeys = (o: Rec, keys: readonly string[]): boolean => Object.keys(o).every((k) => keys.includes(k));

function validTarget(t: unknown): boolean {
  if (!isRec(t)) return false;
  if (t.kind === 'self') return onlyKeys(t, ['kind']);
  if (t.kind === 'single') return onlyKeys(t, ['kind', 'range']) && intIn(t.range, 0, 100);
  if (t.kind === 'multi') return onlyKeys(t, ['kind', 'count', 'range']) && intIn(t.count, 1, 10) && intIn(t.range, 0, 100);
  return false;
}

function validTest(t: unknown): boolean {
  if (!isRec(t)) return false;
  if (t.kind === 'auto') return onlyKeys(t, ['kind']);
  if (t.kind === 'attack') return onlyKeys(t, ['kind', 'dice']) && validDice(t.dice);
  if (t.kind === 'save') return onlyKeys(t, ['kind', 'dice', 'dc']) && validDice(t.dice) && intIn(t.dc, 1, 100);
  return false;
}

function validEffect(e: unknown): boolean {
  if (!isRec(e) || !oneOf(e.when, WHEN)) return false;
  switch (e.kind) {
    case 'damage':
      return onlyKeys(e, ['kind', 'when', 'dice', 'element', 'staggerBonus']) && validDice(e.dice)
        && oneOf(e.element, ELEMENTS) && (e.staggerBonus === undefined || intIn(e.staggerBonus, 0, 999));
    case 'heal':
      return onlyKeys(e, ['kind', 'when', 'dice', 'resource']) && validDice(e.dice) && oneOf(e.resource, RESOURCE_KEYS);
    case 'applyCondition':
      return onlyKeys(e, ['kind', 'when', 'conditionId', 'duration']) && isConditionId(e.conditionId) && intIn(e.duration, 1, 99);
    case 'removeCondition':
      return onlyKeys(e, ['kind', 'when', 'conditionId']) && isConditionId(e.conditionId);
    default:
      return false;
  }
}

function validCosts(c: unknown): boolean {
  return isRec(c) && onlyKeys(c, RESOURCE_KEYS) && Object.values(c).every((v) => intIn(v, 0, 999));
}

export function isValidAction(a: unknown): a is Action {
  if (!isRec(a)) return false;
  return onlyKeys(a, ['id', 'name', 'description', 'category', 'costs', 'cooldown', 'target', 'test', 'effects', 'approval'])
    && shortText(a.id, 1) && shortText(a.name, 1)
    && typeof a.description === 'string' && a.description.length <= MAX_ACTION_DESCRIPTION
    && oneOf(a.category, CATEGORIES) && validCosts(a.costs) && intIn(a.cooldown, 0, 20)
    && validTarget(a.target) && validTest(a.test)
    && Array.isArray(a.effects) && a.effects.length >= 1 && a.effects.length <= MAX_EFFECTS && a.effects.every(validEffect)
    && oneOf(a.approval, ['auto', 'gm']);
}

/** Devolve uma cópia profunda da ação se ela for válida, ou null. Usado ao carregar dados salvos. */
export function normalizeAction(raw: unknown): Action | null {
  return isValidAction(raw) ? (JSON.parse(JSON.stringify(raw)) as Action) : null;
}
