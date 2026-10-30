import type { Cell, Character, Grid, Id, InitiativeEntry, ResourceKey } from './model';

export type Command =
  | { type: 'createCharacter'; input: Omit<Character, 'id'> }
  | { type: 'updateCharacter'; characterId: Id; patch: Partial<Omit<Character, 'id' | 'resources' | 'defense' | 'stagger' | 'conditions' | 'actions' | 'cooldowns'>> }
  | { type: 'deleteCharacter'; characterId: Id }
  | { type: 'setResource'; characterId: Id; resource: ResourceKey; current?: number; max?: number }
  | { type: 'placeToken'; characterId: Id; cell: Cell; hidden?: boolean }
  | { type: 'moveToken'; tokenId: Id; to: Cell }
  | { type: 'removeToken'; tokenId: Id }
  | { type: 'setTokenHidden'; tokenId: Id; hidden: boolean }
  | { type: 'updateGrid'; grid: Grid; background: string }
  | { type: 'startEncounter'; entries: InitiativeEntry[] }
  | { type: 'nextTurn' }
  | { type: 'reorderInitiative'; order: Id[] }
  | { type: 'endEncounter' };

export type ErrorCode =
  | 'not_gm'
  | 'not_found'
  | 'out_of_bounds'
  | 'cell_occupied'
  | 'not_your_token'
  | 'not_your_turn'
  | 'invalid_value'
  | 'no_encounter'
  | 'encounter_active'
  | 'tokens_out_of_bounds'
  | 'invalid_order'
  | 'conflict';

/** Todos os valores válidos de `Command['type']`; o servidor valida o corpo contra esta lista. */
export const COMMAND_TYPES: readonly Command['type'][] = [
  'createCharacter', 'updateCharacter', 'deleteCharacter', 'setResource',
  'placeToken', 'moveToken', 'removeToken', 'setTokenHidden',
  'updateGrid', 'startEncounter', 'nextTurn', 'reorderInitiative', 'endEncounter',
];
