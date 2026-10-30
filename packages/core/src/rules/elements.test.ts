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
    const r = elementInteraction('agua', []);
    expect(r.add).toEqual([{ id: 'molhado', duration: 2 }]);
    expect(r.multiplier).toBe(1);
  });

  it('água apaga Queimando', () => {
    const r = elementInteraction('agua', ['queimando']);
    expect(r.remove).toContain('queimando');
  });

  it('raio em alvo Molhado ganha bônus flat e consome Molhado', () => {
    const r = elementInteraction('raio', ['molhado']);
    expect(r.flatBonus).toBe(5);
    expect(r.remove).toContain('molhado');
  });

  it('raio em alvo seco não muda nada', () => {
    const r = elementInteraction('raio', []);
    expect(r.flatBonus).toBe(0);
    expect(r.remove).toEqual([]);
  });

  it('fogo em alvo Molhado é reduzido à metade e consome Molhado', () => {
    const r = elementInteraction('fogo', ['molhado']);
    expect(r.multiplier).toBe(0.5);
    expect(r.remove).toContain('molhado');
  });

  it('fogo em alvo Queimando renova a duração de Queimando', () => {
    const r = elementInteraction('fogo', ['queimando']);
    expect(r.renew).toEqual([{ id: 'queimando', duration: 3 }]);
  });

  it('fogo em alvo Molhado E Queimando: reduz, consome Molhado e renova Queimando', () => {
    const r = elementInteraction('fogo', ['molhado', 'queimando']);
    expect(r.multiplier).toBe(0.5);
    expect(r.remove).toContain('molhado');
    expect(r.renew).toEqual([{ id: 'queimando', duration: 3 }]);
  });

  it('elemento neutro não interage', () => {
    const r = elementInteraction('fisico', ['molhado']);
    expect(r).toEqual({ multiplier: 1, flatBonus: 0, remove: [], renew: [], add: [] });
  });
});
