import { describe, it, expect } from 'vitest';
import { consumeItemActivation, resolveCards, resolveSeals } from './items';
import type { Card, Character, Item, Seal } from '../types';

function fakeChar(over: Partial<Character> = {}): Character {
  return {
    id: 'c', name: 'C', icon: '', maxHp: 10, currentHp: 10, maxAura: 5, currentAura: 5,
    maxAmmo: 0, currentAmmo: 0, baseInitiative: 0, cardIds: [], conditions: [], items: [], ...over,
  };
}
const card = (id: string): Card => ({ id, name: id, image: '', auraCost: 0, type: 'ação', description: '' });
const seal = (id: string): Seal => ({ id, name: id, code: '', image: '', description: '' });

describe('resolveCards', () => {
  it('resolve cardIds para cartas do catálogo, ignorando órfãs e preservando ordem', () => {
    const char = fakeChar({ cardIds: ['x', 'missing', 'y'] });
    const out = resolveCards(char, [card('y'), card('x'), card('z')]);
    expect(out.map(c => c.id)).toEqual(['x', 'y']);
  });
  it('lista vazia quando não há cardIds', () => {
    expect(resolveCards(fakeChar({ cardIds: [] }), [card('x')])).toEqual([]);
  });
});

describe('consumeItemActivation', () => {
  const baseItem: Item = { id: 'it', name: 'Kit', description: '', image: '', usableInCombat: true };

  it('reduz durabilidade sem gastar quantidade quando o item nao e consumivel', () => {
    const char = fakeChar({ ownedItems: [{ itemId: 'it', quantity: 2, durability: 5, maxDurability: 5 }] });
    const owned = consumeItemActivation(char, { ...baseItem, quantity: 2, wearPerUse: 2, durability: 5, maxDurability: 5 });
    expect(owned).toEqual([{ itemId: 'it', quantity: 2, durability: 3, maxDurability: 5 }]);
  });

  it('gasta quantidade e quebra uma unidade quando a durabilidade chega a zero', () => {
    const char = fakeChar({ ownedItems: [{ itemId: 'it', quantity: 3, durability: 1, maxDurability: 4 }] });
    const owned = consumeItemActivation(char, { ...baseItem, quantity: 3, consumeOnUse: true, usesPerActivation: 1, wearPerUse: 2, durability: 1, maxDurability: 4 });
    expect(owned).toEqual([{ itemId: 'it', quantity: 1, durability: 4, maxDurability: 4 }]);
  });
});

describe('resolveSeals', () => {
  it('resolve sealIds para selos do catálogo, ignorando órfãos', () => {
    const char = fakeChar({ sealIds: ['s1', 'nope'] });
    const out = resolveSeals(char, [seal('s1'), seal('s2')]);
    expect(out.map(s => s.id)).toEqual(['s1']);
  });
});
