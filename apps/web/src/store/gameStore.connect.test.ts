import { describe, expect, it } from 'vitest';
import { createCampaign, type Cue } from '@vtt/core';
import { createFakeTransport } from '../net/fakeTransport';
import { createGameStore } from './gameStore';

const GM = { role: 'gm' } as const;
const cue = { type: 'turn-started', tokenId: 't1', round: 1 } satisfies Cue;

/** Atrasa o connect até release() ser chamado; depois segue o comportamento original. */
function gate(t: ReturnType<typeof createFakeTransport>, mode: 'resolve' | 'reject') {
  const original = t.connect;
  const handle: { release: () => void } = { release: () => {} };
  t.connect = (s) =>
    new Promise((resolve, reject) => {
      handle.release = () => {
        if (mode === 'resolve') resolve(original(s));
        else reject(new Error('falha tardia'));
      };
    });
  return handle;
}

describe('gameStore: conexões concorrentes', () => {
  it('um connect superado que termina depois não vence o mais recente', async () => {
    const store = createGameStore();
    const slow = createFakeTransport(createCampaign('a', 'Lenta'));
    const fast = createFakeTransport(createCampaign('b', 'Rápida'));
    const slowGate = gate(slow, 'resolve');

    const first = store.getState().connect(slow, GM);
    await store.getState().connect(fast, GM);
    slowGate.release();
    await first;

    expect(store.getState().status).toBe('ready');
    expect(store.getState().state?.name).toBe('Rápida');

    // o transporte superado não pode mais alimentar a store
    slow.push({ seq: 1, changes: [], cues: [cue] });
    expect(store.getState().cues).toEqual([]);
  });

  it('um connect superado que falha não grava status error', async () => {
    const store = createGameStore();
    const slow = createFakeTransport();
    const fast = createFakeTransport(createCampaign('b', 'Rápida'));
    const slowGate = gate(slow, 'reject');

    const first = store.getState().connect(slow, GM);
    await store.getState().connect(fast, GM);
    slowGate.release();
    await first;

    expect(store.getState().status).toBe('ready');
    expect(store.getState().state?.name).toBe('Rápida');
  });

  it('disconnect zera o estado, os cues e o último erro', async () => {
    const store = createGameStore();
    const t = createFakeTransport();
    await store.getState().connect(t, GM);
    await store.getState().send({ type: 'deleteCharacter', characterId: 'nope' });
    t.push({ seq: 1, changes: [], cues: [cue] });
    expect(store.getState().lastError).toBe('not_found');

    store.getState().disconnect();

    expect(store.getState()).toMatchObject({ status: 'idle', state: null, cues: [], lastError: null });
    expect(await store.getState().send({ type: 'nextTurn' })).toEqual({ ok: false, error: 'not_found' });
  });

  it('disconnect não fecha o transporte, que pertence a quem o criou', async () => {
    const store = createGameStore();
    const t = createFakeTransport();
    await store.getState().connect(t, GM);
    let closed = false;
    t.close = () => { closed = true; };
    store.getState().disconnect();
    expect(closed).toBe(false);
  });
});
