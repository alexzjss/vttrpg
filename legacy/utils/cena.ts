import type { Character } from '../types';
import type { BuffStat } from './grimoire';
import type { ArsenalEffect } from './arsenal';
import { migrateCharacterDefense } from './defense';

/** Clima da cena (mesma união usada na jornada legada, mantida por familiaridade). */
/** Estado narrativo/ambiental do local atual. */
export interface SceneState {
  locationName: string;
  subtitle: string;
  image: string;
  /** CSS `background-position` da imagem de cena (ex.: "50% 30%"). */
  imagePosition?: string;
  /** Imagem exibida em tela cheia, por cima da cena, só enquanto o combate está pausado. */
  pausedImage?: string;
  pausedImagePosition?: string;
  isNight: boolean;
  notes: string;
}

export type PausedDisplayKind = 'habilidade' | 'selo' | 'arma' | 'item' | 'personagem' | 'custom';

export interface PausedDisplayItemState {
  id: string;
  kind: PausedDisplayKind;
  title: string;
  subtitle?: string;
  description?: string;
  image: string;
  imagePosition?: string;
  preset?: 'center' | 'left' | 'right' | 'full' | 'corner';
  size: number;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  nonce: number;
}

export interface PausedDisplayState extends PausedDisplayItemState {
  items?: PausedDisplayItemState[];
}

export interface SceneLibraryTemplate {
  id: string;
  name: string;
  description: string;
  scene: SceneState;
  npcIds: string[];
  tokens: Record<string, { x: number; y: number }>;
}

/**
 * NPC/inimigo: mesma ficha de um Character, em roster próprio da aba.
 * `hidden` = oculto dos jogadores; `present` = está na cena atual (entra no combate).
 */
export interface NpcEntry extends Character {
  isNpc: true;
  hidden: boolean;
  present: boolean;
}

/** Uma entrada na ordem de iniciativa do encounter. */
export interface EncounterEntry {
  /** id do Character (party) ou do NpcEntry. */
  refId: string;
  side: 'party' | 'npc';
  initiative: number;
}

/** Slots de ação do turno atual. */
export interface EncounterTurnState { majorUsed: boolean; minorUsed: boolean }

/** Buff temporário registrado no encounter. */
export interface ActiveBuff {
  targetId: string;
  stat: BuffStat;
  value: number;
  roundsRemaining: number;
  source: string;
}

/** Forma (transformação) ativa. roundsRemaining 0 = permanente até o fim do combate. */
export interface ActiveFormaState {
  ownerId: string;
  entryId: string;
  roundsRemaining: number;
  /** Quanto de maxHp a forma somou, para desfazer ao reverter. */
  hpBonusApplied: number;
  /** Quanto de maxAura a forma somou, para desfazer ao reverter. */
  auraBonusApplied: number;
}

/**
 * Efeito de campo de batalha: origem em `TargetConfig` do tipo `campo_de_batalha`.
 * Não pertence a nenhum combatente — vive só no encounter e por isso afeta
 * automaticamente qualquer um presente a cada rodada, incluindo quem entrar
 * no combate depois do cast.
 */
export interface ActiveFieldEffect {
  id: string;
  /** Quem conjurou — só para atribuição no log, não é dono do efeito. */
  sourceId: string;
  sourceName: string;
  /** ArsenalCard que originou o efeito. */
  entryId: string;
  effect: ArsenalEffect;
  /** null = permanente até dissipar manualmente ou o combate encerrar. */
  roundsRemaining: number | null;
}

/** Efeito contínuo aplicado por um bloco 'aplicar_como_efeito' — roda a árvore 'enquanto_ativa' do grafo a cada início de turno do dono. */
export interface OngoingEffectState {
  id: string;
  ownerId: string;
  casterId: string;
  graphId: string;
  roundsRemaining: number;
  pendingReactions?: { eventType: string; nodeIds: string[] }[];
  /** Cartas liberadas por um nó 'liberar_cartas' alcançável enquanto este efeito estiver ativo. */
  unlockCardIntents?: { cardIds: string[]; tags: string[]; element: string | null; cardType: string | null }[];
}

/** Combo em preparação (dispara quando roundsRemaining chega a 0). */
export interface PreparationState {
  ownerId: string;
  entryId: string;
  roundsRemaining: number;
  participantIds: string[];
  /** Alvos escolhidos ao iniciar uma Carta de Arsenal preparada. */
  targetIds?: string[];
}

/** Estado de combate v2. */
export interface EncounterState {
  isActive: boolean;
  round: number;
  turnIndex: number;
  order: EncounterEntry[];
  turn: EncounterTurnState;
  /** Quando true, o mestre pausou o avanço de turno (próximo/anterior ficam bloqueados). */
  isPaused: boolean;
  /** id → já reagiu nesta rodada. */
  reactionsUsed: Record<string, boolean>;
  activeBuffs: ActiveBuff[];
  activeFormas: ActiveFormaState[];
  preparations: PreparationState[];
  fieldEffects: ActiveFieldEffect[];
  activeOngoingEffects: OngoingEffectState[];
}

