import { describe, it, expect } from 'vitest';
import { deriveTier, getPacing } from './animFx';

describe('deriveTier', () => {
  it('é trivial quando não há gatilhos', () => {
    expect(deriveTier({})).toBe('trivial');
  });
  it('é dramatic quando há reação', () => {
    expect(deriveTier({ hasReaction: true })).toBe('dramatic');
  });
  it('é dramatic com flag dramatic (ex: CD)', () => {
    expect(deriveTier({ dramatic: true })).toBe('dramatic');
  });
  it('é dramatic em crítico ou falha', () => {
    expect(deriveTier({ isCrit: true })).toBe('dramatic');
    expect(deriveTier({ isFumble: true })).toBe('dramatic');
  });
});

describe('getPacing', () => {
  it('reduced encurta tudo e zera o suspense', () => {
    const p = getPacing('dramatic', true);
    expect(p.rollsShown).toBeLessThanOrEqual(200);
    expect(p.cardShown).toBeLessThanOrEqual(120);
  });
  it('trivial é mais curto que dramatic', () => {
    const t = getPacing('trivial', false);
    const d = getPacing('dramatic', false);
    expect(t.rollsShown).toBeLessThan(d.rollsShown);
    expect(t.reactionShown).toBe(0); // sem reação no fluxo trivial
  });
  it('todas as durações são finitas e >= 0', () => {
    for (const tier of ['trivial', 'dramatic'] as const) {
      for (const reduced of [false, true]) {
        const p = getPacing(tier, reduced);
        for (const v of Object.values(p)) {
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

import { getJuice, RESULT_TONES, prefersReducedMotion } from './animFx';

describe('getJuice', () => {
  it('reduced zera o juíce', () => {
    const j = getJuice('crit', true);
    expect(j.shakePx).toBe(0);
    expect(j.flash).toBe(false);
  });
  it('crit e fumble têm flash e shake forte', () => {
    expect(getJuice('crit', false).flash).toBe(true);
    expect(getJuice('crit', false).shakePx).toBeGreaterThanOrEqual(6);
    expect(getJuice('fumble', false).flash).toBe(true);
  });
  it('miss tem juíce mínimo', () => {
    const j = getJuice('miss', false);
    expect(j.flash).toBe(false);
    expect(j.shakePx).toBeLessThanOrEqual(3);
  });
});

describe('RESULT_TONES', () => {
  it('cobre todos os desfechos', () => {
    for (const k of ['crit', 'fumble', 'hit', 'miss', 'action-win', 'reaction-win']) {
      expect(typeof RESULT_TONES[k]).toBe('string');
    }
  });
});

describe('prefersReducedMotion', () => {
  it('retorna false com o stub de matchMedia', () => {
    expect(prefersReducedMotion()).toBe(false);
  });
});

import { renderHook, act } from '@testing-library/react';
import { vi, beforeEach, afterEach } from 'vitest';
import { useAnimSequence } from './animFx';

describe('useAnimSequence', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const steps = [
    { phase: 'a', delay: 0 },
    { phase: 'b', delay: 100 },
    { phase: 'c', delay: 100 },
  ];

  it('progride pelas fases e completa uma única vez', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useAnimSequence({ steps, tailMs: 50, runKey: 1, onComplete, active: true }));
    expect(result.current.phase).toBe('a');
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current.phase).toBe('b');
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current.phase).toBe('c');
    act(() => { vi.advanceTimersByTime(50); });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('NÃO reinicia quando onComplete muda de identidade mas runKey é o mesmo', () => {
    const { result, rerender } = renderHook(
      ({ oc }: { oc: () => void }) =>
        useAnimSequence({ steps, tailMs: 50, runKey: 'k', onComplete: oc, active: true }),
      { initialProps: { oc: vi.fn() } },
    );
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current.phase).toBe('b');
    // re-render com uma função onComplete totalmente nova, mesmo runKey:
    rerender({ oc: vi.fn() });
    expect(result.current.phase).toBe('b'); // NÃO voltou para 'a'
  });

  it('reinicia quando runKey muda', () => {
    const { result, rerender } = renderHook(
      ({ k }: { k: number }) =>
        useAnimSequence({ steps, tailMs: 50, runKey: k, onComplete: vi.fn(), active: true }),
      { initialProps: { k: 1 } },
    );
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current.phase).toBe('b');
    rerender({ k: 2 });
    expect(result.current.phase).toBe('a'); // reiniciou
  });

  it('skip pula para a última fase e completa no segundo skip', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useAnimSequence({ steps, tailMs: 1000, runKey: 1, onComplete, active: true }));
    act(() => { result.current.skip(); });
    expect(result.current.phase).toBe('c');
    act(() => { result.current.skip(); });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
