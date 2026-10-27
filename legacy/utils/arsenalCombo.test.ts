import { describe, expect, it } from 'vitest';
import { createArsenalCard } from './arsenal';
import { resolveComboAction, type ArsenalActorState } from './arsenalPipeline';

const actor = (overrides: Partial<ArsenalActorState> = {}): ArsenalActorState => ({
  id: 'actor', teamId: 'a', name: 'Ator', currentHp: 20, maxHp: 20,
  currentAura: 10, maxAura: 10, currentAmmo: 0, maxAmmo: 0, defense: 10, speed: 3, tags: [],
  equippedWeaponIds: [], activeFormIds: [], effects: [], holdings: [],
  isCurrentTurn: true, inCombat: true, ...overrides,
});

describe('resolveComboAction — simultânea', () => {
  it('funde dano com dado de todas as cartas num único golpe', () => {
    const primary = createArsenalCard({ id: 'p', name: 'Golpe Base', category: 'habilidade', damage: { flat: 2, dice: '1d6' }, combo: { stackKey: 'k', maxStacks: 3, resolution: 'simultanea' } });
    const companion = createArsenalCard({ id: 'c', name: 'Golpe Extra', category: 'habilidade', damage: { flat: 1, dice: '1d4' } });
    const target = actor({ id: 't', teamId: 'b', currentHp: 30 });
    const rolls: Record<string, number> = { '1d6': 4, '1d4': 3 };
    const [result] = resolveComboAction({ cards: [primary, companion], actor: actor(), targets: [target], roller: dice => rolls[dice] ?? 0 });
    expect(result.status).toBe('concluida');
    // dano: (2+4) + (1+3) = 10
    expect(result.targets[0].currentHp).toBe(20);
  });

  it('concatena os efeitos de todas as cartas', () => {
    const effectA = { id: 'ea', name: 'A', description: '', tags: [], duration: { type: 'rodadas' as const, amount: 1 }, stackBehavior: 'nao_acumula' as const, maxStacks: 1, triggers: [], modifiers: [], periodicDamage: null, periodicHealing: null, auraConsumed: null, auraRestored: null, attackModifier: 0, defenseModifier: 0, speedModifier: 0, customEffect: null };
    const effectB = { ...effectA, id: 'eb', name: 'B' };
    const primary = createArsenalCard({ id: 'p', name: 'Golpe', category: 'habilidade', damage: { flat: 1 }, effects: [effectA], combo: { stackKey: 'k', maxStacks: 2, resolution: 'simultanea' } });
    const companion = createArsenalCard({ id: 'c', name: 'Extra', category: 'habilidade', effects: [effectB] });
    const target = actor({ id: 't', teamId: 'b' });
    const [result] = resolveComboAction({ cards: [primary, companion], actor: actor(), targets: [target], roller: () => 0 });
    expect(result.targets[0].effects.map(active => active.effect.name).sort()).toEqual(['A', 'B']);
  });
});

describe('resolveComboAction — sequencial', () => {
  it('resolve cada carta em sequência, encadeando o dano acumulado', () => {
    const primary = createArsenalCard({ id: 'p', name: 'Golpe 1', category: 'habilidade', damage: { flat: 3 }, combo: { stackKey: 'k', maxStacks: 2, resolution: 'sequencial' } });
    const companion = createArsenalCard({ id: 'c', name: 'Golpe 2', category: 'habilidade', damage: { flat: 4 } });
    const target = actor({ id: 't', teamId: 'b', currentHp: 20 });
    const results = resolveComboAction({ cards: [primary, companion], actor: actor(), targets: [target], roller: () => 0 });
    expect(results).toHaveLength(2);
    expect(results[0].targets[0].currentHp).toBe(18);
    expect(results[1].targets[0].currentHp).toBe(15);
  });

  it('carta bloqueada não impede as seguintes de tentar resolver', () => {
    const onCooldown = createArsenalCard({ id: 'p', name: 'Em cooldown', category: 'habilidade', damage: { flat: 3 }, combo: { stackKey: 'k', maxStacks: 2, resolution: 'sequencial' } });
    const companion = createArsenalCard({ id: 'c', name: 'Golpe', category: 'habilidade', damage: { flat: 4 } });
    const target = actor({ id: 't', teamId: 'b', currentHp: 20 });
    const user = actor({ holdings: [{ cardId: 'p', quantity: 1, equipped: false, active: false, cooldownRemaining: 1 }] });
    const results = resolveComboAction({ cards: [onCooldown, companion], actor: user, targets: [target], roller: () => 0 });
    expect(results[0].status).toBe('bloqueada');
    expect(results[1].status).toBe('concluida');
    expect(results[1].targets[0].currentHp).toBe(17);
  });
});
