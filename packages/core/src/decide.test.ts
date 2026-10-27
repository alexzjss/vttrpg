import { describe, expect, it } from 'vitest';
import { createCampaign, defaultResources } from './campaign';
import type { Command } from './commands';
import { decide } from './decide';
import type { Actor, CampaignState, Character } from './model';
import { applyEvents } from './reducer';

const GM: Actor = { role: 'gm' };
const P1: Actor = { role: 'player', characterId: 'p1' };
let n = 0;
const ctx = (actor: Actor) => ({ actor, newId: () => `id-${++n}` });
const input = (name: string, speed = 5): Omit<Character, 'id'> => ({
  kind: 'pc', name, portrait: '', fullBodyArt: '', tokenImage: '', resources: defaultResources(), speed, hpVisibility: 'exact',
});

function base(): CampaignState {
  const s = createCampaign('c', 'C');
  for (const [id, name, speed] of [['p1', 'Ana', 5], ['p2', 'Bia', 7]] as const) {
    s.characters[id] = { id, ...input(name, speed) };
  }
  s.scene.tokens.t1 = { id: 't1', characterId: 'p1', cell: { col: 1, row: 1 }, size: 1, hidden: false };
  s.scene.tokens.t2 = { id: 't2', characterId: 'p2', cell: { col: 2, row: 1 }, size: 1, hidden: false };
  return s;
}
function inCombat(): CampaignState {
  return applyEvents(base(), [{ type: 'encounterStarted', order: [{ tokenId: 't1', initiative: 20 }, { tokenId: 't2', initiative: 10 }] }]);
}
const err = (s: CampaignState, cmd: Command, a: Actor = GM) => {
  const r = decide(s, cmd, ctx(a));
  return r.ok ? 'ok' : r.error;
};
const evs = (s: CampaignState, cmd: Command, a: Actor = GM) => {
  const r = decide(s, cmd, ctx(a));
  if (!r.ok) throw new Error(r.error);
  return r.events;
};

describe('permissões', () => {
  const gmOnly: Command[] = [
    { type: 'createCharacter', input: input('X') },
    { type: 'updateCharacter', characterId: 'p1', patch: { name: 'Y' } },
    { type: 'deleteCharacter', characterId: 'p1' },
    { type: 'setResource', characterId: 'p1', resource: 'hp', current: 1 },
    { type: 'placeToken', characterId: 'p1', cell: { col: 5, row: 5 } },
    { type: 'removeToken', tokenId: 't1' },
    { type: 'setTokenHidden', tokenId: 't1', hidden: true },
    { type: 'updateGrid', grid: { cols: 10, rows: 10, cellSize: 64, visible: true }, background: '' },
    { type: 'startEncounter', entries: [{ tokenId: 't1', initiative: 1 }] },
    { type: 'reorderInitiative', order: ['t1'] },
    { type: 'endEncounter' },
  ];
  it.each(gmOnly.map((c) => [c.type, c] as const))('jogador não pode %s', (_t, cmd) => {
    expect(err(inCombat(), cmd, P1)).toBe('not_gm');
  });
});

