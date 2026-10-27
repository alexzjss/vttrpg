import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface SeqStep<P extends string> {
  phase: P;
  delay: number;
}

export interface UseAnimSequenceOpts<P extends string> {
  steps: SeqStep<P>[];
  tailMs: number;
  runKey: unknown;
  onComplete: () => void;
  active: boolean;
}

export function useAnimSequence<P extends string>(
  opts: UseAnimSequenceOpts<P>,
): { phase: P; skip: () => void } {
  const { steps, tailMs, runKey, active } = opts;

  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const onCompleteRef = useRef(opts.onComplete);
  onCompleteRef.current = opts.onComplete;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const tailRef = useRef(tailMs);
  tailRef.current = tailMs;
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const completedRef = useRef(false);

  const setPhaseIndex = (i: number) => { indexRef.current = i; setIndex(i); };
  const clearTimers = () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };

  const finish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    clearTimers();
    onCompleteRef.current();
  };

  const skip = useCallback(() => {
    if (completedRef.current) return;
    const last = stepsRef.current.length - 1;
    clearTimers();
    if (last <= 0 || indexRef.current >= last) { finish(); return; }
    setPhaseIndex(last);
    timersRef.current.push(setTimeout(finish, Math.max(0, tailRef.current)));
  }, []);

  useEffect(() => {
    if (!active) { clearTimers(); return; }
    clearTimers();
    completedRef.current = false;
    setPhaseIndex(0);
    let acc = 0;
    for (let i = 1; i < stepsRef.current.length; i++) {
      acc += stepsRef.current[i].delay;
      const target = i;
      timersRef.current.push(setTimeout(() => setPhaseIndex(target), acc));
    }
    acc += tailRef.current;
    timersRef.current.push(setTimeout(finish, acc));
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey, active]);

  const list = stepsRef.current;
  const phase = (list.length > 0 ? list[Math.min(index, list.length - 1)].phase : '') as P;
  return { phase, skip };
}

/** Número "rolando": embaralha valores em [1, sides] enquanto `rolling`, fixa em `finalValue` ao parar. */
export function useScramble(finalValue: number, sides: number, rolling: boolean): number {
  const [v, setV] = useState(finalValue);
  useEffect(() => {
    if (!rolling) { setV(finalValue); return; }
    const s = Math.max(1, sides || 20);
    const id = setInterval(() => setV(1 + Math.floor(Math.random() * s)), 95);
    return () => clearInterval(id);
  }, [rolling, finalValue, sides]);
  return v;
}

export type AnimTier = 'trivial' | 'dramatic';

export interface TierContext {
  dramatic?: boolean;
  hasReaction?: boolean;
  isCrit?: boolean;
  isFumble?: boolean;
}

export function deriveTier(ctx: TierContext): AnimTier {
  if (ctx.dramatic || ctx.hasReaction || ctx.isCrit || ctx.isFumble) return 'dramatic';
  return 'trivial';
}

export interface Pacing {
  cardShown: number;
  reactionShown: number;
  rollsShown: number;
  resultShown: number;
  resolveShown: number;
}

export function getPacing(tier: AnimTier, reduced: boolean): Pacing {
  if (reduced) {
    return { cardShown: 60, reactionShown: 60, rollsShown: 120, resultShown: 1000, resolveShown: 400 };
  }
  if (tier === 'dramatic') {
    return { cardShown: 420, reactionShown: 460, rollsShown: 920, resultShown: 1240, resolveShown: 760 };
  }
  return { cardShown: 180, reactionShown: 0, rollsShown: 320, resultShown: 620, resolveShown: 460 };
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const RESULT_TONES: Record<string, string> = {
  crit: '#f7c948',
  fumble: '#ef4444',
  hit: '#22c55e',
  miss: '#f59e0b',
  'action-win': '#55efc4',
  'reaction-win': '#38bdf8',
};

export interface Juice {
  shakePx: number;
  flash: boolean;
}

export function getJuice(kind: string, reduced: boolean): Juice {
  if (reduced) return { shakePx: 0, flash: false };
  switch (kind) {
    case 'crit':         return { shakePx: 8, flash: true };
    case 'fumble':       return { shakePx: 7, flash: true };
    case 'reaction-win': return { shakePx: 4, flash: true };
    case 'action-win':   return { shakePx: 4, flash: false };
    case 'hit':          return { shakePx: 3, flash: false };
    default:             return { shakePx: 2, flash: false };
  }
}

export const AnimFxStyles: React.FC = () => (
  <style>{`
    @keyframes mp-fx-shake {
      0%, 100% { transform: translate(0, 0); }
      20% { transform: translate(calc(var(--fx-shake, 0px) * -1), var(--fx-shake, 0px)); }
      40% { transform: translate(var(--fx-shake, 0px), calc(var(--fx-shake, 0px) * -1)); }
      60% { transform: translate(calc(var(--fx-shake, 0px) * -0.6), calc(var(--fx-shake, 0px) * 0.6)); }
      80% { transform: translate(calc(var(--fx-shake, 0px) * 0.6), calc(var(--fx-shake, 0px) * -0.6)); }
    }
    .mp-fx-shake { animation: mp-fx-shake 360ms ease-in-out 1; }

    .mp-fx-flash {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 99995;
      background: radial-gradient(circle at 50% 46%, var(--fx-flash-color, #fff), transparent 60%);
      opacity: 0;
      animation: mp-fx-flash 460ms ease-out 1;
    }
    @keyframes mp-fx-flash {
      0% { opacity: 0; }
      18% { opacity: 0.7; }
      100% { opacity: 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .mp-fx-shake { animation: none; }
      .mp-fx-flash { animation-duration: 1ms; opacity: 0; }
    }
  `}</style>
);
