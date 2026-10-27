/**
 * database.ts — Sistema de Persistência Unificado v3
 *
 * Princípios:
 *  - IndexedDB como único armazenamento primário (sem limite de 5MB)
 *  - Um "snapshot" completo cobre TODOS os dados do app
 *  - Listeners em memória notificam o React de mudanças
 *  - Export/Import trabalham com AppSnapshot tipado e versionado
 *  - Migração automática de versões antigas
 *  - Sem dependência de localStorage para dados críticos
 */

import { Card, Character, CombatState, Item, JourneyState, Seal, Weapon } from '../types';
import { CenaState, createDefaultCena } from './cena';
import type { ArsenalCard } from './arsenal';
import { migrateCharacterArsenalHoldings, migrateLegacyArsenal, normalizeArsenalCard, cardToArsenal, itemToArsenal, sealToArsenal, weaponToArsenal } from './arsenalMigration';
import type { AbilityGraph } from './abilityGraph';
import { createAbilityGraph } from './abilityGraph';
import { ensureStandardCardsOnAllTriggers } from './abilityGraphEdit';
import { migrateCharacterDefense } from './defense';

/** Discrimina, dentro do store `grimoire`, entradas do novo sistema de grafo das cartas legadas. */
function isAbilityGraphEntry(raw: unknown): raw is AbilityGraph {
  return !!raw && typeof raw === 'object' && (raw as { kind?: string }).kind === 'graph';
}

/** Preenche defaults ausentes (ex.: campo adicionado depois de o grafo já ter sido salvo) sem descartar o conteúdo salvo. */
function normalizeAbilityGraph(raw: AbilityGraph): AbilityGraph {
  const fallback = createAbilityGraph({ id: raw.id, name: raw.header?.name ?? 'Sem nome' });
  return { ...fallback, ...raw, header: { ...fallback.header, ...raw.header } };
}

// ─────────────────────────────────────────────────────────────────
// AppSnapshot — estado completo e versionado do app
// ─────────────────────────────────────────────────────────────────
export interface AppSnapshot {
  /** Versão do formato — bump quando o schema mudar */
  version: number;
  savedAt: string;
  characters: Character[];
  cards: Card[];
  items: Item[];
  seals: Seal[];
  weapons: Weapon[];
  grimoire: ArsenalCard[];
  /** Habilidades/formas do novo sistema de grafo (mesmo store `grimoire`, separadas aqui por tipo). */
  abilityGraphs?: AbilityGraph[];
  combat: CombatState;
  journey: JourneyState;
  cena: CenaState;
}

export const SNAPSHOT_VERSION = 8;

// ─────────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────────
export const DEFAULT_COMBAT: CombatState = {
  isActive: false,
  round: 1,
  turnIndex: 0,
  combatants: [],
  history: [],
  backgroundImage: '',
  globalBonus: 0,
  gridWidth: 10,
  gridHeight: 10,
  visualWidthPct: 100,
  visualHeightPx: 600,
  maintainAspectRatio: true,
  gridVisible: true,
  gridDensity: 10,
};

export const DEFAULT_JOURNEY: JourneyState = {
  locationName: 'Local Desconhecido',
  description: '',
  image: '',
  weather: 'sunny',
  notes: '',
  recipes: [],
};

export const DEFAULT_CENA: CenaState = createDefaultCena();

// ─────────────────────────────────────────────────────────────────
// IndexedDB internals
// ─────────────────────────────────────────────────────────────────
const IDB_NAME = 'rpg_master_db';
// bump para 7 → cria o store 'grimoire'
const IDB_VERSION = 7;

const ALL_STORES = ['characters', 'cards', 'seals', 'items', 'weapons', 'grimoire', 'meta'] as const;
type Store = typeof ALL_STORES[number];

let _idbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_idbPromise) return _idbPromise;
  _idbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of ALL_STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      _idbPromise = null; // allow retry
      reject(req.error);
    };
  });
  return _idbPromise;
}

async function _getAll<T>(store: Store): Promise<T[]> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => res((req.result ?? []) as T[]);
    req.onerror = () => rej(req.error);
  });
}

async function _get<T>(store: Store, key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const req = db.transaction(store, 'readonly').objectStore(store).get(key);
    req.onsuccess = () => res(req.result as T | undefined);
    req.onerror = () => rej(req.error);
  });
}

async function _put(store: Store, value: any): Promise<void> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(value);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}

async function _delete(store: Store, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).delete(key);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}

