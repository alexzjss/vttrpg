import type { Character, Pool, ResourceKey } from './model';
import { defaultResources } from './campaign';

/** Maior `version` de AppSnapshot que o legado grava (SNAPSHOT_VERSION em legacy/utils/database.ts). */
export const LEGACY_MAX_VERSION = 8;

export interface LegacyCharacterDraft {
  legacyId: string;
  input: Omit<Character, 'id'>;
  /** Strings originais (data URL ou URL) para a camada web subir ao Storage. */
  images: { portrait?: string; fullBodyArt?: string; tokenImage?: string };
}

export type LegacyImportResult =
  | { ok: true; characters: LegacyCharacterDraft[] }
  | { ok: false; error: 'invalid_file' | 'unsupported_version' };

type Raw = Record<string, unknown>;
const DEFAULT_SPEED = 5;

const isRecord = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const text = (v: unknown): string => (typeof v === 'string' ? v : '');

function pool(rawCurrent: unknown, rawMax: unknown, fallback: Pool): Pool {
  const max = finite(rawMax) ? Math.max(0, rawMax) : fallback.max;
  const current = finite(rawCurrent) ? rawCurrent : fallback.current;
  return { current: Math.min(Math.max(0, current), max), max };
}

const POOLS: Array<[ResourceKey, string, string]> = [
  ['hp', 'currentHp', 'maxHp'],
  ['aura', 'currentAura', 'maxAura'],
  ['ammo', 'currentAmmo', 'maxAmmo'],
];

function toDraft(raw: Raw, index: number): LegacyCharacterDraft {
  const defaults = defaultResources();
  const resources = { ...defaults };
  for (const [key, cur, max] of POOLS) resources[key] = pool(raw[cur], raw[max], defaults[key]);

  const npc = raw.role === 'npc';
  const portrait = text(raw.icon);
  const fullBodyArt = text(raw.bannerImage);
  const images: LegacyCharacterDraft['images'] = {};
  if (portrait) { images.portrait = portrait; images.tokenImage = portrait; }
  if (fullBodyArt) images.fullBodyArt = fullBodyArt;

  return {
    legacyId: text(raw.id) || `legacy-${index}`,
    input: {
      kind: npc ? 'npc' : 'pc',
      name: text(raw.name) || 'Sem nome',
      portrait,
      fullBodyArt,
      tokenImage: portrait,
      resources,
      speed: finite(raw.speed) ? raw.speed : DEFAULT_SPEED,
      hpVisibility: npc ? 'band' : 'exact',
    },
    images,
  };
}

/** Converte o JSON de backup do app antigo (AppSnapshot) em rascunhos de personagem. Puro. */
export function parseLegacyBackup(json: unknown): LegacyImportResult {
  if (!isRecord(json) || !Array.isArray(json.characters)) return { ok: false, error: 'invalid_file' };
  if (finite(json.version) && json.version > LEGACY_MAX_VERSION) return { ok: false, error: 'unsupported_version' };
  const characters = json.characters.flatMap((c, i) => (isRecord(c) ? [toDraft(c, i)] : []));
  return { ok: true, characters };
}
