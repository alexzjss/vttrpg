import type { Command } from './commands';

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string';
/** Limites de tamanho: nomes e ids curtos, URLs de imagem mais longas. */
export const MAX_SHORT_TEXT = 200;
export const MAX_URL_TEXT = 2048;
const shortStr = (v: unknown): v is string => str(v) && v.length <= MAX_SHORT_TEXT;
const urlStr = (v: unknown): v is string => str(v) && v.length <= MAX_URL_TEXT;
const id = (v: unknown): v is string => shortStr(v) && v.length > 0;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const int = (v: unknown): v is number => num(v) && Number.isInteger(v);
const posInt = (v: unknown): v is number => int(v) && v > 0;
const bool = (v: unknown): v is boolean => typeof v === 'boolean';
const oneOf = (v: unknown, opts: readonly string[]): boolean => typeof v === 'string' && opts.includes(v);
const onlyKeys = (o: Rec, allowed: readonly string[]): boolean => Object.keys(o).every((k) => allowed.includes(k));

const isCell = (v: unknown): boolean => isRec(v) && int(v.col) && int(v.row) && onlyKeys(v, ['col', 'row']);
const RESOURCES = ['hp', 'aura', 'ammo'] as const;
const VISIBILITY = ['exact', 'band', 'hidden'] as const;

const isPool = (v: unknown): boolean => isRec(v) && num(v.current) && num(v.max) && onlyKeys(v, ['current', 'max']);
const isResources = (v: unknown): boolean =>
  isRec(v) && onlyKeys(v, RESOURCES) && RESOURCES.every((k) => isPool(v[k]));

const CHAR_VALIDATORS: Record<string, (v: unknown) => boolean> = {
  kind: (v) => oneOf(v, ['pc', 'npc']),
  name: shortStr,
  portrait: urlStr,
  fullBodyArt: urlStr,
  tokenImage: urlStr,
  speed: num,
  hpVisibility: (v) => oneOf(v, VISIBILITY),
};

function isCharacterInput(v: unknown): boolean {
  if (!isRec(v) || !isResources(v.resources)) return false;
  const keys = Object.keys(CHAR_VALIDATORS);
  return onlyKeys(v, [...keys, 'resources']) && keys.every((k) => CHAR_VALIDATORS[k]!(v[k]));
}

function isCharacterPatch(v: unknown): boolean {
  if (!isRec(v)) return false;
  return Object.keys(v).every((k) => k in CHAR_VALIDATORS && CHAR_VALIDATORS[k]!(v[k]));
}

function isGrid(v: unknown): boolean {
  return isRec(v) && posInt(v.cols) && posInt(v.rows) && posInt(v.cellSize) && bool(v.visible)
    && onlyKeys(v, ['cols', 'rows', 'cellSize', 'visible']);
}

/** Verifica o formato de cada campo; regras de jogo continuam a cargo do `decide`. */
export function isWellFormedCommand(cmd: unknown): cmd is Command {
  if (!isRec(cmd) || !str(cmd.type)) return false;
  switch (cmd.type) {
    case 'createCharacter': return isCharacterInput(cmd.input);
    case 'updateCharacter': return id(cmd.characterId) && isCharacterPatch(cmd.patch);
    case 'deleteCharacter': return id(cmd.characterId);
    case 'setResource':
      return id(cmd.characterId) && oneOf(cmd.resource, RESOURCES)
        && (cmd.current === undefined || num(cmd.current)) && (cmd.max === undefined || num(cmd.max));
    case 'placeToken':
      return id(cmd.characterId) && isCell(cmd.cell) && (cmd.hidden === undefined || bool(cmd.hidden));
    case 'moveToken': return id(cmd.tokenId) && isCell(cmd.to);
    case 'removeToken': return id(cmd.tokenId);
    case 'setTokenHidden': return id(cmd.tokenId) && bool(cmd.hidden);
    case 'updateGrid': return isGrid(cmd.grid) && urlStr(cmd.background);
    case 'startEncounter':
      return Array.isArray(cmd.entries)
        && cmd.entries.every((e) => isRec(e) && id(e.tokenId) && num(e.initiative));
    case 'reorderInitiative': return Array.isArray(cmd.order) && cmd.order.every(id);
    case 'nextTurn':
    case 'endEncounter': return true;
    default: return false;
  }
}
