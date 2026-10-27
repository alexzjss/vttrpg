import { describe, it, expect } from 'vitest';
import { buildClockGradient } from './roundClock';

describe('buildClockGradient', () => {
  it('sem combatentes retorna um gradiente cinza fixo', () => {
    expect(buildClockGradient(0, 0)).toBe('conic-gradient(#3a3f47 0deg 360deg)');
  });

  it('acende exatamente os gomos completados', () => {
    const g = buildClockGradient(4, 2);
    expect((g.match(/#d9b56f/g) ?? []).length).toBe(2);
    expect((g.match(/#3a3f47/g) ?? []).length).toBe(2);
  });

  it('volta completa acende todos os gomos', () => {
    const g = buildClockGradient(3, 3);
    expect((g.match(/#d9b56f/g) ?? []).length).toBe(3);
    expect((g.match(/#3a3f47/g) ?? []).length).toBe(0);
  });

  it('sempre retorna uma string conic-gradient válida', () => {
    const g = buildClockGradient(5, 1);
    expect(g.startsWith('conic-gradient(')).toBe(true);
    expect(g.endsWith(')')).toBe(true);
  });
});