describe('moveToken', () => {
  it('jogador move o próprio token fora de combate', () => {
    expect(evs(base(), { type: 'moveToken', tokenId: 't1', to: { col: 3, row: 3 } }, P1)).toEqual([
      { type: 'tokenMoved', tokenId: 't1', from: { col: 1, row: 1 }, to: { col: 3, row: 3 } },
    ]);
  });
  it('jogador move para célula com token oculto (aceito); mestre recebe cell_occupied', () => {
    const s = applyEvents(base(), [
      { type: 'tokenPlaced', token: { id: 'h1', characterId: 'p2', cell: { col: 3, row: 3 }, size: 1, hidden: true } },
    ]);
    const cmd: Command = { type: 'moveToken', tokenId: 't1', to: { col: 3, row: 3 } };
    expect(err(s, cmd, P1)).toBe('ok');
    expect(err(s, cmd, GM)).toBe('cell_occupied');
  });
  it('jogador ainda recebe cell_occupied por token visível', () => {
    expect(err(base(), { type: 'moveToken', tokenId: 't1', to: { col: 2, row: 1 } }, P1)).toBe('cell_occupied');
  });
  it('jogador movendo token de outro PJ → not_your_token', () => {
    expect(err(base(), { type: 'moveToken', tokenId: 't2', to: { col: 3, row: 3 } }, P1)).toBe('not_your_token');
  });
  it('jogador fora do turno em combate → not_your_turn', () => {
    const s = applyEvents(inCombat(), [{ type: 'turnAdvanced', turnIndex: 1, round: 1 }]);
    expect(err(s, { type: 'moveToken', tokenId: 't1', to: { col: 3, row: 3 } }, P1)).toBe('not_your_turn');
  });
  it('jogador no próprio turno pode mover', () => {
    expect(err(inCombat(), { type: 'moveToken', tokenId: 't1', to: { col: 3, row: 3 } }, P1)).toBe('ok');
  });
  it('mestre move qualquer token em combate', () => {
    expect(err(inCombat(), { type: 'moveToken', tokenId: 't2', to: { col: 3, row: 3 } })).toBe('ok');
  });
  it('fora do grid → out_of_bounds', () => {
    for (const to of [{ col: -1, row: 0 }, { col: 20, row: 0 }, { col: 0, row: 12 }, { col: 0, row: -1 }]) {
      expect(err(base(), { type: 'moveToken', tokenId: 't1', to })).toBe('out_of_bounds');
    }
  });
  it('célula ocupada → cell_occupied', () => {
    expect(err(base(), { type: 'moveToken', tokenId: 't1', to: { col: 2, row: 1 } })).toBe('cell_occupied');
  });
  it('mover para a própria célula → ok sem eventos', () => {
    expect(evs(base(), { type: 'moveToken', tokenId: 't1', to: { col: 1, row: 1 } })).toEqual([]);
  });
  it('token inexistente → not_found', () => {
    expect(err(base(), { type: 'moveToken', tokenId: 'zz', to: { col: 0, row: 0 } })).toBe('not_found');
  });
});

describe('personagens', () => {
  it('createCharacter usa newId', () => {
    const e = evs(base(), { type: 'createCharacter', input: input('  Nova ') });
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ type: 'characterCreated', character: { name: '  Nova ' } });
    expect((e[0] as { character: Character }).character.id).toMatch(/^id-/);
  });
  it('nome vazio → invalid_value', () => {
    expect(err(base(), { type: 'createCharacter', input: input('   ') })).toBe('invalid_value');
  });
  it('updateCharacter: remove undefined, valida nome, not_found', () => {
    expect(evs(base(), { type: 'updateCharacter', characterId: 'p1', patch: { name: 'Z', speed: undefined } })).toEqual([
      { type: 'characterUpdated', characterId: 'p1', patch: { name: 'Z' } },
    ]);
    expect(err(base(), { type: 'updateCharacter', characterId: 'p1', patch: { name: ' ' } })).toBe('invalid_value');
    expect(err(base(), { type: 'updateCharacter', characterId: 'zz', patch: {} })).toBe('not_found');
  });
  it('updateCharacter: trocar o kind → invalid_value; mesmo kind passa', () => {
    expect(err(base(), { type: 'updateCharacter', characterId: 'p1', patch: { kind: 'npc' } })).toBe('invalid_value');
    expect(err(base(), { type: 'updateCharacter', characterId: 'p1', patch: { kind: 'pc' } })).toBe('ok');
  });
  it('deleteCharacter emite tokenRemoved por token e depois characterDeleted', () => {
    expect(evs(base(), { type: 'deleteCharacter', characterId: 'p1' })).toEqual([
      { type: 'tokenRemoved', tokenId: 't1' },
      { type: 'characterDeleted', characterId: 'p1' },
    ]);
    expect(err(base(), { type: 'deleteCharacter', characterId: 'zz' })).toBe('not_found');
  });
});