/** Substitui todos os itens de um store numa única transação */
async function _replaceAll(store: Store, items: any[]): Promise<void> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const s = tx.objectStore(store);
    const clearReq = s.clear();
    clearReq.onsuccess = () => {
      let pending = items.length;
      if (pending === 0) { res(); return; }
      for (const item of items) {
        const r = s.put(item);
        r.onsuccess = () => { if (--pending === 0) res(); };
        r.onerror = () => rej(r.error);
      }
    };
    clearReq.onerror = () => rej(clearReq.error);
    tx.onerror = () => rej(tx.error);
  });
}

/** Grava um snapshot inteiro em uma única transação: tudo entra, ou nada muda. */
async function _writeSnapshotAtomic(snapshot: AppSnapshot): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([...ALL_STORES], 'readwrite');
    const replace = (store: Store, items: any[]) => {
      const target = tx.objectStore(store);
      target.clear();
      items.forEach(item => target.put(item));
    };
    replace('characters', snapshot.characters.map(ensureChar));
    replace('cards', snapshot.cards);
    replace('items', snapshot.items);
    replace('seals', snapshot.seals.map(ensureSeal));
    replace('weapons', snapshot.weapons ?? []);
    replace('grimoire', [
      ...(snapshot.grimoire ?? []).map(normalizeArsenalCard),
      ...(snapshot.abilityGraphs ?? []).map(normalizeAbilityGraph),
    ]);
    const meta = tx.objectStore('meta');
    meta.put({ id: '__combat', value: snapshot.combat });
    meta.put({ id: '__journey', value: snapshot.journey });
    meta.put({ id: '__cena', value: snapshot.cena });
    meta.put({ id: '__snapshot_meta', savedAt: snapshot.savedAt, version: snapshot.version });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao salvar snapshot'));
    tx.onabort = () => reject(tx.error ?? new Error('Snapshot cancelado'));
  });
}

// ─────────────────────────────────────────────────────────────────
// Sanitizers / coercions
// ─────────────────────────────────────────────────────────────────
function ensureChar(c: any): Character {
  const { deslocamento: legacyMovement, ...rest } = c;
  const normalized = { ...rest, speed: Number.isFinite(c.speed) ? c.speed : Number.isFinite(legacyMovement) ? legacyMovement : (c.baseInitiative ?? 0), items: c.items ?? [], ownedItems: c.ownedItems ?? [], conditions: Array.isArray(c.conditions) ? c.conditions : [], activeEffects: Array.isArray(c.activeEffects) ? c.activeEffects : [], cardIds: c.cardIds ?? [], weaponIds: c.weaponIds ?? [], sealIds: c.sealIds ?? [], grimoire: c.grimoire ?? [] };
  const withDefense = migrateCharacterDefense(normalized);
  return { ...withDefense, arsenal: migrateCharacterArsenalHoldings(withDefense) };
}

function ensureSeal(s: any): Seal {
  return { ...s };
}

function ensureCombat(raw: any): CombatState {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_COMBAT };
  const { fieldConditions: _legacyConditions, ...clean } = raw;
  return {
    ...DEFAULT_COMBAT,
    ...clean,
    combatants: Array.isArray(raw.combatants) ? raw.combatants.map((combatant: any) => migrateCharacterDefense({ ...combatant, conditions: [] })) : [],
    history: Array.isArray(raw.history) ? raw.history : [],
  };
}

function ensureJourney(raw: any): JourneyState {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_JOURNEY };
  return { ...DEFAULT_JOURNEY, ...raw, recipes: Array.isArray(raw.recipes) ? raw.recipes : [] };
}

