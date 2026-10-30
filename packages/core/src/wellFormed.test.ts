import { describe, expect, it } from 'vitest';
import { COMMAND_TYPES } from './commands';
import { isWellFormedCommand } from './wellFormed';

const pool = { current: 5, max: 10 };
const input = {
  kind: 'pc', name: 'Ana', portrait: '', fullBodyArt: '', tokenImage: '', speed: 5, hpVisibility: 'exact',
  resources: { hp: pool, aura: pool, ammo: pool },
};
const grid = { cols: 20, rows: 12, cellSize: 64, visible: true };
const cases: Array<[string, unknown, unknown[]]> = [
  ['createCharacter', { type: 'createCharacter', input }, [
    { type: 'createCharacter' },
    { type: 'createCharacter', input: { ...input, speed: 'x' } },
    { type: 'createCharacter', input: { ...input, kind: 'dragon' } },
    { type: 'createCharacter', input: { ...input, resources: { hp: pool, aura: pool } } },
    { type: 'createCharacter', input: { ...input, resources: { ...input.resources, hp: { current: NaN, max: 1 } } } },
    { type: 'createCharacter', input: { ...input, extra: 1 } },
  ]],
  ['updateCharacter', { type: 'updateCharacter', characterId: 'a', patch: { name: 'B', speed: 3 } }, [
    { type: 'updateCharacter', characterId: 'a', patch: { id: 'z' } },
    { type: 'updateCharacter', characterId: 'a', patch: { speed: '3' } },
    { type: 'updateCharacter', characterId: '', patch: {} },
    { type: 'updateCharacter', characterId: 'a' },
  ]],
  ['deleteCharacter', { type: 'deleteCharacter', characterId: 'a' }, [{ type: 'deleteCharacter', characterId: 1 }]],
  ['setResource', { type: 'setResource', characterId: 'a', resource: 'hp', current: 3 }, [
    { type: 'setResource', characterId: 'a', resource: 'mana' },
    { type: 'setResource', characterId: 'a', resource: 'hp', current: Infinity },
    { type: 'setResource', characterId: 'a', resource: 'hp', max: '3' },
  ]],
  ['placeToken', { type: 'placeToken', characterId: 'a', cell: { col: 1, row: 2 }, hidden: true }, [
    { type: 'placeToken', characterId: 'a', cell: { col: 1.5, row: 2 } },
    { type: 'placeToken', characterId: 'a', cell: { col: 1, row: 2 }, hidden: 'yes' },
  ]],
  ['moveToken', { type: 'moveToken', tokenId: 't', to: { col: 0, row: 0 } }, [
    { type: 'moveToken', tokenId: 't', to: { col: 'x', row: 1 } },
    { type: 'moveToken', tokenId: 't' },
    { type: 'moveToken', tokenId: 't', to: { col: 1, row: 1, z: 1 } },
  ]],
  ['removeToken', { type: 'removeToken', tokenId: 't' }, [{ type: 'removeToken' }]],
  ['setTokenHidden', { type: 'setTokenHidden', tokenId: 't', hidden: false }, [
    { type: 'setTokenHidden', tokenId: 't', hidden: 0 },
  ]],
  ['updateGrid', { type: 'updateGrid', grid, background: '' }, [
    { type: 'updateGrid', grid: { ...grid, cols: 0 }, background: '' },
    { type: 'updateGrid', grid: { ...grid, cols: 2.5 }, background: '' },
    { type: 'updateGrid', grid: { ...grid, visible: 1 }, background: '' },
    { type: 'updateGrid', grid, background: 3 },
  ]],
  ['startEncounter', { type: 'startEncounter', entries: [{ tokenId: 't', initiative: 12 }] }, [
    { type: 'startEncounter', entries: 'x' },
    { type: 'startEncounter', entries: [{ tokenId: 't', initiative: 'hi' }] },
    { type: 'startEncounter', entries: [{ initiative: 1 }] },
  ]],
  ['nextTurn', { type: 'nextTurn' }, []],
  ['reorderInitiative', { type: 'reorderInitiative', order: ['a', 'b'] }, [
    { type: 'reorderInitiative', order: [1] }, { type: 'reorderInitiative' },
  ]],
  ['endEncounter', { type: 'endEncounter' }, []],
];

describe('isWellFormedCommand', () => {
  it('cobre todos os tipos de comando', () => {
    expect(cases.map((c) => c[0]).sort()).toEqual([...COMMAND_TYPES].sort());
  });
  for (const [name, valid, bad] of cases) {
    it(`${name}: aceita válido e rejeita malformado`, () => {
      expect(isWellFormedCommand(valid)).toBe(true);
      for (const b of bad) expect(isWellFormedCommand(b)).toBe(false);
    });
  }
  it('rejeita não-objetos e tipo desconhecido', () => {
    for (const v of [null, undefined, 3, 'x', [], {}, { type: 'drop' }]) expect(isWellFormedCommand(v)).toBe(false);
  });
});

describe('limites de tamanho', () => {
  const create = (over: Record<string, unknown>) => ({ type: 'createCharacter', input: { ...input, ...over } });
  it('nome aceita 200 e recusa 201 caracteres', () => {
    expect(isWellFormedCommand(create({ name: 'a'.repeat(200) }))).toBe(true);
    expect(isWellFormedCommand(create({ name: 'a'.repeat(201) }))).toBe(false);
  });
  it('imagens aceitam 2048 e recusam 2049 caracteres', () => {
    for (const f of ['portrait', 'fullBodyArt', 'tokenImage']) {
      expect(isWellFormedCommand(create({ [f]: 'a'.repeat(2048) }))).toBe(true);
      expect(isWellFormedCommand(create({ [f]: 'a'.repeat(2049) }))).toBe(false);
    }
    const bg = (background: string) => ({ type: 'updateGrid', grid, background });
    expect(isWellFormedCommand(bg('a'.repeat(2048)))).toBe(true);
    expect(isWellFormedCommand(bg('a'.repeat(2049)))).toBe(false);
  });
  it('patch e ids respeitam os mesmos limites', () => {
    const patch = (p: Record<string, unknown>) => ({ type: 'updateCharacter', characterId: 'a', patch: p });
    expect(isWellFormedCommand(patch({ name: 'a'.repeat(201) }))).toBe(false);
    expect(isWellFormedCommand({ type: 'deleteCharacter', characterId: 'a'.repeat(201) })).toBe(false);
  });
});
