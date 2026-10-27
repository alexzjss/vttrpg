import { describe, it, expect } from 'vitest';
import { activatableForms, advanceArsenalState, assignEntryToHoldings, isReactionCard } from './arsenalState';
import { createArsenalCard, type ArsenalCard } from './arsenal';
import type { ArsenalActorState } from './arsenalPipeline';

describe('isReactionCard', () => {
  it('reconhece o abilityType legado "protecao"', () => {
    const card = createArsenalCard({ id: 'p', name: 'Proteção', category: 'habilidade', abilityType: 'protecao' });
    expect(isReactionCard(card)).toBe(true);
  });
  it('reconhece qualquer carta com a condição de uso {type:"reacao"}', () => {
    const counter = createArsenalCard({ id: 'c', name: 'Contra-ataque', category: 'habilidade', damage: { flat: 3 }, conditions: [{ type: 'reacao' }] });
    expect(isReactionCard(counter)).toBe(true);
  });
  it('cartas comuns sem marcação de reação não contam', () => {
    const attack = createArsenalCard({ id: 'a', name: 'Golpe', category: 'habilidade', damage: { flat: 3 } });
    expect(isReactionCard(attack)).toBe(false);
  });
});

describe('assignEntryToHoldings', () => {
  it('adiciona uma holding nova para o id', () => {
    const holdings = assignEntryToHoldings([], 'graph-1');
    expect(holdings).toEqual([{ cardId: 'graph-1', quantity: 1, equipped: false, active: false }]);
  });
  it('não duplica se o id já estiver atribuído', () => {
    const holdings = assignEntryToHoldings([{ cardId: 'graph-1', quantity: 1, equipped: false, active: false }], 'graph-1');
    expect(holdings).toHaveLength(1);
  });
  it('salva o nivel maximo permitido para a entrada', () => {
    const holdings = assignEntryToHoldings([], 'graph-1', 3);
    expect(holdings[0]).toMatchObject({ cardId: 'graph-1', maxLevel: 3 });
  });
});

function forma(id: string, over: Partial<ArsenalCard> = {}): ArsenalCard {
  return createArsenalCard({
    id, name: id, category: 'habilidade', abilityType: 'forma',
    form: { grantedAbilityIds: [], removedAbilityIds: [], hpBonus: 0, auraBonus: 0 },
    ...over,
  });
}

function actor(over: Partial<ArsenalActorState> = {}): ArsenalActorState {
  return {
    id: 'a1', teamId: 'party', name: 'Herói', currentHp: 20, maxHp: 20,
    currentAura: 10, maxAura: 10, currentAmmo: 0, maxAmmo: 0, defense: 10, speed: 0, tags: [],
    equippedWeaponIds: [], activeFormIds: [], effects: [], holdings: [],
    isCurrentTurn: true, inCombat: true, ...over,
  };
}

describe('activatableForms', () => {
  it('marca ok quando o ator possui a forma e cumpre os requisitos', () => {
    const ignea = forma('ignea', { auraConsumed: { flat: 4, dice: null } });
    const result = activatableForms(
      actor({ holdings: [{ cardId: 'ignea', quantity: 1, equipped: false, active: false }] }),
      [ignea],
      { holdings: [{ cardId: 'ignea', quantity: 1, equipped: false, active: false }], equippedWeaponIds: [], activeFormIds: [] },
    );
    expect(result).toHaveLength(1);
    expect(result[0].card.id).toBe('ignea');
    expect(result[0].ok).toBe(true);
    expect(result[0].isActive).toBe(false);
  });

  it('bloqueia por aura insuficiente com motivo', () => {
    const cara = forma('cara', { auraConsumed: { flat: 99, dice: null } });
    const holdings = [{ cardId: 'cara', quantity: 1, equipped: false, active: false }];
    const result = activatableForms(actor({ holdings }), [cara], { holdings, equippedWeaponIds: [], activeFormIds: [] });
    expect(result[0].ok).toBe(false);
    expect(result[0].reason).toMatch(/aura/i);
  });

  it('marca isActive e ok:false para a forma já ativa', () => {
    const ativa = forma('ativa');
    const holdings = [{ cardId: 'ativa', quantity: 1, equipped: false, active: true }];
    const result = activatableForms(
      actor({ holdings, activeFormIds: ['ativa'] }),
      [ativa],
      { holdings, equippedWeaponIds: [], activeFormIds: ['ativa'] },
    );
    expect(result[0].isActive).toBe(true);
    expect(result[0].ok).toBe(false);
  });

  it('ignora formas que o ator não possui', () => {
    const naoPossui = forma('x');
    const result = activatableForms(actor(), [naoPossui], { holdings: [], equippedWeaponIds: [], activeFormIds: [] });
    expect(result).toHaveLength(0);
  });
});

describe('advanceArsenalState', () => {
  it('reduz cooldown e recupera cargas no início do turno correto', () => {
    const card=createArsenalCard({id:'pulso',cooldown:{type:'turnos',amount:2},charges:{maximum:3,current:3,recharge:{type:'por_turno',amount:1}}});
    const [holding]=advanceArsenalState([{cardId:'pulso',quantity:1,equipped:false,active:false,cooldownRemaining:2,currentCharges:1}],[card],'inicio_turno');
    expect(holding).toMatchObject({cooldownRemaining:1,currentCharges:2});
  });

  it('não avança recursos de rodada em um turno comum', () => {
    const card=createArsenalCard({id:'ritual',cooldown:{type:'rodadas',amount:2},charges:{maximum:3,current:3,recharge:{type:'por_rodada',amount:1}}});
    const holding={cardId:'ritual',quantity:1,equipped:false,active:false,cooldownRemaining:2,currentCharges:1};
    expect(advanceArsenalState([holding],[card],'inicio_turno')[0]).toEqual(holding);
    expect(advanceArsenalState([holding],[card],'inicio_rodada')[0]).toMatchObject({cooldownRemaining:1,currentCharges:2});
  });
});