function ensureCena(raw: any): CenaState {
  if (!raw || typeof raw !== 'object') return createDefaultCena();
  const base = createDefaultCena();
  const { backgroundImage: _legacyBackground, ...scene } = raw.scene ?? {};
  return {
    scene: { ...base.scene, ...scene },
    npcRoster: Array.isArray(raw.npcRoster) ? raw.npcRoster.map((npc: any) => { const { deslocamento, ...rest } = npc; return migrateCharacterDefense({ ...rest, speed:Number.isFinite(npc.speed)?npc.speed:Number.isFinite(deslocamento)?deslocamento:(npc.baseInitiative??0), conditions: Array.isArray(npc.conditions) ? npc.conditions : [], activeEffects: Array.isArray(npc.activeEffects) ? npc.activeEffects : [] }); }) : [],
    encounter: { ...base.encounter, ...(raw.encounter ?? {}),
      order: Array.isArray(raw.encounter?.order) ? raw.encounter.order : [],
      activeBuffs: Array.isArray(raw.encounter?.activeBuffs) ? raw.encounter.activeBuffs : [],
      activeFormas: Array.isArray(raw.encounter?.activeFormas) ? raw.encounter.activeFormas : [],
      preparations: Array.isArray(raw.encounter?.preparations) ? raw.encounter.preparations : [],
      activeOngoingEffects: Array.isArray(raw.encounter?.activeOngoingEffects) ? raw.encounter.activeOngoingEffects : [],
      reactionsUsed: (raw.encounter?.reactionsUsed && typeof raw.encounter.reactionsUsed === 'object') ? raw.encounter.reactionsUsed : {} },
    log: Array.isArray(raw.log) ? raw.log : [],
    tokens: (raw.tokens && typeof raw.tokens === 'object') ? raw.tokens : {},
    benchedCastIds: Array.isArray(raw.benchedCastIds) ? raw.benchedCastIds : [],
    streamingMode: !!raw.streamingMode,
    sceneLibrary: Array.isArray(raw.sceneLibrary) ? raw.sceneLibrary : [],
  };
}

// ─────────────────────────────────────────────────────────────────
// In-memory listener registry
// ─────────────────────────────────────────────────────────────────
type ListenerKey = 'characters' | 'cards' | 'items' | 'seals' | 'weapons' | 'grimoire' | 'combat' | 'journey' | 'cena';
interface SyncOptions { emitInitial?: boolean }
const _listeners: Record<ListenerKey, Function[]> = {
  characters: [], cards: [], items: [], seals: [], weapons: [], grimoire: [], combat: [], journey: [], cena: [],
};

function _notifyLocal(key: ListenerKey, data: any) {
  for (const cb of [..._listeners[key]]) {
    try { cb(data); } catch (e) { console.error(`[DB] listener error (${key}):`, e); }
  }
}

// ─────────────────────────────────────────────────────────────────
// Sincronização genérica entre janelas: qualquer store que já usa
// _notify/_subscribe (characters, cena, grimoire, etc.) passa a refletir
// em outras janelas do mesmo app (ex.: o Dashboard do Mestre em janela
// separada) sem precisar de um canal dedicado por feature.
// ─────────────────────────────────────────────────────────────────
const SYNC_CHANNEL = 'vat-db-sync';
const _syncChannel: BroadcastChannel | null = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(SYNC_CHANNEL);
_syncChannel?.addEventListener('message', (ev: MessageEvent) => {
  const { key, data } = ev.data ?? {};
  if (key && key in _listeners) _notifyLocal(key as ListenerKey, data);
});

function _notify(key: ListenerKey, data: any) {
  _notifyLocal(key, data);
  _syncChannel?.postMessage({ key, data });
}

function _subscribe<T>(key: ListenerKey, cb: (d: T) => void): () => void {
  _listeners[key].push(cb);
  return () => { _listeners[key] = _listeners[key].filter(l => l !== cb); };
}

// ─────────────────────────────────────────────────────────────────
// Broadcast entre janelas (janela de jogadores)
// ─────────────────────────────────────────────────────────────────
const COMBAT_CHANNEL = 'vat-combat';
let _combatChannel: BroadcastChannel | null = null;
function _getCombatChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!_combatChannel) _combatChannel = new BroadcastChannel(COMBAT_CHANNEL);
  return _combatChannel;
}

/** Publica o snapshot de combate para outras janelas (chamado pelo master). */
function _publishCombat(state: CombatState) {
  _getCombatChannel()?.postMessage({ type: 'combat', data: state });
}