describe('setResource', () => {
  it('hp max 0 → invalid_value', () => {
    expect(err(base(), { type: 'setResource', characterId: 'p1', resource: 'hp', max: 0 })).toBe('invalid_value');
  });
  it('valores não inteiros ou negativos → invalid_value', () => {
    expect(err(base(), { type: 'setResource', characterId: 'p1', resource: 'hp', current: 1.5 })).toBe('invalid_value');
    expect(err(base(), { type: 'setResource', characterId: 'p1', resource: 'hp', current: -1 })).toBe('invalid_value');
    expect(err(base(), { type: 'setResource', characterId: 'p1', resource: 'aura', max: -2 })).toBe('invalid_value');
  });
  it('current acima do max é limitado', () => {
    expect(evs(base(), { type: 'setResource', characterId: 'p1', resource: 'hp', current: 999 })).toEqual([
      { type: 'resourceSet', characterId: 'p1', resource: 'hp', pool: { current: 20, max: 20 } },
    ]);
  });
  it('reduzir max limita o current existente', () => {
    expect(evs(base(), { type: 'setResource', characterId: 'p1', resource: 'hp', max: 5 })).toEqual([
      { type: 'resourceSet', characterId: 'p1', resource: 'hp', pool: { current: 5, max: 5 } },
    ]);
  });
  it('ammo max 0 é válido; not_found', () => {
    expect(err(base(), { type: 'setResource', characterId: 'p1', resource: 'ammo', max: 0 })).toBe('ok');
    expect(err(base(), { type: 'setResource', characterId: 'zz', resource: 'hp', current: 1 })).toBe('not_found');
  });
});

describe('tokens', () => {
  it('placeToken usa newId, size 1, hidden padrão false', () => {
    const e = evs(base(), { type: 'placeToken', characterId: 'p1', cell: { col: 5, row: 5 } });
    expect(e).toEqual([
      { type: 'tokenPlaced', token: { id: expect.stringMatching(/^id-/), characterId: 'p1', cell: { col: 5, row: 5 }, size: 1, hidden: false } },
    ]);
  });
  it('placeToken: bounds, ocupada, personagem inexistente', () => {
    expect(err(base(), { type: 'placeToken', characterId: 'p1', cell: { col: 99, row: 0 } })).toBe('out_of_bounds');
    expect(err(base(), { type: 'placeToken', characterId: 'p1', cell: { col: 1, row: 1 } })).toBe('cell_occupied');
    expect(err(base(), { type: 'placeToken', characterId: 'zz', cell: { col: 5, row: 5 } })).toBe('not_found');
  });
  it('removeToken e setTokenHidden', () => {
    expect(evs(base(), { type: 'removeToken', tokenId: 't1' })).toEqual([{ type: 'tokenRemoved', tokenId: 't1' }]);
    expect(evs(base(), { type: 'setTokenHidden', tokenId: 't1', hidden: true })).toEqual([
      { type: 'tokenVisibilitySet', tokenId: 't1', hidden: true },
    ]);
    expect(err(base(), { type: 'removeToken', tokenId: 'zz' })).toBe('not_found');
    expect(err(base(), { type: 'setTokenHidden', tokenId: 'zz', hidden: true })).toBe('not_found');
  });
});

describe('updateGrid', () => {
  const g = (cols: number, rows: number, cellSize = 64) =>
    ({ type: 'updateGrid', grid: { cols, rows, cellSize, visible: true }, background: 'bg' }) as const;
  it('valores fora dos limites → invalid_value', () => {
    for (const c of [g(0, 5), g(101, 5), g(5, 0), g(5, 101), g(5, 5, 15), g(5, 5, 257), g(2.5, 5)]) {
      expect(err(base(), c)).toBe('invalid_value');
    }
  });
  it('limites inclusivos são válidos', () => {
    expect(err(base(), g(100, 100, 256))).toBe('ok');
    expect(err(base(), g(3, 3, 16))).toBe('ok');
  });
  it('encolher deixando token fora → tokens_out_of_bounds', () => {
    const s = applyEvents(base(), [{ type: 'tokenPlaced', token: { id: 't9', characterId: 'p1', cell: { col: 7, row: 2 }, size: 1, hidden: false } }]);
    expect(err(s, g(5, 5))).toBe('tokens_out_of_bounds');
  });
  it('emite gridUpdated', () => {
    expect(evs(base(), g(10, 10))).toEqual([
      { type: 'gridUpdated', grid: { cols: 10, rows: 10, cellSize: 64, visible: true }, background: 'bg' },
    ]);
  });
});

