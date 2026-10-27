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
}
export interface Token { id: Id; characterId: Id; cell: Cell; size: 1; hidden: boolean }
export interface Grid { cols: number; rows: number; cellSize: number; visible: boolean }
export interface Scene { id: Id; name: string; mode: 'tactical'; background: string; grid: Grid; tokens: Record<Id, Token> }
export interface InitiativeEntry { tokenId: Id; initiative: number }
export interface Encounter { active: boolean; round: number; turnIndex: number; order: InitiativeEntry[] }
export interface CampaignState {
  campaignId: Id; name: string; revision: number;
  /** Última sequência entregue a cada audiência (chave = audienceKey); ausente = 0. */
  audienceSeq: Record<string, number>;
  characters: Record<Id, Character>; scene: Scene; encounter: Encounter;
}
export type Actor = { role: 'gm' } | { role: 'player'; characterId: Id };