/** Uma linha do log automático (rolagens, dano, condições, sistema). */
export interface CenaLogEntry {
  id: string;
  kind: 'roll' | 'damage' | 'condition' | 'system' | 'round';
  text: string;
  timestamp: number;
  /** Dados estruturados para apresentar a rolagem sem interpretar o texto do log. */
  roll?: {
    notation: string;
    total: number;
    individualRolls: number[];
    numSides: number;
    bonus: number;
    actorLabel: string;
    targetLabel?: string;
    targetValue?: number;
    success?: boolean;
  };
  /** Metadados opcionais permitem que o painel apresente o resultado sem
   * precisar extrair números do texto. Entradas antigas continuam válidas. */
  details?: {
    actionLabel?: string;
    actorLabel?: string;
    targetLabel?: string;
    sourceLabel?: string;
    amount?: number;
    resource?: 'HP' | 'Aura' | 'Munição';
    damageType?: string;
    durationLabel?: string;
    remainingLabel?: string;
    outcome?: 'success' | 'failure' | 'critical' | 'fumble' | 'applied' | 'renewed' | 'expired' | 'immune' | 'defeated';
    notes?: string[];
  };
}

/** Estado completo e próprio da aba Cena. */
export interface CenaState {
  scene: SceneState;
  npcRoster: NpcEntry[];
  encounter: EncounterState;
  log: CenaLogEntry[];
  /** Posições dos tokens no mapa, por id de participante (% do mapa, 0–100). */
  tokens: Record<string, { x: number; y: number }>;
  /** ids de personagens do elenco (role 'cast') temporariamente fora do combate atual. */
  benchedCastIds: string[];
  /** Quando ativo, oculta HP/Aura exatos de NPCs e as notas do mestre na tela principal — pra streaming/captura de tela. */
  streamingMode?: boolean;
  sceneLibrary: SceneLibraryTemplate[];
  pausedDisplay?: PausedDisplayState | null;
}

export const DEFAULT_SCENE: SceneState = {
  locationName: 'Local Desconhecido',
  subtitle: '',
  image: '',
  isNight: false,
  notes: '',
};

export const DEFAULT_ENCOUNTER: EncounterState = {
  isActive: false,
  round: 1,
  turnIndex: 0,
  order: [],
  turn: { majorUsed: false, minorUsed: false },
  isPaused: false,
  reactionsUsed: {},
  activeBuffs: [],
  activeFormas: [],
  preparations: [],
  fieldEffects: [],
  activeOngoingEffects: [],
};

/** Cópia profunda e independente do encounter default. */
export function createDefaultEncounter(): EncounterState {
  return {
    ...DEFAULT_ENCOUNTER,
    order: [],
    turn: { majorUsed: false, minorUsed: false },
    reactionsUsed: {},
    activeBuffs: [],
    activeFormas: [],
    preparations: [],
    fieldEffects: [],
    activeOngoingEffects: [],
  };
}

/** Cria um CenaState novo com cópias independentes de scene e encounter. */
export function createDefaultCena(): CenaState {
  return {
    scene: { ...DEFAULT_SCENE },
    npcRoster: [],
    encounter: createDefaultEncounter(),
    log: [],
    tokens: {},
    benchedCastIds: [],
    streamingMode: false,
    sceneLibrary: [],
    pausedDisplay: null,
  };
}

/** Merge parcial imutável em scene. */
export function setScene(cena: CenaState, partial: Partial<SceneState>): CenaState {
  return { ...cena, scene: { ...cena.scene, ...partial } };
}

export function setPausedDisplay(cena: CenaState, pausedDisplay: PausedDisplayState | null): CenaState {
  return { ...cena, pausedDisplay };
}

/** Liga/desliga o modo streaming (oculta HP de NPCs e notas do mestre na tela principal). */
export function setStreamingMode(cena: CenaState, streamingMode: boolean): CenaState {
  return { ...cena, streamingMode };
}

/** Cria um NpcEntry (presente, revelado) a partir de um Character e o adiciona ao roster.
 *  No-op (retorna a mesma referência) se já houver NPC com o mesmo id. */
export function addNpcFromCharacter(cena: CenaState, char: Character): CenaState {
  if (cena.npcRoster.some(n => n.id === char.id)) return cena;
  const npc: NpcEntry = { ...migrateCharacterDefense(char), isNpc: true, hidden: false, present: true };
  return { ...cena, npcRoster: [...cena.npcRoster, npc] };
}

/** Remove um NPC do roster pelo id. */
export function removeNpc(cena: CenaState, npcId: string): CenaState {
  return { ...cena, npcRoster: cena.npcRoster.filter(n => n.id !== npcId) };
}

/** Inverte o estado oculto/revelado de um NPC. */
export function toggleNpcHidden(cena: CenaState, npcId: string): CenaState {
  return { ...cena, npcRoster: cena.npcRoster.map(n => n.id === npcId ? { ...n, hidden: !n.hidden } : n) };
}

