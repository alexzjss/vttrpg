import { describe, expect, it } from 'vitest';
import { createCampaign, defaultResources, type Actor, type Character, type Command } from '@vtt/core';
import { processCommand, readState } from './commands';
import { MemoryStore } from './memoryStore';

const GM: Actor = { role: 'gm' };
const base = { portrait: '', fullBodyArt: '', tokenImage: '', speed: 5 };
const mkChar = (
  kind: 'pc' | 'npc', name: string, hpVisibility: Character['hpVisibility'],
): Omit<Character, 'id'> => ({ kind, name, hpVisibility, resources: defaultResources(), ...base });

function setup() {
  const store = new MemoryStore();
  store.seed(createCampaign('c1', 'Mesa'));
  let n = 0;
  return { store, newId: () => `id${++n}` };
}
const create = (kind: 'pc' | 'npc', name: string, hp: Character['hpVisibility']): Command =>
  ({ type: 'createCharacter', input: mkChar(kind, name, hp) });

describe('processCommand', () => {
  it('gera broadcasts para os tópicos certos', async () => {
    const { store, newId } = setup();
    const res = await processCommand(store, 'c1', GM, create('pc', 'Ana', 'exact'), newId);
    expect(res).toEqual({ ok: true, revision: 1 });
    expect(store.broadcasts.map((b) => b.topic).sort()).toEqual([
      'campaign:c1:gm', 'campaign:c1:player:id1',
    ]);
    expect(store.commits[0]!.events.length).toBeGreaterThan(0);
  });

  it('um conflito: reaplica sobre o estado recarregado, seq contígua', async () => {
    const { store, newId } = setup();
    await processCommand(store, 'c1', GM, create('pc', 'Ana', 'exact'), newId);
    store.forceConflicts(1);
    const r2 = await processCommand(store, 'c1', GM, create('pc', 'Bia', 'exact'), newId);
    expect(r2).toEqual({ ok: true, revision: 2 });
    const gmSeqs = store.broadcasts.filter((b) => b.topic === 'campaign:c1:gm').map((b) => b.payload.seq);
    expect(gmSeqs).toEqual([1, 2]);
    expect(Object.keys((await store.load('c1'))!.characters)).toHaveLength(2);
  });

  it('comandos concorrentes: o perdedor recarrega e ambos são aplicados', async () => {
    const { store, newId } = setup();
    const [a, b] = await Promise.all([
      processCommand(store, 'c1', GM, create('pc', 'Ana', 'exact'), newId),
      processCommand(store, 'c1', GM, create('pc', 'Bia', 'exact'), newId),
    ]);
    expect(a.ok && b.ok).toBe(true);
    expect((await store.load('c1'))!.revision).toBe(2);
    const gmSeqs = store.broadcasts.filter((x) => x.topic === 'campaign:c1:gm').map((x) => x.payload.seq);
    expect(gmSeqs).toEqual([1, 2]);
  });

  it('3 conflitos seguidos devolvem conflict', async () => {
    const { store, newId } = setup();
    store.forceConflicts(3);
    const res = await processCommand(store, 'c1', GM, create('pc', 'Ana', 'exact'), newId);
    expect(res).toEqual({ ok: false, error: 'conflict' });
    expect(store.broadcasts).toEqual([]);
  });

  it('data URL em imagem é rejeitada sem carregar estado', async () => {
    const { store, newId } = setup();
    let loads = 0;
    const orig = store.load.bind(store);
    store.load = async (id) => { loads++; return orig(id); };
    const input = { ...mkChar('pc', 'Ana', 'exact'), portrait: 'data:image/png;base64,AAAA' };
    const res = await processCommand(store, 'c1', GM, { type: 'createCharacter', input }, newId);
    expect(res).toEqual({ ok: false, error: 'invalid_value' });
    const bg = await processCommand(store, 'c1', GM, {
      type: 'updateGrid', grid: { cols: 5, rows: 5, cellSize: 50, visible: true }, background: 'data:image/png;base64,AAAA',
    }, newId);
    expect(bg).toEqual({ ok: false, error: 'invalid_value' });
    expect(loads).toBe(0);
  });

  it('campanha inexistente: not_found', async () => {
    const { store, newId } = setup();
    expect(await processCommand(store, 'x', GM, create('pc', 'Ana', 'exact'), newId))
      .toEqual({ ok: false, error: 'not_found' });
  });
});

describe('readState', () => {
  it('player recebe a projeção de player, sem revision nem NPC oculto', async () => {
    const { store, newId } = setup();
    await processCommand(store, 'c1', GM, create('pc', 'Ana', 'exact'), newId); // id1
    await processCommand(store, 'c1', GM, create('npc', 'Lich', 'hidden'), newId); // id2
    await processCommand(store, 'c1', GM, { type: 'placeToken', characterId: 'id2', cell: { col: 1, row: 1 }, hidden: true }, newId);
    const view = await readState(store, 'c1', { role: 'player', characterId: 'id1' });
    expect(view!.audience).toEqual({ kind: 'player', characterId: 'id1' });
    expect(view).not.toHaveProperty('revision');
    expect(Object.keys(view!.characters)).toEqual(['id1']);
    expect(JSON.stringify(view)).not.toContain('id2');
    expect(await readState(store, 'nada', GM)).toBeNull();
  });
});
