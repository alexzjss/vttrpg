import type { Command, ErrorCode } from './commands';
import type { GameEvent } from './events';
import { sortInitiative } from './initiative';
import type { Actor, CampaignState, Cell, Id, Token } from './model';

export interface DecideContext { actor: Actor; newId: () => Id }
export type DecideResult = { ok: true; events: GameEvent[] } | { ok: false; error: ErrorCode };

const ok = (events: GameEvent[]): DecideResult => ({ ok: true, events });
const fail = (error: ErrorCode): DecideResult => ({ ok: false, error });

type Handler<T extends Command['type']> = (
  state: CampaignState,
  cmd: Extract<Command, { type: T }>,
  ctx: DecideContext,
) => DecideResult;
type Handlers = { [K in Command['type']]: Handler<K> };

const inBounds = (state: CampaignState, c: Cell) =>
  Number.isInteger(c.col) && Number.isInteger(c.row) &&
  c.col >= 0 && c.col < state.scene.grid.cols && c.row >= 0 && c.row < state.scene.grid.rows;

const occupied = (state: CampaignState, c: Cell, exceptTokenId?: Id) =>
  Object.values(state.scene.tokens).some(
    (t) => t.id !== exceptTokenId && t.cell.col === c.col && t.cell.row === c.row,
  );

const currentTokenId = (state: CampaignState): Id | undefined =>
  state.encounter.order[state.encounter.turnIndex]?.tokenId;

const isNonNegInt = (v: number) => Number.isInteger(v) && v >= 0;
const inRange = (v: number, min: number, max: number) => Number.isInteger(v) && v >= min && v <= max;

