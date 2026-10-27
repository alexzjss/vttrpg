import type { Cell, Character, Grid, Id, InitiativeEntry, Pool, ResourceKey, Token } from './model';

export type GameEvent =
  | { type: 'characterCreated'; character: Character }
  | { type: 'characterUpdated'; characterId: Id; patch: Partial<Omit<Character, 'id' | 'resources'>> }
  | { type: 'characterDeleted'; characterId: Id }
  | { type: 'resourceSet'; characterId: Id; resource: ResourceKey; pool: Pool }
  | { type: 'tokenPlaced'; token: Token }
  | { type: 'tokenMoved'; tokenId: Id; from: Cell; to: Cell }
  | { type: 'tokenRemoved'; tokenId: Id }
  | { type: 'tokenVisibilitySet'; tokenId: Id; hidden: boolean }
  | { type: 'gridUpdated'; grid: Grid; background: string }
  | { type: 'encounterStarted'; order: InitiativeEntry[] }
  | { type: 'turnAdvanced'; turnIndex: number; round: number }
  | { type: 'initiativeReordered'; order: InitiativeEntry[] }
  | { type: 'encounterEnded' };
