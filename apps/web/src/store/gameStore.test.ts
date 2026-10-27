import { describe, expect, it } from 'vitest';
import type { Character, Cue } from '@vtt/core';
import { createFakeTransport } from '../net/fakeTransport';
import { createGameStore } from './gameStore';

const GM = { role: 'gm' } as const;
const mkChar = (name: string): Omit<Character, 'id'> => ({
  kind: 'pc', name, portrait: '', fullBodyArt: '', tokenImage: '', speed: 6, hpVisibility: 'exact',
  resources: { hp: { current: 10, max: 10 }, aura: { current: 5, max: 5 }, ammo: { current: 0, max: 0 } },
});

describe('gameStore', () => {
  it('connect leva a ready com o snapshot', async () => {
    const store = createGameStore();
    await store.getState().connect(createFakeTransport(), GM);
    expect(store.getState().status).toBe('ready');
    expect(store.getState().state?.revision).toBe(0);
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
    expect(store.getState().state?.revision).toBe(2);
    expect(Object.keys(store.getState().state!.characters)).toHaveLength(2);
    expect(t.resyncCalls).toBe(0);
  });

  it('revisão pulada chama resync uma vez e iguala o estado ao do transporte', async () => {
    const store = createGameStore();
    const t = createFakeTransport();
    await store.getState().connect(t, GM);
    // o servidor avança sem que o store veja o primeiro update
    t.authority.handle(GM, { type: 'createCharacter', input: mkChar('Ana') });
    const out = t.authority.handle(GM, { type: 'createCharacter', input: mkChar('Bia') });
    t.push(out.updates[0]!.update); // revision 2, store em 0
    await new Promise((r) => setTimeout(r, 0));
    expect(t.resyncCalls).toBe(1);
    expect(store.getState().state).toEqual(await t.resync());
    expect(store.getState().state?.revision).toBe(2);
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
    t.push({ revision: 1, changes: [], cues: [cue] });
    expect(store.getState().cues).toHaveLength(1);
    expect(store.getState().takeCues()).toEqual([cue]);
    expect(store.getState().takeCues()).toEqual([]);
    expect(store.getState().cues).toEqual([]);
  });

  it('resync descarta os cues do update com lacuna', async () => {
    const store = createGameStore();
    const t = createFakeTransport();
    await store.getState().connect(t, GM);
    const cue = { type: 'turn-started', tokenId: 't1', round: 1 } satisfies Cue;
    t.push({ revision: 5, changes: [], cues: [cue] });
    await new Promise((r) => setTimeout(r, 0));
    expect(t.resyncCalls).toBe(1);
    expect(store.getState().cues).toEqual([]);
  });

  it('updates durante um resync em andamento são ignorados', async () => {
    const store = createGameStore();
    const t = createFakeTransport();
    await store.getState().connect(t, GM);
    const snap = await t.resync();
    let release!: () => void;
    t.resync = () => new Promise((r) => { release = () => r(snap); });
    t.push({ revision: 5, changes: [], cues: [] }); // inicia resync
    t.push({ revision: 1, changes: [], cues: [{ type: 'turn-started', tokenId: 'x', round: 1 } satisfies Cue] });
    expect(store.getState().cues).toEqual([]);
    expect(store.getState().state?.revision).toBe(0);
    release();
    await new Promise((r) => setTimeout(r, 0));
    expect(store.getState().state).toEqual(snap);
  });

  it('resync que falha põe status error', async () => {
    const store = createGameStore();
    const t = createFakeTransport();
    await store.getState().connect(t, GM);
    t.resync = async () => { throw new Error('x'); };
    t.push({ revision: 9, changes: [], cues: [] });
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
    expect(store.getState().state?.revision).toBe(0);
    expect(store.getState().state?.characters).toEqual({});
    expect(store.getState().cues).toEqual([]);
  });
});
