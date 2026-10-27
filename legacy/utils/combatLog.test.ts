import { describe, expect, it } from 'vitest';
import { createArsenalCard } from './arsenal';
import { resolveArsenalAction, type ArsenalActorState } from './arsenalPipeline';
import { buildArsenalCombatLog } from './combatLog';
import type { RollResult } from './dice';
import { getPredefinedEffect } from './arsenalEffects';

const actor = (overrides: Partial<ArsenalActorState> = {}): ArsenalActorState => ({
  id: 'actor', teamId: 'a', name: 'Lina', currentHp: 20, maxHp: 20,
  currentAura: 10, maxAura: 10, currentAmmo: 0, maxAmmo: 0, defense: 10, speed: 3, tags: [],
  equippedWeaponIds: [], activeFormIds: [], effects: [], holdings: [],
  isCurrentTurn: true, inCombat: true, ...overrides,
});

const die = (total: number, notation = '1d20'): RollResult => ({
  total, dieRoll: total, bonus: 0, notation, individualRolls: [total], numSides: 20, numDice: 1,
});

describe('buildArsenalCombatLog', () => {
  it('relata teste, dano efetivo, custo, condição e duração', () => {
    const burn = getPredefinedEffect('Queimadura')!;
    const card = createArsenalCard({
      id: 'fire', name: 'Chama', category: 'habilidade', testDice: '1d20',
      damage: { flat: 7 }, auraConsumed: { flat: 2 }, element: 'fogo', effects: [burn],
    });
    const source = actor();
    const target = actor({ id: 'target', teamId: 'b', name: 'Ogro', currentHp: 15, maxHp: 15, defense: 12 });
    const result = resolveArsenalAction({ card, actor: source, targets: [target], roller: () => 15 });
    const log = buildArsenalCombatLog({ card, beforeActor: source, beforeTargets: [target], result, rolls: [die(15)] });

    expect(log.find(entry => entry.roll)?.roll).toMatchObject({ total: 15, targetLabel: 'Ogro', targetValue: 12, success: true });
    expect(log.some(entry => entry.details?.amount === 5 && entry.details.resource === 'HP')).toBe(true);
    expect(log.some(entry => entry.details?.sourceLabel === 'Queimando' && entry.details.durationLabel)).toBe(true);
    expect(log.some(entry => entry.text.includes('consome 2 de Aura'))).toBe(true);
  });

  it('registra falha sem inventar dano', () => {
    const card = createArsenalCard({ id: 'miss', name: 'Disparo', category: 'habilidade', testDice: '1d20', damage: { flat: 8 } });
    const source = actor();
    const target = actor({ id: 'target', teamId: 'b', name: 'Ogro', defense: 18 });
    const result = resolveArsenalAction({ card, actor: source, targets: [target], roller: () => 7 });
    const log = buildArsenalCombatLog({ card, beforeActor: source, beforeTargets: [target], result, rolls: [die(7)] });
    expect(log.find(entry => entry.roll)?.roll?.success).toBe(false);
    expect(log.some(entry => entry.kind === 'damage')).toBe(false);
    expect(log.some(entry => entry.text.includes('evita'))).toBe(true);
  });
});
