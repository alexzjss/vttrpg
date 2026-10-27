import { describe, it, expect } from 'vitest';
import { fallbackTokenPosition, effectiveTokens } from './mapPositions';

describe('fallbackTokenPosition', () => {
  it('espalha posições visuais previsíveis por índice, sem precisar de cena.tokens', () => {
    expect(fallbackTokenPosition(0)).toEqual({ x: 20, y: 50 });
    expect(fallbackTokenPosition(1)).toEqual({ x: 32, y: 50 });
  });
});

describe('effectiveTokens', () => {
  it('usa a posição persistida quando existe', () => {
    const tokens = { a: { x: 70, y: 10 } };
    const result = effectiveTokens(tokens, ['a']);
    expect(result.a).toEqual({ x: 70, y: 10 });
  });

  it('usa o mesmo fallback visual do MapBoard pra quem nunca foi arrastado (sem posição em cena.tokens)', () => {
    const tokens = {};
    const result = effectiveTokens(tokens, ['a', 'b']);
    expect(result.a).toEqual(fallbackTokenPosition(0));
    expect(result.b).toEqual(fallbackTokenPosition(1));
  });

  it('mistura persistido e fallback conforme cada id', () => {
    const tokens = { b: { x: 5, y: 5 } };
    const result = effectiveTokens(tokens, ['a', 'b', 'c']);
    expect(result.a).toEqual(fallbackTokenPosition(0));
    expect(result.b).toEqual({ x: 5, y: 5 });
    expect(result.c).toEqual(fallbackTokenPosition(2));
  });
});
