import { describe, expect, it } from 'vitest';
import {
  GUARD_ENTRY,
  checkRequirements,
  effectiveCombat,
  resolveHoldings,
  type GrimoireEntry,
  type RequirementContext,
} from './grimoire';

const sword: GrimoireEntry = {
  id: 'e1', name: 'Espada', image: '', description: '', category: 'arma',
  combat: {
    actionType: 'principal', targeting: 'inimigo', attackDice: '1d20',
    effects: [{ kind: 'damage', dice: '2d6', element: 'fisico' }],
  },
};

const potion: GrimoireEntry = {
  id: 'e2', name: 'Poção', image: '', description: '', category: 'item',
  consumable: true,
  combat: { actionType: 'menor', targeting: 'self', effects: [{ kind: 'heal', stat: 'hp', dice: '1d8' }] },
};

const leveled: GrimoireEntry = {
  id: 'e3', name: 'Bola de Fogo', image: '', description: '', category: 'habilidade',
  combat: {
    actionType: 'principal', targeting: 'inimigo', attackDice: '1d20',
    costs: { aura: 2 }, effects: [{ kind: 'damage', dice: '1d6', element: 'fogo' }],
  },
  levels: [{
    level: 2, name: 'Bola de Fogo II',
    combat: {
      actionType: 'principal', targeting: 'inimigo', attackDice: '1d20',
      costs: { aura: 4 }, effects: [{ kind: 'damage', dice: '2d6', element: 'fogo' }],
    },
  }],
};

const catalog = [sword, potion, leveled];

describe('resolveHoldings', () => {
  it('reconstrói entradas com quantidade e nível, ignorando órfãs', () => {
    const out = resolveHoldings(
      [{ entryId: 'e2', quantity: 3 }, { entryId: 'e3', level: 2 }, { entryId: 'morto' }],
      catalog,
    );
    expect(out).toHaveLength(2);
    expect(out[0].name).toBe('Poção');
    expect(out[0].quantity).toBe(3);
    expect(out[1].heldLevel).toBe(2);
    expect(out[1].quantity).toBe(1); // default
  });

  it('aceita holdings undefined', () => {
    expect(resolveHoldings(undefined, catalog)).toEqual([]);
  });
});

describe('effectiveCombat', () => {
  it('sem nível retorna o perfil base', () => {
    expect(effectiveCombat(leveled)?.costs?.aura).toBe(2);
  });
  it('com nível existente retorna o perfil do nível', () => {
    expect(effectiveCombat(leveled, 2)?.costs?.aura).toBe(4);
  });
  it('nível inexistente cai no perfil base', () => {
    expect(effectiveCombat(leveled, 9)?.costs?.aura).toBe(2);
  });
});

describe('GUARD_ENTRY', () => {
  it('é ação menor self com buff de +2 defesa por 1 rodada', () => {
    expect(GUARD_ENTRY.combat?.actionType).toBe('menor');
    expect(GUARD_ENTRY.combat?.targeting).toBe('self');
    expect(GUARD_ENTRY.combat?.effects).toEqual([{ kind: 'buff', stat: 'defesa', value: 2, duration: 1 }]);
  });
});

describe('checkRequirements', () => {
  const ctx: RequirementContext = {
    characterId: 'c1',
    holdings: [{ entryId: 'e2', quantity: 2 }],
    currentHp: 10, maxHp: 20, currentAura: 5, maxAura: 10,
  };

  it('sem requisitos retorna null', () => {
    expect(checkRequirements(undefined, ctx)).toBeNull();
    expect(checkRequirements([], ctx)).toBeNull();
  });
  it('specificCharacter bloqueia outro personagem', () => {
    expect(checkRequirements([{ type: 'specificCharacter', characterId: 'c1' }], ctx)).toBeNull();
    expect(checkRequirements([{ type: 'specificCharacter', characterId: 'c2' }], ctx)).toMatch(/exclusiv/i);
  });
  it('linkedEntry exige possuir a entrada', () => {
    expect(checkRequirements([{ type: 'linkedEntry', entryId: 'e2' }], ctx)).toBeNull();
    expect(checkRequirements([{ type: 'linkedEntry', entryId: 'e9' }], ctx)).toMatch(/requer/i);
  });
  it('entryCount exige a quantidade', () => {
    expect(checkRequirements([{ type: 'entryCount', entryId: 'e2', quantity: 2 }], ctx)).toBeNull();
    expect(checkRequirements([{ type: 'entryCount', entryId: 'e2', quantity: 3 }], ctx)).toMatch(/requer/i);
  });
  it('minHp/minAura são percentuais 0-100', () => {
    expect(checkRequirements([{ type: 'minHp', value: 50 }], ctx)).toBeNull();   // 10/20 = 50%
    expect(checkRequirements([{ type: 'minHp', value: 51 }], ctx)).toMatch(/hp/i);
    expect(checkRequirements([{ type: 'minAura', value: 50 }], ctx)).toBeNull(); // 5/10 = 50%
    expect(checkRequirements([{ type: 'minAura', value: 60 }], ctx)).toMatch(/aura/i);
  });
});
