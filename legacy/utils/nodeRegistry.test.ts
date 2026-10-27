import { describe, it, expect, beforeEach } from 'vitest';
import { registerNodeType, getNodeType, listNodeTypes, _resetRegistry } from './nodeRegistry';

describe('nodeRegistry', () => {
  beforeEach(() => _resetRegistry());

  it('registra e recupera um tipo de nó', () => {
    registerNodeType({
      type: 'dano', family: 'efeito', label: 'Dano',
      fields: [{ key: 'dice', kind: 'dado', label: 'Dado' }],
      defaults: () => ({ dice: '1d6' }),
      summarize: p => `Dano ${(p as { dice: string }).dice}`,
    });
    expect(getNodeType('dano')?.label).toBe('Dano');
    expect(getNodeType('dano')?.defaults()).toEqual({ dice: '1d6' });
    expect(getNodeType('dano')?.summarize({ dice: '2d6' })).toBe('Dano 2d6');
  });

  it('lista por família', () => {
    registerNodeType({ type: 'a', family: 'efeito', label: 'A', fields: [], defaults: () => ({}), summarize: () => 'A' });
    registerNodeType({ type: 'b', family: 'ramo', label: 'B', fields: [], defaults: () => ({}), summarize: () => 'B' });
    expect(listNodeTypes('efeito').map(d => d.type)).toEqual(['a']);
  });

  it('sobrescrever o mesmo type substitui a definição', () => {
    registerNodeType({ type: 'x', family: 'efeito', label: 'V1', fields: [], defaults: () => ({}), summarize: () => 'x' });
    registerNodeType({ type: 'x', family: 'efeito', label: 'V2', fields: [], defaults: () => ({}), summarize: () => 'x' });
    expect(getNodeType('x')?.label).toBe('V2');
  });
});