// ─────────────────────────────────────────────────────────────────
// Migration from older formats
// ─────────────────────────────────────────────────────────────────
async function runMigrations() {
  const arsenalDone = await _get<any>('meta', '__migration_arsenal_v1');
  if (!arsenalDone?.ok) {
    try {
      const [cards, seals, items, weapons, existing] = await Promise.all([
        _getAll<Card>('cards'), _getAll<Seal>('seals'), _getAll<Item>('items'),
        _getAll<Weapon>('weapons'), _getAll<ArsenalCard>('grimoire'),
      ]);
      const unified = migrateLegacyArsenal({ cards, seals, items, weapons }, existing);
      await _replaceAll('grimoire', unified);
      await _put('meta', { id: '__migration_arsenal_v1', ok: true });
    } catch (e) {
      console.error('[DB] Erro ao unificar o arsenal:', e);
    }
  }

  // Sem flag "rodou uma vez": ensureStandardCardsOnAllTriggers é puro e idempotente (retorna a mesma
  // referência quando não há nada a fazer), então é seguro e barato rodar em todo boot — cobre grafos
  // que ainda não tinham os cartões padrão sem depender de acertar isso numa única execução histórica.
  try {
    const grimoireRaw = await _getAll<unknown>('grimoire');
    const others = grimoireRaw.filter(item => !isAbilityGraphEntry(item));
    const normalized = grimoireRaw.filter(isAbilityGraphEntry).map(normalizeAbilityGraph);
    const migrated = normalized.map(ensureStandardCardsOnAllTriggers);
    const changed = normalized.some((g, i) => g !== migrated[i]);
    if (changed) await _replaceAll('grimoire', [...others, ...migrated]);
  } catch (e) {
    console.error('[DB] Erro ao adicionar cartões padrão aos grafos existentes:', e);
  }
}

// ─────────────────────────────────────────────────────────────────
// Load all from IDB
// ─────────────────────────────────────────────────────────────────
async function loadAll() {
  const [chars, cards, items, seals, weapons, grimoire, combatRec, journeyRec, cenaRec] = await Promise.all([
    _getAll<any>('characters'),
    _getAll<any>('cards'),
    _getAll<any>('items'),
    _getAll<any>('seals'),
    _getAll<any>('weapons'),
    _getAll<any>('grimoire'),
    _get<any>('meta', '__combat'),
    _get<any>('meta', '__journey'),
    _get<any>('meta', '__cena'),
  ]);
  return {
    characters: chars.map(ensureChar),
    cards: cards as Card[],
    items: items as Item[],
    seals: seals.map(ensureSeal) as Seal[],
    weapons: weapons as Weapon[],
    grimoire: (grimoire as unknown[]).filter(item => !isAbilityGraphEntry(item)).map(item => normalizeArsenalCard(item as ArsenalCard)),
    abilityGraphs: (grimoire as unknown[]).filter(isAbilityGraphEntry).map(normalizeAbilityGraph),
    combat: ensureCombat(combatRec?.value),
    journey: ensureJourney(journeyRec?.value),
    cena: ensureCena(cenaRec?.value),
  };
}

