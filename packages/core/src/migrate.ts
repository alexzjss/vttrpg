import { MAX_ACTIONS_PER_CHARACTER, normalizeAction, type Action } from './actions';
import { isConditionId } from './conditions';
import type { ActiveCondition, CampaignState, Character, Id } from './model';
import { defaultDefense, defaultStagger, type Defense, type Stagger } from './rules/defense';
import { ELEMENTS, type Affinity, type Element } from './rules/elements';

export const MAX_CONDITIONS_PER_CHARACTER = 20;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const nonNeg = (v: unknown): v is number => isNum(v) && v >= 0;
const unit = (v: unknown): v is number => isNum(v) && v >= 0 && v <= 1;
const intIn = (v: unknown, min: number, max: number): v is number => isNum(v) && Number.isInteger(v) && v >= min && v <= max;

/** Cada campo inválido volta ao padrão; `current` nunca passa de `max`. */
export function sanitizeDefense(d: unknown, armor?: number): Defense {
  const raw: Rec = isRec(d) ? d : {};
  const a = nonNeg(raw.armor) ? raw.armor : nonNeg(armor) ? armor : 10;
  const def = defaultDefense(a);
  const max = nonNeg(raw.max) ? raw.max : def.max;
  const current = nonNeg(raw.current) ? raw.current : max;
  return {
    armor: a,
    max,
    current: Math.min(current, max),
    reduction: unit(raw.reduction) ? raw.reduction : def.reduction,
    regeneration: nonNeg(raw.regeneration) ? raw.regeneration : def.regeneration,
    activationThreshold: unit(raw.activationThreshold) ? raw.activationThreshold : def.activationThreshold,
    broken: typeof raw.broken === 'boolean' ? raw.broken : def.broken,
  };
}

export function sanitizeStagger(s: unknown): Stagger {
  const raw: Rec = isRec(s) ? s : {};
  const def = defaultStagger();
  const max = nonNeg(raw.max) ? raw.max : def.max;
  const current = nonNeg(raw.current) ? raw.current : def.current;
  return {
    max,
    current: current <= max ? current : def.current,
    recovery: nonNeg(raw.recovery) ? raw.recovery : def.recovery,
    damageMultiplier: nonNeg(raw.damageMultiplier) ? raw.damageMultiplier : def.damageMultiplier,
    duration: intIn(raw.duration, 1, 10) ? raw.duration : def.duration,
    staggered: typeof raw.staggered === 'boolean' ? raw.staggered : def.staggered,
    turnsRemaining: intIn(raw.turnsRemaining, 0, Number.MAX_SAFE_INTEGER) ? raw.turnsRemaining : def.turnsRemaining,
  };
}

/** Confere o formato mínimo de uma campanha salva; dado inválido nunca deve virar Authority. */
function isValidCampaign(v: unknown): v is Rec {
  if (!isRec(v) || !isNum(v.revision) || !isRec(v.characters)) return false;
  if (v.audienceSeq !== undefined && !isRec(v.audienceSeq)) return false;
  if (!isRec(v.scene) || !isRec(v.scene.grid) || !isRec(v.scene.tokens)) return false;
  const g = v.scene.grid;
  if (!isNum(g.cols) || !isNum(g.rows) || !isNum(g.cellSize)) return false;
  return isRec(v.encounter);
}

const isPool = (v: unknown): boolean => isRec(v) && isNum(v.current) && isNum(v.max);
const AFFINITIES: readonly string[] = ['fraco', 'resistente', 'imune'];

function migrateAffinities(raw: unknown): Partial<Record<Element, Affinity>> {
  const out: Partial<Record<Element, Affinity>> = {};
  if (!isRec(raw)) return out;
  for (const e of ELEMENTS) {
    const a = raw[e];
    if (typeof a === 'string' && AFFINITIES.includes(a)) out[e] = a as Affinity;
  }
  return out;
}

function migrateConditions(raw: unknown): ActiveCondition[] {
  if (!Array.isArray(raw)) return [];
  const out: ActiveCondition[] = [];
  for (const c of raw) {
    if (isRec(c) && isConditionId(c.id) && intIn(c.duration, 0, Number.MAX_SAFE_INTEGER)) {
      out.push({ id: c.id, duration: c.duration });
    }
  }
  return out.slice(0, MAX_CONDITIONS_PER_CHARACTER);
}

function migrateActions(raw: unknown): Action[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((a) => normalizeAction(a) ?? []).slice(0, MAX_ACTIONS_PER_CHARACTER);
}

function migrateCooldowns(raw: unknown): Record<Id, number> {
  const out: Record<Id, number> = {};
  if (!isRec(raw)) return out;
  for (const [k, v] of Object.entries(raw)) if (intIn(v, 0, Number.MAX_SAFE_INTEGER)) out[k] = v;
  return out;
}

function migrateCharacter(raw: unknown): Character | null {
  if (!isRec(raw) || typeof raw.id !== 'string' || !isRec(raw.resources)) return null;
  const r = raw.resources;
  if (!isPool(r.hp) || !isPool(r.aura) || !isPool(r.ammo)) return null;
  return {
    ...(raw as unknown as Character),
    defense: sanitizeDefense(raw.defense),
    stagger: sanitizeStagger(raw.stagger),
    affinities: migrateAffinities(raw.affinities),
    conditions: migrateConditions(raw.conditions),
    actions: migrateActions(raw.actions),
    cooldowns: migrateCooldowns(raw.cooldowns),
  };
}

/** Aceita estado v1 (sem `version`) ou v2 e devolve sempre v2; `null` quando a forma mínima falha. */
export function migrateState(raw: unknown): CampaignState | null {
  if (!isValidCampaign(raw)) return null;
  const characters: Record<Id, Character> = {};
  for (const [id, c] of Object.entries(raw.characters as Rec)) {
    const migrated = migrateCharacter(c);
    if (!migrated) return null;
    characters[id] = migrated;
  }
  const settings = isRec(raw.settings) ? raw.settings : {};
  return {
    ...(raw as unknown as CampaignState),
    version: 2,
    audienceSeq: isRec(raw.audienceSeq) ? (raw.audienceSeq as Record<string, number>) : {},
    characters,
    settings: { requireApproval: settings.requireApproval === true },
    log: Array.isArray(raw.log) ? (raw.log as CampaignState['log']) : [],
    requests: isRec(raw.requests) ? (raw.requests as CampaignState['requests']) : {},
  };
}
