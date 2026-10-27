import { describe, expect, it } from 'vitest';
import { createCampaign, defaultResources } from './campaign';
import { sortInitiative } from './initiative';
import type { CampaignState, Character } from './model';

function ch(id: string, name: string, speed: number): Character {
  return { id, kind: 'pc', name, portrait: '', fullBodyArt: '', tokenImage: '', resources: defaultResources(), speed, hpVisibility: 'exact' };
}

function stateWith(list: [string, string, number][]): CampaignState {
  const s = createCampaign('c', 'C');
  for (const [id, name, speed] of list) {
    s.characters[id] = ch(id, name, speed);
    s.scene.tokens['t-' + id] = { id: 't-' + id, characterId: id, cell: { col: 0, row: 0 }, size: 1, hidden: false };
  }
  return s;
}

describe('sortInitiative', () => {
  it('ordena por iniciativa desc', () => {
    const s = stateWith([['a', 'A', 1], ['b', 'B', 1]]);
    const r = sortInitiative([{ tokenId: 't-a', initiative: 5 }, { tokenId: 't-b', initiative: 15 }], s);
    expect(r.map((e) => e.tokenId)).toEqual(['t-b', 't-a']);
  });
  it('desempata por speed desc e depois por nome asc', () => {
    const s = stateWith([['a', 'Zeca', 3], ['b', 'Ana', 6], ['c', 'Bia', 3], ['d', 'Álvaro', 3]]);
    const r = sortInitiative(
      ['a', 'b', 'c', 'd'].map((id) => ({ tokenId: 't-' + id, initiative: 10 })),
      s,
    );
    expect(r.map((e) => e.tokenId)).toEqual(['t-b', 't-d', 't-c', 't-a']);
  });
  it('não muta a entrada', () => {
    const s = stateWith([['a', 'A', 1], ['b', 'B', 1]]);
    const input = [{ tokenId: 't-a', initiative: 1 }, { tokenId: 't-b', initiative: 2 }];
    sortInitiative(input, s);
    expect(input[0].tokenId).toBe('t-a');
  });
});