// ─────────────────────────────────────────────────────────────────
// DatabaseService — interface pública
// ─────────────────────────────────────────────────────────────────
export const DatabaseService = {

  // ── Boot: carrega tudo de uma vez ───────────────────────────────
  initialize: async (): Promise<{
    characters: Character[];
    cards: Card[];
    items: Item[];
    seals: Seal[];
    weapons: Weapon[];
    grimoire: ArsenalCard[];
    abilityGraphs: AbilityGraph[];
    combat: CombatState;
    journey: JourneyState;
    cena: CenaState;
  }> => {
    await runMigrations();
    return loadAll();
  },

  // ── Subscriptions (chamadas no mount do componente) ─────────────
  syncCharacters: (cb: (d: Character[]) => void, options: SyncOptions = {}) => {
    if (options.emitInitial !== false) _getAll<Character>('characters').then(d => cb(d.map(ensureChar))).catch(() => cb([]));
    return _subscribe<Character[]>('characters', cb);
  },
  syncCards: (cb: (d: Card[]) => void, options: SyncOptions = {}) => {
    if (options.emitInitial !== false) _getAll<Card>('cards').then(d => cb(d)).catch(() => cb([]));
    return _subscribe<Card[]>('cards', cb);
  },
  syncItems: (cb: (d: Item[]) => void, options: SyncOptions = {}) => {
    if (options.emitInitial !== false) _getAll<Item>('items').then(d => cb(d)).catch(() => cb([]));
    return _subscribe<Item[]>('items', cb);
  },
  syncSeals: (cb: (d: Seal[]) => void, options: SyncOptions = {}) => {
    if (options.emitInitial !== false) _getAll<Seal>('seals').then(d => cb(d.map(ensureSeal))).catch(() => cb([]));
    return _subscribe<Seal[]>('seals', cb);
  },
  syncWeapons: (cb: (d: Weapon[]) => void, options: SyncOptions = {}) => {
    if (options.emitInitial !== false) _getAll<Weapon>('weapons').then(d => cb(d)).catch(() => cb([]));
    return _subscribe<Weapon[]>('weapons', cb);
  },
  syncGrimoire: (cb: (d: ArsenalCard[]) => void, options: SyncOptions = {}) => {
    const normalize = (raw: unknown[]) => raw.filter(item => !isAbilityGraphEntry(item)).map(item => normalizeArsenalCard(item as ArsenalCard));
    if (options.emitInitial !== false) _getAll<unknown>('grimoire').then(d => cb(normalize(d))).catch(() => cb([]));
    return _subscribe<unknown[]>('grimoire', d => cb(normalize(d)));
  },
  // Alias canônico para a futura UI; syncGrimoire permanece por compatibilidade.
  syncArsenalCards: (cb: (d: ArsenalCard[]) => void, options?: SyncOptions) => DatabaseService.syncGrimoire(cb, options),
  /** Habilidades/formas do novo sistema de grafo — mesmo store `grimoire`, entradas com kind:'graph'. */
  syncAbilityGraphs: (cb: (d: AbilityGraph[]) => void, options: SyncOptions = {}) => {
    const normalize = (raw: unknown[]) => raw.filter(isAbilityGraphEntry).map(normalizeAbilityGraph);
    if (options.emitInitial !== false) _getAll<unknown>('grimoire').then(d => cb(normalize(d))).catch(() => cb([]));
    return _subscribe<unknown[]>('grimoire', d => cb(normalize(d)));
  },
  syncCombatState: (cb: (d: CombatState) => void, options: SyncOptions = {}) => {
    if (options.emitInitial !== false) _get<any>('meta', '__combat').then(r => cb(ensureCombat(r?.value))).catch(() => cb({ ...DEFAULT_COMBAT }));
    return _subscribe<CombatState>('combat', cb);
  },
  syncJourneyState: (cb: (d: JourneyState) => void, options: SyncOptions = {}) => {
    if (options.emitInitial !== false) _get<any>('meta', '__journey').then(r => cb(ensureJourney(r?.value))).catch(() => cb({ ...DEFAULT_JOURNEY }));
    return _subscribe<JourneyState>('journey', cb);
  },
  syncCenaState: (cb: (d: CenaState) => void, options: SyncOptions = {}) => {
    if (options.emitInitial !== false) _get<any>('meta', '__cena').then(r => cb(ensureCena(r?.value))).catch(() => cb(createDefaultCena()));
    return _subscribe<CenaState>('cena', cb);
  },

  // ── Saves individuais ────────────────────────────────────────────
  saveCharacter: async (char: Character) => {
    const c = ensureChar(char);
    await _put('characters', c);
    _notify('characters', (await _getAll<Character>('characters')).map(ensureChar));
  },
  deleteCharacter: async (id: string) => {
    await _delete('characters', id);
    _notify('characters', (await _getAll<Character>('characters')).map(ensureChar));
  },

  saveCard: async (card: Card) => {
    await _put('cards', card);
    await _put('grimoire', cardToArsenal(card));
    _notify('cards', await _getAll<Card>('cards'));
    _notify('grimoire', await _getAll<ArsenalCard>('grimoire'));
  },
  deleteCard: async (id: string) => {
    await _delete('cards', id);
    await _delete('grimoire', id);
    _notify('cards', await _getAll<Card>('cards'));
    _notify('grimoire', await _getAll<ArsenalCard>('grimoire'));
  },

  saveItem: async (item: Item) => {
    await _put('items', item);
    await _put('grimoire', itemToArsenal(item));
    _notify('items', await _getAll<Item>('items'));
    _notify('grimoire', await _getAll<ArsenalCard>('grimoire'));
  },
  deleteItem: async (id: string) => {
    await _delete('items', id);
    await _delete('grimoire', id);
    _notify('items', await _getAll<Item>('items'));
    _notify('grimoire', await _getAll<ArsenalCard>('grimoire'));
  },

  saveSeal: async (seal: Seal) => {
    await _put('seals', seal);
    await _put('grimoire', sealToArsenal(seal));
    _notify('seals', (await _getAll<Seal>('seals')).map(ensureSeal));
    _notify('grimoire', await _getAll<ArsenalCard>('grimoire'));
  },
  deleteSeal: async (id: string) => {
    await _delete('seals', id);
    await _delete('grimoire', id);
    _notify('seals', (await _getAll<Seal>('seals')).map(ensureSeal));
    _notify('grimoire', await _getAll<ArsenalCard>('grimoire'));
  },

  saveWeapon: async (weapon: Weapon) => {
    await _put('weapons', weapon);
    await _put('grimoire', weaponToArsenal(weapon));
    _notify('weapons', await _getAll<Weapon>('weapons'));
    _notify('grimoire', await _getAll<ArsenalCard>('grimoire'));
  },
  deleteWeapon: async (id: string) => {
    await _delete('weapons', id);
    await _delete('grimoire', id);
    _notify('weapons', await _getAll<Weapon>('weapons'));
    _notify('grimoire', await _getAll<ArsenalCard>('grimoire'));
  },

  saveGrimoireEntry: async (entry: ArsenalCard) => {
    await _put('grimoire', normalizeArsenalCard(entry));
    _notify('grimoire', await _getAll<ArsenalCard>('grimoire'));
  },
  deleteGrimoireEntry: async (id: string) => {
    await _delete('grimoire', id);
    _notify('grimoire', await _getAll<ArsenalCard>('grimoire'));
  },
  saveArsenalCard: async (entry: ArsenalCard) => DatabaseService.saveGrimoireEntry(entry),
  deleteArsenalCard: async (id: string) => {
    const entry = await _get<ArsenalCard>('grimoire', id);
    await _delete('grimoire', id);
    const legacyStore = entry?.category === 'habilidade' ? 'cards' : entry?.category === 'selo' ? 'seals' : entry?.category === 'item' ? 'items' : entry?.category === 'arma' ? 'weapons' : null;
    if (legacyStore) await _delete(legacyStore, id);
    _notify('grimoire', await _getAll<ArsenalCard>('grimoire'));
    if (legacyStore) _notify(legacyStore, await _getAll(legacyStore) as any);
  },

  saveAbilityGraph: async (graph: AbilityGraph) => {
    await _put('grimoire', normalizeAbilityGraph(graph));
    _notify('grimoire', await _getAll('grimoire'));
  },
  deleteAbilityGraph: async (id: string) => {
    await _delete('grimoire', id);
    _notify('grimoire', await _getAll('grimoire'));
  },

  updateCombat: async (state: CombatState) => {
    await _put('meta', { id: '__combat', value: state });
    _notify('combat', state);
    _publishCombat(state);
  },

  /** Master: publica o estado atual sob demanda (resposta a um 'request' do espelho). */
  publishCombat: (state: CombatState) => _publishCombat(state),

  /** Espelho: assina os snapshots de combate vindos de outra janela. Retorna unsubscribe. */
  subscribeRemoteCombat: (cb: (state: CombatState) => void): (() => void) => {
    const ch = _getCombatChannel();
    if (!ch) return () => {};
    const handler = (ev: MessageEvent) => {
      if (ev.data?.type === 'combat') cb(ev.data.data as CombatState);
    };
    ch.addEventListener('message', handler);
    return () => ch.removeEventListener('message', handler);
  },

  /** Espelho: pede ao master o snapshot atual (responde com 'combat'). */
  requestCombat: () => _getCombatChannel()?.postMessage({ type: 'request' }),

  /** Master: escuta 'request' do espelho. Retorna unsubscribe. */
  onCombatRequest: (cb: () => void): (() => void) => {
    const ch = _getCombatChannel();
    if (!ch) return () => {};
    const handler = (ev: MessageEvent) => { if (ev.data?.type === 'request') cb(); };
    ch.addEventListener('message', handler);
    return () => ch.removeEventListener('message', handler);
  },
  updateJourney: async (state: JourneyState) => {
    await _put('meta', { id: '__journey', value: state });
    _notify('journey', state);
  },
  updateCena: async (state: CenaState) => {
    await _put('meta', { id: '__cena', value: state });
    _notify('cena', state);
  },

  // ── Snapshot: salva TUDO de uma vez ─────────────────────────────
  saveFullSnapshot: async (snapshot: AppSnapshot, options: { notify?: boolean } = {}): Promise<void> => {
    await _writeSnapshotAtomic(snapshot);
    if (options.notify === false) return;
    // Notifica todos os listeners apenas em restaurações/importações.
    _notify('characters', snapshot.characters.map(ensureChar));
    _notify('cards', snapshot.cards);
    _notify('items', snapshot.items);
    _notify('seals', snapshot.seals.map(ensureSeal));
    _notify('weapons', snapshot.weapons ?? []);
    _notify('grimoire', [
      ...(snapshot.grimoire ?? []).map(normalizeArsenalCard),
      ...(snapshot.abilityGraphs ?? []).map(normalizeAbilityGraph),
    ]);
    _notify('combat', snapshot.combat);
    _publishCombat(snapshot.combat);
    _notify('journey', snapshot.journey);
    _notify('cena', snapshot.cena);
  },

};