describe('encontro', () => {
  it('startEncounter ordena e emite encounterStarted', () => {
    const e = evs(base(), { type: 'startEncounter', entries: [{ tokenId: 't1', initiative: 5 }, { tokenId: 't2', initiative: 9 }] });
    expect(e).toEqual([{ type: 'encounterStarted', order: [{ tokenId: 't2', initiative: 9 }, { tokenId: 't1', initiative: 5 }] }]);
  });
  it('startEncounter: ativo, vazio, token inexistente', () => {
    expect(err(inCombat(), { type: 'startEncounter', entries: [{ tokenId: 't1', initiative: 1 }] })).toBe('encounter_active');
    expect(err(base(), { type: 'startEncounter', entries: [] })).toBe('invalid_order');
    expect(err(base(), { type: 'startEncounter', entries: [{ tokenId: 'zz', initiative: 1 }] })).toBe('invalid_order');
  });
  it('nextTurn sem encontro → no_encounter', () => {
    expect(err(base(), { type: 'nextTurn' })).toBe('no_encounter');
    expect(err(base(), { type: 'nextTurn' }, P1)).toBe('no_encounter');
  });
  it('nextTurn avança o índice', () => {
    expect(evs(inCombat(), { type: 'nextTurn' })).toEqual([{ type: 'turnAdvanced', turnIndex: 1, round: 1 }]);
  });
  it('nextTurn no último volta a 0 e soma rodada', () => {
    const s = applyEvents(inCombat(), [{ type: 'turnAdvanced', turnIndex: 1, round: 1 }]);
    expect(evs(s, { type: 'nextTurn' })).toEqual([{ type: 'turnAdvanced', turnIndex: 0, round: 2 }]);
  });
  it('nextTurn de jogador só se o token atual for dele', () => {
    expect(err(inCombat(), { type: 'nextTurn' }, P1)).toBe('ok');
    expect(err(inCombat(), { type: 'nextTurn' }, { role: 'player', characterId: 'p2' })).toBe('not_your_turn');
  });
  it('endEncounter', () => {
    expect(evs(inCombat(), { type: 'endEncounter' })).toEqual([{ type: 'encounterEnded' }]);
    expect(err(base(), { type: 'endEncounter' })).toBe('no_encounter');
  });
});

describe('reorderInitiative', () => {
  it('permutação mantém o token atual como atual', () => {
    const s = applyEvents(inCombat(), [{ type: 'turnAdvanced', turnIndex: 1, round: 3 }]); // atual = t2
    expect(evs(s, { type: 'reorderInitiative', order: ['t2', 't1'] })).toEqual([
      { type: 'initiativeReordered', order: [{ tokenId: 't2', initiative: 10 }, { tokenId: 't1', initiative: 20 }] },
      { type: 'turnAdvanced', turnIndex: 0, round: 3 },
    ]);
  });
  it('não é permutação exata → invalid_order', () => {
    expect(err(inCombat(), { type: 'reorderInitiative', order: ['t1'] })).toBe('invalid_order');
    expect(err(inCombat(), { type: 'reorderInitiative', order: ['t1', 't1'] })).toBe('invalid_order');
    expect(err(inCombat(), { type: 'reorderInitiative', order: ['t1', 'zz'] })).toBe('invalid_order');
  });
  it('sem encontro → no_encounter', () => {
    expect(err(base(), { type: 'reorderInitiative', order: ['t1'] })).toBe('no_encounter');
  });
});
