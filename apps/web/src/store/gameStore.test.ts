import { describe, expect, it } from 'vitest';
import type { Character } from '@vtt/core';
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

  it('takeCues devolve e limpa', async () => {
    const store = createGameStore();
    await store.getState().connect(createFakeTransport(), GM);
    expect(store.getState().takeCues()).toEqual([]);
  });
});