/** Inverte se o NPC está presente na cena. */
export function toggleNpcPresent(cena: CenaState, npcId: string): CenaState {
  return { ...cena, npcRoster: cena.npcRoster.map(n => n.id === npcId ? { ...n, present: !n.present } : n) };
}

/** Define/atualiza a posição de um token (imutável). */
export function setToken(cena: CenaState, id: string, pos: { x: number; y: number }): CenaState {
  return { ...cena, tokens: { ...cena.tokens, [id]: pos } };
}

/** Liga/desliga o encounter (modo combate visual nesta fase). */
export function setEncounterActive(cena: CenaState, active: boolean): CenaState {
  return { ...cena, encounter: { ...cena.encounter, isActive: active } };
}

/** Pausa/retoma o avanço de turno sem afetar o restante do combate. */
export function setEncounterPaused(cena: CenaState, paused: boolean): CenaState {
  return { ...cena, encounter: { ...cena.encounter, isPaused: paused } };
}

/** Marca um membro do elenco como fora do combate atual (sem removê-lo do elenco). No-op se já banido. */
export function benchCastMember(cena: CenaState, id: string): CenaState {
  if (cena.benchedCastIds.includes(id)) return cena;
  return { ...cena, benchedCastIds: [...cena.benchedCastIds, id] };
}

/** Reinclui um membro do elenco banido no combate atual. */
export function unbenchCastMember(cena: CenaState, id: string): CenaState {
  return { ...cena, benchedCastIds: cena.benchedCastIds.filter(existing => existing !== id) };
}

/** Esvazia o log de combate (mantém encounter intocado). */
export function clearLog(cena: CenaState): CenaState {
  return { ...cena, log: [] };
}

let _logSeq = 0;
/** Cria uma entrada de log com id único e timestamp atual. */
export function logEntry(kind: CenaLogEntry['kind'], text: string, roll?: CenaLogEntry['roll'], details?: CenaLogEntry['details']): CenaLogEntry {
  _logSeq += 1;
  return { id: `log-${Date.now()}-${_logSeq}`, kind, text, timestamp: Date.now(), ...(roll ? { roll } : {}), ...(details ? { details } : {}) };
}
/** Anexa entradas ao log (imutável). */
export function appendLog(cena: CenaState, entries: CenaLogEntry[]): CenaState {
  return { ...cena, log: [...cena.log, ...entries] };
}

/** Mescla updates de stats/condições num NPC do roster (imutável). */
export function updateNpcStats(cena: CenaState, npcId: string, updates: Partial<Character>): CenaState {
  return { ...cena, npcRoster: cena.npcRoster.map(n => n.id === npcId ? { ...n, ...updates } : n) };
}

/** Incorpora mudanças da ficha-fonte sem apagar o estado transitório adquirido no combate. */
export function syncNpcFromCharacter(npc: NpcEntry, source: Character): NpcEntry {
  const runtimeHoldings=new Map((npc.arsenal??[]).map(holding=>[holding.cardId,holding]));
  const arsenal=(source.arsenal??[]).map(incoming=>{
    const runtime=runtimeHoldings.get(incoming.cardId);
    return runtime?{...incoming,...runtime}:{...incoming};
  });
  return {
    ...migrateCharacterDefense({ ...npc, ...source }),arsenal,
    currentHp:Math.min(npc.currentHp,source.maxHp),currentAura:Math.min(npc.currentAura,source.maxAura),currentAmmo:Math.min(npc.currentAmmo,source.maxAmmo),
    conditions:npc.conditions,activeEffects:npc.activeEffects,
    defenseCurrent:npc.defenseCurrent,staggerCurrent:npc.staggerCurrent,isDefenseBroken:npc.isDefenseBroken,isStaggered:npc.isStaggered,staggerTurnsRemaining:npc.staggerTurnsRemaining,
    isNpc:true,hidden:npc.hidden,present:npc.present,
  };
}

/** Mescla atribuições feitas durante o combate preservando cargas/cooldowns existentes. */
export function mergeNpcLiveUpdates(npc:NpcEntry,updates:Partial<Character>,sourceBefore?:Character):NpcEntry {
  if(!updates.arsenal)return{...npc,...updates};
  const runtime=new Map((npc.arsenal??[]).map(holding=>[holding.cardId,holding]));
  const previousSource=new Map((sourceBefore?.arsenal??[]).map(holding=>[holding.cardId,holding]));
  const arsenal=updates.arsenal.map(incoming=>{
    const current=runtime.get(incoming.cardId);
    if(!current)return{...incoming};
    const previous=previousSource.get(incoming.cardId);
    const quantity=previous
      ? Math.max(0,current.quantity+(incoming.quantity-previous.quantity))
      : current.quantity;
    return {
      ...incoming,
      quantity,
      equipped:current.equipped,
      active:current.active,
      ...(current.currentCharges===undefined?{}:{currentCharges:current.currentCharges}),
      ...(current.cooldownRemaining===undefined?{}:{cooldownRemaining:current.cooldownRemaining}),
    };
  });
  return{...npc,...updates,arsenal};
}
