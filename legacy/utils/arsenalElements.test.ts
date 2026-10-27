import { describe, expect, it } from 'vitest';
import { ELEMENTAL_CONDITION_TABLE, rollElementalConditionChance } from './arsenalElements';
import { createArsenalCard } from './arsenal';

describe('chance elemental configurável', () => {
  it('tem uma entrada por elemento com condição padrão', () => {
    expect(ELEMENTAL_CONDITION_TABLE.map(entry => entry.damageType)).toEqual([
      'fogo', 'água', 'raio', 'terra', 'fisico', 'sangue',
    ]);
  });

  it('aplica a condição quando o roll cai dentro da chance', () => {
    const card = createArsenalCard({ id: 'fire', name: 'Fogo', category: 'habilidade', element: 'fogo' });
    expect(rollElementalConditionChance(card, () => 10)).toBe('Queimando');
    expect(rollElementalConditionChance(card, () => 25)).toBeNull();
  });

  it('carta pode sobrescrever a chance', () => {
    const card = createArsenalCard({ id: 'fire', name: 'Fogo', category: 'habilidade', element: 'fogo', elementalConditionChance: 0.9 });
    expect(rollElementalConditionChance(card, () => 80)).toBe('Queimando');
  });

  it('carta pode desativar o proc elemental', () => {
    const card = createArsenalCard({ id: 'fire', name: 'Fogo', category: 'habilidade', element: 'fogo', applyElementalCondition: false });
    expect(rollElementalConditionChance(card, () => 1)).toBeNull();
  });

  it('sem elemento, não aplica nada', () => {
    const card = createArsenalCard({ id: 'x', name: 'X', category: 'habilidade' });
    expect(rollElementalConditionChance(card, () => 1)).toBeNull();
  });
});
