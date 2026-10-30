import { describe, expect, it } from 'vitest';
import type { Character, Cue } from '@vtt/core';
import { createFakeTransport } from '../net/fakeTransport';
import { createGameStore } from './gameStore';

const GM = { mode: 'local', actor: { role: 'gm' } } as const;
const mkChar = (name: string): Omit<Character, 'id'> => ({
  kind: 'pc', name, portrait: '', fullBodyArt: '', tokenImage: '', speed: 6, hpVisibility: 'exact',
  resources: { hp: { current: 10, max: 10 }, aura: { current: 5, max: 5 }, ammo: { current: 0, max: 0 } },
});

describe('gameStore', () => {
  it('connect leva a ready com o snapshot', async () => {
    const store = createGameStore();
    await store.getState().connect(createFakeTransport(), GM);
    expect(store.getState().status).toBe('ready');
    expect(store.getState().state?.seq).toBe(0);
  });

  it('connect que falha vira status error', async () => {
    const store = createGameStore();
    const t = createFakeTransport();
    t.connect = async () => { throw new Error('falha'); };
    await store.getState().connect(t, GM);
    expect(store.getState().status).toBe('error');
  });

  it('aplica updates em sequência', async () => {
    const store = createGameStore();
    const t = createFakeTransport();
    await store.getState().connect(t, GM);
    await store.getState().send({ type: 'createCharacter', input: mkChar('Ana') });
    await store.getState().send({ type: 'createCharacter', input: mkChar('Bia') });
    expect(store.getState().state?.seq).toBe(2);
    expect(Object.keys(store.getState().state!.characters)).toHaveLength(2);
    expect(t.resyncCalls).toBe(0);
  });

  it('seq pulada chama resync uma vez e iguala o estado ao do transporte', async () => {
    const store = createGameStore();
    const t = createFakeTransport();
    await store.getState().connect(t, GM);
    // o servidor avança sem que o store veja o primeiro update
    t.authority.handle(GM.actor, { type: 'createCharacter', input: mkChar('Ana') });
    const out = t.authority.handle(GM.actor, { type: 'createCharacter', input: mkChar('Bia') });
    t.push(out.updates[0]!.update); // seq 2, store em 0
    await new Promise((r) => setTimeout(r, 0));
    expect(t.resyncCalls).toBe(1);
    expect(store.getState().state).toEqual(await t.resync());
    expect(store.getState().state?.seq).toBe(2);
    expect(store.getState().cues).toEqual([]);
  });

  it('send rejeitado grava lastError', async () => {
    const store = createGameStore();
    await store.getState().connect(createFakeTransport(), GM);
    const r = await store.getState().send({ type: 'deleteCharacter', characterId: 'nope' });
    expect(r.ok).toBe(false);
    expect(store.getState().lastError).toBe('not_found');
  });

  it('takeCues devolve os cues de um update e esvazia a fila', async () => {
    const store = createGameStore();
    const t = createFakeTransport();
    await store.getState().connect(t, GM);
    const cue = { type: 'turn-started', tokenId: 't1', round: 1 } satisfies Cue;
    t.push({ seq: 1, changes: [], cues: [cue] });
    expect(store.getState().cues).toHaveLength(1);
    expect(store.getState().takeCues()).toEqual([cue]);
    expect(store.getState().takeCues()).toEqual([]);
    expect(store.getState().cues).toEqual([]);
  });

  it('update com seq = estado.seq + 1 aplica sem resync e mantém cues', async () => {
    const store = createGameStore();
    const t = createFakeTransport();
    await store.getState().connect(t, GM);
    const cue = { type: 'turn-started', tokenId: 't1', round: 1 } satisfies Cue;
    t.push({ seq: 1, changes: [{ kind: 'setName', name: 'Nova' }], cues: [cue] });
    expect(t.resyncCalls).toBe(0);
    expect(store.getState().state?.seq).toBe(1);
    expect(store.getState().state?.name).toBe('Nova');
    expect(store.getState().cues).toHaveLength(1);
  });

  it('update com lacuna de seq dispara resync', async () => {
    const store = createGameStore();
    const t = createFakeTransport();
    await store.getState().connect(t, GM);
    t.push({ seq: 5, changes: [], cues: [] });
    await new Promise((r) => setTimeout(r, 0));
    expect(t.resyncCalls).toBe(1);
  });

  it('update com seq já refletida é ignorado, sem resync', async () => {
    const store = createGameStore();
    const t = createFakeTransport();
    await store.getState().connect(t, GM);
    const cue = { type: 'turn-started', tokenId: 't1', round: 1 } satisfies Cue;
    t.push({ seq: 0, changes: [], cues: [cue] });
    await new Promise((r) => setTimeout(r, 0));
    expect(t.resyncCalls).toBe(0);
    expect(store.getState().cues).toEqual([]);
  });

  it('a fila de cues é limitada a 50, descartando os mais antigos', async () => {
    const store = createGameStore();
    const t = createFakeTransport();
    await store.getState().connect(t, GM);
    for (let i = 1; i <= 60; i++) {
      t.push({ seq: i, changes: [], cues: [{ type: 'turn-started', tokenId: `t${i}`, round: i } satisfies Cue] });
    }
    const cues = store.getState().takeCues();
    expect(cues).toHaveLength(50);
    expect(cues[0]).toMatchObject({ round: 11 });
    expect(cues[49]).toMatchObject({ round: 60 });
  });

  it('resync descarta os cues do update com lacuna', async () => {
    const store = createGameStore();
    const t = createFakeTransport();
    await store.getState().connect(t, GM);
    const cue = { type: 'turn-started', tokenId: 't1', round: 1 } satisfies Cue;
    t.push({ seq: 5, changes: [], cues: [cue] });
    await new Promise((r) => setTimeout(r, 0));
    expect(t.resyncCalls).toBe(1);
    expect(store.getState().cues).toEqual([]);
  });

  it('updates durante um resync ficam em buffer e reaplicam os posteriores ao snapshot', async () => {
    const store = createGameStore();
    const t = createFakeTransport();
    await store.getState().connect(t, GM);
    const snap = { ...(await t.resync()), seq: 2 };
    let release!: () => void;
    t.resync = () => new Promise((r) => { release = () => r(snap); });
    const cue = (round: number): Cue => ({ type: 'turn-started', tokenId: 'x', round });
    t.push({ seq: 5, changes: [], cues: [] }); // lacuna: inicia resync
    t.push({ seq: 1, changes: [], cues: [cue(1)] }); // anterior ao snapshot: descartado
    t.push({ seq: 4, changes: [], cues: [cue(4)] }); // fora de ordem
    t.push({ seq: 3, changes: [], cues: [cue(3)] });
    expect(store.getState().state?.seq).toBe(0);
    release();
    await new Promise((r) => setTimeout(r, 0));
    expect(store.getState().state?.seq).toBe(4);
    expect(store.getState().cues.map((c) => c.cue)).toEqual([cue(3), cue(4)]);
  });

  it('resync que falha põe status error', async () => {
    const store = createGameStore();
    const t = createFakeTransport();
    await store.getState().connect(t, GM);
    t.resync = async () => { throw new Error('x'); };
    t.push({ seq: 9, changes: [], cues: [] });
    await new Promise((r) => setTimeout(r, 0));
    expect(store.getState().status).toBe('error');
  });

  it('send que rejeita põe status error e repropaga', async () => {
    const store = createGameStore();
    const t = createFakeTransport();
    await store.getState().connect(t, GM);
    t.send = async () => { throw new Error('x'); };
    await expect(store.getState().send({ type: 'nextTurn' })).rejects.toThrow();
    expect(store.getState().status).toBe('error');
  });

  it('snapshot não solicitado (reset) substitui o estado e limpa cues', async () => {
    const store = createGameStore();
    const t = createFakeTransport();
    await store.getState().connect(t, GM);
    await store.getState().send({ type: 'createCharacter', input: mkChar('Ana') });
    t.reset();
    expect(store.getState().state?.seq).toBe(0);
    expect(store.getState().state?.characters).toEqual({});
    expect(store.getState().cues).toEqual([]);
  });

  it('connect rejeitado com load_failed marca loadFailed; resetCampaign reconecta', async () => {
    const store = createGameStore();
    const t = createFakeTransport();
    const original = t.connect;
    let fail = true;
    t.connect = async (sess) => {
      if (fail) throw new Error('load_failed');
      return original(sess);
    };
    t.reset = () => { fail = false; };
    await store.getState().connect(t, GM);
    expect(store.getState()).toMatchObject({ status: 'error', loadFailed: true });
    await store.getState().resetCampaign();
    expect(store.getState()).toMatchObject({ status: 'ready', loadFailed: false });
  });

  it('connect rejeitado por outro motivo não marca loadFailed', async () => {
    const store = createGameStore();
    const t = createFakeTransport();
    t.connect = async () => { throw new Error('outro'); };
    await store.getState().connect(t, GM);
    expect(store.getState()).toMatchObject({ status: 'error', loadFailed: false });
  });
});

describe('gameStore send rejeitado', () => {
  it('propaga a rejeição ao chamador e marca status error', async () => {
    const store = createGameStore();
    const t = createFakeTransport();
    await store.getState().connect(t, GM);
    t.send = async () => { throw new Error('http 500'); };
    await expect(store.getState().send({ type: 'nextTurn' } as never)).rejects.toThrow('http 500');
    expect(store.getState().status).toBe('error');
  });
});
