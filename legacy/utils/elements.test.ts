import { describe, expect, it } from 'vitest';
import { affinityMultiplier, elementInteraction } from './elements';

describe('affinityMultiplier', () => {
  it('fraco 1.5, resistente 0.5, imune 0, ausente 1', () => {
    expect(affinityMultiplier('fraco')).toBe(1.5);
    expect(affinityMultiplier('resistente')).toBe(0.5);
    expect(affinityMultiplier('imune')).toBe(0);
    expect(affinityMultiplier(undefined)).toBe(1);
  });
});

describe('elementInteraction', () => {
  it('água aplica Molhado (2 rodadas)', () => {
    const r = elementInteraction('água', []);
    expect(r.addConditions).toEqual([{ name: 'Molhado', duration: 2 }]);
    expect(r.multiplier).toBe(1);
  });

  it('água apaga Queimando', () => {
    const r = elementInteraction('água', [{ name: 'Queimando', duration: 3 }]);
    expect(r.removeConditions).toContain('Queimando');
  });

  it('raio em alvo Molhado ganha bônus flat e consome Molhado', () => {
    const r = elementInteraction('raio', [{ name: 'Molhado', duration: 2 }]);
    expect(r.flatBonus).toBe(5); // defaultValue do preset Molhado
    expect(r.removeConditions).toContain('Molhado');
  });

  it('raio em alvo seco não muda nada', () => {
    const r = elementInteraction('raio', []);
    expect(r.flatBonus).toBe(0);
    expect(r.removeConditions).toEqual([]);
  });

  it('fogo em alvo Molhado é reduzido à metade e consome Molhado', () => {
    const r = elementInteraction('fogo', [{ name: 'Molhado', duration: 2 }]);
    expect(r.multiplier).toBe(0.5);
    expect(r.removeConditions).toContain('Molhado');
  });

  it('fogo em alvo Queimando renova a duração de Queimando', () => {
    const r = elementInteraction('fogo', [{ name: 'Queimando', duration: 1 }]);
    expect(r.renewConditions).toEqual([{ name: 'Queimando', duration: 3 }]); // defaultDuration do preset
  });

  it('fogo em alvo Molhado E Queimando: reduz, consome Molhado e renova Queimando', () => {
    const r = elementInteraction('fogo', [
      { name: 'Molhado', duration: 2 },
      { name: 'Queimando', duration: 1 },
    ]);
    expect(r.multiplier).toBe(0.5);
    expect(r.removeConditions).toContain('Molhado');
    expect(r.renewConditions).toEqual([{ name: 'Queimando', duration: 3 }]);
  });

  it('elemento neutro não interage', () => {
    const r = elementInteraction('fisico', [{ name: 'Molhado', duration: 2 }]);
    expect(r).toEqual({ multiplier: 1, flatBonus: 0, removeConditions: [], renewConditions: [], addConditions: [], notes: [] });
  });
});
