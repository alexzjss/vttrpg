import type { Action } from './actions';
import type { ConditionId } from './conditions';
import type { DiceRoll, PhysicalRoll } from './dice';
import type { Defense, Stagger } from './rules/defense';
import type { Affinity, Element } from './rules/elements';

export type Id = string;
export interface Cell { col: number; row: number }
export interface Pool { current: number; max: number }
export type ResourceKey = 'hp' | 'aura' | 'ammo';
export type Resources = Record<ResourceKey, Pool>;
export type HpVisibility = 'exact' | 'band' | 'hidden';
export interface Character {
  id: Id; kind: 'pc' | 'npc'; name: string;
  portrait: string; fullBodyArt: string; tokenImage: string; // URLs ou data URLs; '' = sem imagem
  resources: Resources; speed: number;
  hpVisibility: HpVisibility; // só tem efeito em NPCs; PCs sempre 'exact'
  defense: Defense; stagger: Stagger;
  affinities: Partial<Record<Element, Affinity>>;
  conditions: ActiveCondition[];
  actions: Action[];
  /** Rodadas que faltam para cada ação (chave = id da ação) voltar a ficar disponível. */
  cooldowns: Record<Id, number>;
}
/** `duration` = rodadas que faltam. */
export interface ActiveCondition { id: ConditionId; duration: number }
export interface Token { id: Id; characterId: Id; cell: Cell; size: 1; hidden: boolean }
export interface Grid { cols: number; rows: number; cellSize: number; visible: boolean }
export interface Scene { id: Id; name: string; mode: 'tactical'; background: string; grid: Grid; tokens: Record<Id, Token> }
export interface InitiativeEntry { tokenId: Id; initiative: number }
export interface Encounter { active: boolean; round: number; turnIndex: number; order: InitiativeEntry[] }
export type LogVisibility = 'public' | 'gm' | 'private';
export type LogBody =
  | { kind: 'roll'; rollerId: Id | null; label: string; roll: DiceRoll }
  | { kind: 'action'; actorId: Id; actionName: string; targetIds: Id[];
      test?: { roll: DiceRoll; against: number; outcome: 'hit' | 'miss' | 'crit' | 'fumble' } }
  | { kind: 'damage'; targetId: Id; amount: number; element: Element; affinity?: Affinity; crit: boolean }
  | { kind: 'heal'; targetId: Id; amount: number; resource: ResourceKey }
  | { kind: 'condition'; targetId: Id; conditionId: ConditionId; change: 'applied' | 'removed' | 'expired' }
  | { kind: 'defense'; targetId: Id; change: 'broken' | 'restored' | 'staggered' | 'recovered' }
  | { kind: 'turnSkipped'; characterId: Id; reason: 'stagger' | ConditionId }
  | { kind: 'requestRejected'; actorId: Id; actionName: string; note: string }
  | { kind: 'cost'; actorId: Id; costs: Partial<Record<ResourceKey, number>> };
export type LogEntry = LogBody & { id: Id; visibility: LogVisibility; playerId?: Id };
/** `requestedBy` é o characterId do jogador que pediu. */
export interface ActionRequest {
  id: Id; actorId: Id; actionId: Id; targetIds: Id[]; rolls: PhysicalRoll[]; requestedBy: Id;
}
export interface CampaignSettings { requireApproval: boolean }
export interface CampaignState {
  version: 2;
  campaignId: Id; name: string; revision: number;
  settings: CampaignSettings;
  log: LogEntry[];
  requests: Record<Id, ActionRequest>;
  /** Última sequência entregue a cada audiência (chave = audienceKey); ausente = 0. */
  audienceSeq: Record<string, number>;
  characters: Record<Id, Character>; scene: Scene; encounter: Encounter;
}
export type Actor = { role: 'gm' } | { role: 'player'; characterId: Id };
