import { describe, expect, it } from 'vitest';
import { createCampaign, defaultResources } from './campaign';
import { applyEvent, applyEvents } from './reducer';
import type { CampaignState, Character, Token } from './model';

const pc = (id: string): Character => ({
  id, kind: 'pc', name: id, portrait: '', fullBodyArt: '', tokenImage: '',
  resources: defaultResources(), speed: 6, hpVisibility: 'exact',
});
const npc = (id: string): Character => ({ ...pc(id), kind: 'npc', hpVisibility: 'band' });
const tok = (id: string, characterId = id): Token => ({
  id, characterId, cell: { col: 0, row: 0 }, size: 1, hidden: false,
});

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.values(o as object).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
}

function withTokens(ids: string[], turnIndex = 0): CampaignState {
  const s = createCampaign('c', 'C');
  for (const id of ids) {
    s.characters[id] = pc(id);
    s.scene.tokens[id] = tok(id);
  }
  s.encounter = {
    active: true, round: 3, turnIndex,
    order: ids.map((tokenId, i) => ({ tokenId, initiative: 10 - i })),
  };
  return s;
}

describe('reducer', () => {
  it('characterCreated / characterDeleted', () => {
    const s0 = createCampaign('c', 'C');
    const s1 = applyEvent(s0, { type: 'characterCreated', character: npc('n') });
    expect(s1.characters.n?.name).toBe('n');
    const s2 = applyEvent(s1, { type: 'characterDeleted', characterId: 'n' });
    expect(s2.characters.n).toBeUndefined();
  });

  it('characterUpdated aplica o patch', () => {
    const s0 = applyEvent(createCampaign('c', 'C'), { type: 'characterCreated', character: pc('a') });
    const s1 = applyEvent(s0, { type: 'characterUpdated', characterId: 'a', patch: { name: 'Zed' } });
    expect(s1.characters.a?.name).toBe('Zed');
  });

  it('resourceSet troca só o pool indicado', () => {
    const s0 = applyEvent(createCampaign('c', 'C'), { type: 'characterCreated', character: pc('a') });
    const s1 = applyEvent(s0, { type: 'resourceSet', characterId: 'a', resource: 'hp', pool: { current: 5, max: 20 } });
    expect(s1.characters.a?.resources.hp).toEqual({ current: 5, max: 20 });
    expect(s1.characters.a?.resources.aura).toEqual({ current: 10, max: 10 });
    expect(s1.characters.a?.resources.ammo).toEqual({ current: 0, max: 0 });
  });

  it('tokenPlaced, tokenMoved, tokenVisibilitySet', () => {
    let s = createCampaign('c', 'C');
    s = applyEvent(s, { type: 'tokenPlaced', token: tok('t') });
    s = applyEvent(s, { type: 'tokenMoved', tokenId: 't', from: { col: 0, row: 0 }, to: { col: 3, row: 4 } });
    expect(s.scene.tokens.t?.cell).toEqual({ col: 3, row: 4 });
    s = applyEvent(s, { type: 'tokenVisibilitySet', tokenId: 't', hidden: true });
    expect(s.scene.tokens.t?.hidden).toBe(true);
  });

  it('gridUpdated', () => {
    const s = applyEvent(createCampaign('c', 'C'), {
      type: 'gridUpdated', grid: { cols: 5, rows: 6, cellSize: 32, visible: false }, background: 'bg.png',
    });
    expect(s.scene.grid).toEqual({ cols: 5, rows: 6, cellSize: 32, visible: false });
    expect(s.scene.background).toBe('bg.png');
  });

  it('encounterStarted', () => {
    const order = [{ tokenId: 'a', initiative: 5 }, { tokenId: 'b', initiative: 2 }];
    const s = applyEvent(createCampaign('c', 'C'), { type: 'encounterStarted', order });
    expect(s.encounter).toEqual({ active: true, round: 1, turnIndex: 0, order });
  });

  it('turnAdvanced grava turnIndex e round', () => {
    const s = applyEvent(withTokens(['t1', 't2']), { type: 'turnAdvanced', turnIndex: 0, round: 2 });
    expect(s.encounter.turnIndex).toBe(0);
    expect(s.encounter.round).toBe(2);
  });

  it('initiativeReordered', () => {
    const order = [{ tokenId: 't2', initiative: 20 }, { tokenId: 't1', initiative: 1 }];
    const s = applyEvent(withTokens(['t1', 't2']), { type: 'initiativeReordered', order });
    expect(s.encounter.order).toEqual(order);
  });

  it('tokenRemoved no turno atual: ninguém é pulado', () => {
    const s = applyEvent(withTokens(['t1', 't2', 't3'], 1), { type: 'tokenRemoved', tokenId: 't2' });
    expect(s.encounter.order.map((e) => e.tokenId)).toEqual(['t1', 't3']);
    expect(s.encounter.turnIndex).toBe(1);
    expect(s.scene.tokens.t2).toBeUndefined();
  });

  it('tokenRemoved do último no turno: volta a 0 sem mudar round', () => {
    const s = applyEvent(withTokens(['t1', 't2', 't3'], 2), { type: 'tokenRemoved', tokenId: 't3' });
    expect(s.encounter.turnIndex).toBe(0);
    expect(s.encounter.round).toBe(3);
  });

  it('tokenRemoved antes do turno atual: turnIndex recua', () => {
    const s = applyEvent(withTokens(['t1', 't2', 't3'], 2), { type: 'tokenRemoved', tokenId: 't1' });
    expect(s.encounter.turnIndex).toBe(1);
    expect(s.encounter.order[1]?.tokenId).toBe('t3');
  });

  it('tokenRemoved depois do turno atual: turnIndex fica', () => {
    const s = applyEvent(withTokens(['t1', 't2', 't3'], 0), { type: 'tokenRemoved', tokenId: 't3' });
    expect(s.encounter.turnIndex).toBe(0);
  });

  it('encounterEnded', () => {
    const s = applyEvent(withTokens(['t1']), { type: 'encounterEnded' });
    expect(s.encounter).toEqual({ active: false, round: 0, turnIndex: 0, order: [] });
  });

  it('não muta o estado de entrada e não altera revision', () => {
    const s0 = deepFreeze(withTokens(['t1', 't2', 't3'], 1));
    const s1 = applyEvents(s0, [
      { type: 'tokenMoved', tokenId: 't1', from: { col: 0, row: 0 }, to: { col: 1, row: 1 } },
      { type: 'tokenRemoved', tokenId: 't2' },
      { type: 'resourceSet', characterId: 't1', resource: 'hp', pool: { current: 1, max: 20 } },
    ]);
    expect(s1.revision).toBe(s0.revision);
    expect(s0.scene.tokens.t2).toBeDefined();
  });
});