const handlers: Handlers = {
  createCharacter(_state, cmd, ctx) {
    if (cmd.input.name.trim() === '') return fail('invalid_value');
    return ok([{ type: 'characterCreated', character: { ...cmd.input, id: ctx.newId() } }]);
  },

  updateCharacter(state, cmd) {
    if (!state.characters[cmd.characterId]) return fail('not_found');
    if (cmd.patch.name !== undefined && cmd.patch.name.trim() === '') return fail('invalid_value');
    const patch = Object.fromEntries(
      Object.entries(cmd.patch).filter(([, v]) => v !== undefined),
    ) as typeof cmd.patch;
    return ok([{ type: 'characterUpdated', characterId: cmd.characterId, patch }]);
  },

  deleteCharacter(state, cmd) {
    if (!state.characters[cmd.characterId]) return fail('not_found');
    const removals = Object.values(state.scene.tokens)
      .filter((t) => t.characterId === cmd.characterId)
      .map((t): GameEvent => ({ type: 'tokenRemoved', tokenId: t.id }));
    return ok([...removals, { type: 'characterDeleted', characterId: cmd.characterId }]);
  },

  setResource(state, cmd) {
    const c = state.characters[cmd.characterId];
    if (!c) return fail('not_found');
    const pool = c.resources[cmd.resource];
    const max = cmd.max ?? pool.max;
    const current = cmd.current ?? pool.current;
    if (!isNonNegInt(max) || !isNonNegInt(current)) return fail('invalid_value');
    if (cmd.resource === 'hp' && max < 1) return fail('invalid_value');
    return ok([
      {
        type: 'resourceSet',
        characterId: cmd.characterId,
        resource: cmd.resource,
        pool: { current: Math.min(current, max), max },
      },
    ]);
  },

  placeToken(state, cmd, ctx) {
    if (!state.characters[cmd.characterId]) return fail('not_found');
    if (!inBounds(state, cmd.cell)) return fail('out_of_bounds');
    if (occupied(state, cmd.cell)) return fail('cell_occupied');
    const token: Token = {
      id: ctx.newId(), characterId: cmd.characterId, cell: cmd.cell, size: 1, hidden: cmd.hidden ?? false,
    };
    return ok([{ type: 'tokenPlaced', token }]);
  },

  moveToken(state, cmd, ctx) {
    const token = state.scene.tokens[cmd.tokenId];
    if (!token) return fail('not_found');
    if (ctx.actor.role === 'player') {
      if (token.characterId !== ctx.actor.characterId) return fail('not_your_token');
      if (state.encounter.active && currentTokenId(state) !== token.id) return fail('not_your_turn');
    }
    if (!inBounds(state, cmd.to)) return fail('out_of_bounds');
    if (token.cell.col === cmd.to.col && token.cell.row === cmd.to.row) return ok([]);
    if (occupied(state, cmd.to, token.id)) return fail('cell_occupied');
    return ok([{ type: 'tokenMoved', tokenId: token.id, from: token.cell, to: cmd.to }]);
  },

  removeToken(state, cmd) {
    if (!state.scene.tokens[cmd.tokenId]) return fail('not_found');
    return ok([{ type: 'tokenRemoved', tokenId: cmd.tokenId }]);
  },

  setTokenHidden(state, cmd) {
    if (!state.scene.tokens[cmd.tokenId]) return fail('not_found');
    return ok([{ type: 'tokenVisibilitySet', tokenId: cmd.tokenId, hidden: cmd.hidden }]);
  },

  updateGrid(state, cmd) {
    const { cols, rows, cellSize } = cmd.grid;
    if (!inRange(cols, 1, 100) || !inRange(rows, 1, 100) || !inRange(cellSize, 16, 256)) {
      return fail('invalid_value');
    }
    const outside = Object.values(state.scene.tokens).some((t) => t.cell.col >= cols || t.cell.row >= rows);
    if (outside) return fail('tokens_out_of_bounds');
    return ok([{ type: 'gridUpdated', grid: cmd.grid, background: cmd.background }]);
  },

  startEncounter(state, cmd) {
    if (state.encounter.active) return fail('encounter_active');
    const ids = cmd.entries.map((e) => e.tokenId);
    if (ids.length === 0 || new Set(ids).size !== ids.length) return fail('invalid_order');
    if (ids.some((id) => !state.scene.tokens[id])) return fail('invalid_order');
    if (cmd.entries.some((e) => !Number.isFinite(e.initiative))) return fail('invalid_value');
    return ok([{ type: 'encounterStarted', order: sortInitiative(cmd.entries, state) }]);
  },

  nextTurn(state, _cmd, ctx) {
    const enc = state.encounter;
    if (!enc.active) return fail('no_encounter');
    if (ctx.actor.role === 'player') {
      const current = currentTokenId(state);
      const token = current ? state.scene.tokens[current] : undefined;
      if (!token || token.characterId !== ctx.actor.characterId) return fail('not_your_turn');
    }
    const next = enc.turnIndex + 1;
    return ok([
      next >= enc.order.length
        ? { type: 'turnAdvanced', turnIndex: 0, round: enc.round + 1 }
        : { type: 'turnAdvanced', turnIndex: next, round: enc.round },
    ]);
  },

  reorderInitiative(state, cmd) {
    const enc = state.encounter;
    if (!enc.active) return fail('no_encounter');
    const byId = new Map(enc.order.map((e) => [e.tokenId, e]));
    const unique = new Set(cmd.order);
    if (cmd.order.length !== enc.order.length || unique.size !== cmd.order.length) return fail('invalid_order');
    if (cmd.order.some((id) => !byId.has(id))) return fail('invalid_order');
    const current = currentTokenId(state);
    const newIndex = Math.max(0, current ? cmd.order.indexOf(current) : 0);
    return ok([
      { type: 'initiativeReordered', order: cmd.order.map((id) => byId.get(id)!) },
      { type: 'turnAdvanced', turnIndex: newIndex, round: enc.round },
    ]);
  },

  endEncounter(state) {
    if (!state.encounter.active) return fail('no_encounter');
    return ok([{ type: 'encounterEnded' }]);
  },
};

const PLAYER_ALLOWED: ReadonlySet<Command['type']> = new Set(['moveToken', 'nextTurn']);

export function decide(state: CampaignState, cmd: Command, ctx: DecideContext): DecideResult {
  if (ctx.actor.role !== 'gm' && !PLAYER_ALLOWED.has(cmd.type)) return fail('not_gm');
  const handler = handlers[cmd.type] as Handler<typeof cmd.type>;
  return handler(state, cmd as never, ctx);
}
