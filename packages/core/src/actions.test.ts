import { describe, expect, it } from 'vitest';
import { isValidAction, normalizeAction, type Action } from './actions';

const valid: Action = {
  id: 'a1', name: 'Bola de fogo', description: 'Queima', category: 'habilidade', costs: { aura: 3 }, cooldown: 2,
  target: { kind: 'multi', count: 3, range: 6 }, test: { kind: 'save', dice: '1d20', dc: 12 },
  effects: [
    { kind: 'damage', when: 'hit', dice: '2d6+1', element: 'fogo', staggerBonus: 5 },
    { kind: 'applyCondition', when: 'always', conditionId: 'queimando', duration: 3 },
  ],
  approval: 'gm',
};
const variant = (over: Record<string, unknown>) => ({ ...valid, ...over });

describe('isValidAction', () => {
  it('aceita ação completa', () => {
    expect(isValidAction(valid)).toBe(true);
    expect(normalizeAction(valid)).toEqual(valid);
  });
  it('recusa dado não parseável', () => {
    expect(isValidAction(variant({ test: { kind: 'attack', dice: 'xx' } }))).toBe(false);
    expect(isValidAction(variant({ effects: [{ kind: 'damage', when: 'hit', dice: 'xx', element: 'fogo' }] }))).toBe(false);
  });
  it('recusa count 0, range e cooldown fora do limite, dc 0', () => {
    expect(isValidAction(variant({ target: { kind: 'multi', count: 0, range: 3 } }))).toBe(false);
    expect(isValidAction(variant({ target: { kind: 'multi', count: 11, range: 3 } }))).toBe(false);
    expect(isValidAction(variant({ target: { kind: 'single', range: 101 } }))).toBe(false);
    expect(isValidAction(variant({ cooldown: 21 }))).toBe(false);
    expect(isValidAction(variant({ test: { kind: 'save', dice: '1d20', dc: 0 } }))).toBe(false);
  });
  it('recusa conditionId inexistente', () => {
    expect(isValidAction(variant({ effects: [{ kind: 'removeCondition', when: 'hit', conditionId: 'nada' }] }))).toBe(false);
  });
  it('recusa custos fora de 0..999 ou não inteiros, e 0 ou 9 efeitos', () => {
    expect(isValidAction(variant({ costs: { aura: -1 } }))).toBe(false);
    expect(isValidAction(variant({ costs: { aura: 1000 } }))).toBe(false);
    expect(isValidAction(variant({ costs: { aura: 1.5 } }))).toBe(false);
    expect(isValidAction(variant({ costs: { mana: 1 } }))).toBe(false);
    expect(isValidAction(variant({ effects: [] }))).toBe(false);
    expect(isValidAction(variant({ effects: Array.from({ length: 9 }, () => valid.effects[0]) }))).toBe(false);
  });
  it('recusa não objetos e chaves extras; normalizeAction devolve null', () => {
    expect(isValidAction(null)).toBe(false);
    expect(isValidAction(variant({ extra: 1 }))).toBe(false);
    expect(normalizeAction({})).toBeNull();
  });
});
