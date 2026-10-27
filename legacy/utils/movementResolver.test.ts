import { describe, it, expect } from 'vitest';
import { resolveMovementIntents, MOVE_UNIT_PCT } from './movementResolver';

describe('resolveMovementIntents', () => {
  it('empurrar afasta o alvo do ator na direção correta', () => {
    const tokens = { a: { x: 50, y: 50 }, t: { x: 60, y: 50 } };
    const next = resolveMovementIntents([{ targetId: 't', kind: 'empurrar', distance: 1 }], tokens, 'a');
    expect(next.t).toEqual({ x: 60 + MOVE_UNIT_PCT, y: 50 });
  });

  it('puxar aproxima o alvo do ator na direção correta', () => {
    const tokens = { a: { x: 50, y: 50 }, t: { x: 60, y: 50 } };
    const next = resolveMovementIntents([{ targetId: 't', kind: 'puxar', distance: 1 }], tokens, 'a');
    expect(next.t).toEqual({ x: 60 - MOVE_UNIT_PCT, y: 50 });
  });

  it('trocar_lugar troca as posições do ator e do alvo', () => {
    const tokens = { a: { x: 20, y: 30 }, t: { x: 70, y: 80 } };
    const next = resolveMovementIntents([{ targetId: 't', kind: 'trocar_lugar', distance: 0 }], tokens, 'a');
    expect(next.a).toEqual({ x: 70, y: 80 });
    expect(next.t).toEqual({ x: 20, y: 30 });
  });

  it('caso degenerado: ator e alvo na mesma posição não move em empurrar/puxar', () => {
    const tokens = { a: { x: 50, y: 50 }, t: { x: 50, y: 50 } };
    expect(resolveMovementIntents([{ targetId: 't', kind: 'empurrar', distance: 1 }], tokens, 'a')).toEqual({});
    expect(resolveMovementIntents([{ targetId: 't', kind: 'puxar', distance: 1 }], tokens, 'a')).toEqual({});
  });

  it('clampa a posição resultante nas bordas do mapa (0-100)', () => {
    const tokens = { a: { x: 50, y: 50 }, t: { x: 99, y: 50 } };
    const next = resolveMovementIntents([{ targetId: 't', kind: 'empurrar', distance: 5 }], tokens, 'a');
    expect(next.t).toEqual({ x: 100, y: 50 });
  });

  it('teleportar não produz entrada no resultado', () => {
    const tokens = { a: { x: 50, y: 50 }, t: { x: 60, y: 50 } };
    const next = resolveMovementIntents([{ targetId: 't', kind: 'teleportar', distance: 3 }], tokens, 'a');
    expect(next).toEqual({});
  });
});
