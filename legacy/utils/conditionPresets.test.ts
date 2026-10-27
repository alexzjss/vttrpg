import { describe, expect, it } from 'vitest';
import { createArsenalCard } from './arsenal';
import { applyActiveEffect, resolveArsenalAction, type ArsenalActorState } from './arsenalPipeline';
import { buildConditionEffect, describeCondition } from './conditionPresets';

const actor = (overrides: Partial<ArsenalActorState> = {}): ArsenalActorState => ({
  id: 'actor', teamId: 'a', name: 'Ator', currentHp: 20, maxHp: 20,
  currentAura: 10, maxAura: 10, currentAmmo: 0, maxAmmo: 0, defense: 10, speed: 3, tags: [],
  equippedWeaponIds: [], activeFormIds: [], effects: [], holdings: [],
  isCurrentTurn: true, inCombat: true, ...overrides,
});

describe('intensidade escala os valores numéricos', () => {
  it('fraco reduz e forte aumenta o valor padrão', () => {
    const weak = buildConditionEffect('queimando', 'fraco');
    const normal = buildConditionEffect('queimando', 'normal');
    const strong = buildConditionEffect('queimando', 'forte');
    expect(weak.condition).toMatchObject({ damagePerRound: 1 });
    expect(normal.condition).toMatchObject({ damagePerRound: 2 });
    expect(strong.condition).toMatchObject({ damagePerRound: 3 });
  });

  it('overrides por carta têm prioridade final sobre a intensidade', () => {
    const custom = buildConditionEffect('queimando', 'forte', { damagePerRound: 10 });
    expect(custom.condition).toMatchObject({ damagePerRound: 10 });
  });
});

describe('descrição automática', () => {
  it('gera texto a partir dos valores configurados', () => {
    const effect = buildConditionEffect('exposto', 'normal');
    expect(effect.description).toBe(describeCondition(effect.condition!));
    expect(effect.description).toContain('Exposto por 2 rodadas');
    expect(effect.description).toContain('+2 no teste');
  });

  it('omite frases de campos não configurados', () => {
    const bare = buildConditionEffect('exposto', 'normal', { attackBonusAgainstTarget: undefined, defensePierceAgainstTarget: undefined });
    expect(describeCondition(bare.condition!)).toBe('Exposto por 2 rodadas.');
  });
});

describe('chance de aplicação e resistência', () => {
  it('applicationChance abaixo do rolado impede a condição de pegar', () => {
    const effect = buildConditionEffect('sangrando', 'normal', { applicationChance: 30 });
    const card = createArsenalCard({ id: 'hit', name: 'Golpe', category: 'habilidade', damage: { flat: 1 }, effects: [effect] });
    const target = actor({ id: 't', teamId: 'b' });
    const result = resolveArsenalAction({ card, actor: actor(), targets: [target], roller: dice => dice === '1d100' ? 80 : 0 });
    expect(result.targets[0].effects).toEqual([]);
  });

  it('savingThrow bem sucedido resiste à condição', () => {
    const effect = buildConditionEffect('sangrando', 'normal', { savingThrow: { dice: '1d20', minimum: 12 } });
    const card = createArsenalCard({ id: 'hit', name: 'Golpe', category: 'habilidade', damage: { flat: 1 }, effects: [effect] });
    const target = actor({ id: 't', teamId: 'b' });
    const failsSave = resolveArsenalAction({ card, actor: actor(), targets: [target], roller: dice => dice === '1d20' ? 5 : 0 });
    expect(failsSave.targets[0].effects.some(active => active.effect.name === 'Sangrando')).toBe(true);
    const passesSave = resolveArsenalAction({ card, actor: actor(), targets: [target], roller: dice => dice === '1d20' ? 15 : 0 });
    expect(passesSave.targets[0].effects).toEqual([]);
  });
});

describe('mecânicas integradas ao combate', () => {
  it('Exposto reduz a defesa efetiva do alvo (defensePierceAgainstTarget)', () => {
    const exposed = buildConditionEffect('exposto', 'normal', { attackBonusAgainstTarget: 0, defensePierceAgainstTarget: 5 });
    const target = actor({ id: 't', teamId: 'b', defense: 15, effects: applyActiveEffect([], exposed) });
    const card = createArsenalCard({ id: 'hit', name: 'Golpe', category: 'habilidade', testDice: '1d20', damage: { flat: 1 } });
    const result = resolveArsenalAction({ card, actor: actor(), targets: [target], roller: () => 11 });
    expect(result.hitTargetIds).toEqual(['t']);
  });

  it('Marcado só concede bônus a quem aplicou a marca', () => {
    const marked = buildConditionEffect('marcado', 'normal', { attackBonusFromSource: 5 });
    const target = actor({ id: 't', teamId: 'b', defense: 15, effects: applyActiveEffect([], marked, 'ally-1') });
    const card = createArsenalCard({ id: 'hit', name: 'Golpe', category: 'habilidade', testDice: '1d20', damage: { flat: 1 } });
    const bySource = resolveArsenalAction({ card, actor: actor({ id: 'ally-1' }), targets: [target], roller: () => 11 });
    expect(bySource.hitTargetIds).toEqual(['t']);
    const byOther = resolveArsenalAction({ card, actor: actor({ id: 'someone-else' }), targets: [{ ...target, effects: applyActiveEffect([], marked, 'ally-1') }], roller: () => 11 });
    expect(byOther.hitTargetIds).toEqual([]);
  });

  it('Silenciado bloqueia cartas de habilidade mas permite ataques básicos', () => {
    const silenced = buildConditionEffect('silenciado', 'normal');
    const caster = actor({ effects: applyActiveEffect([], silenced) });
    const spell = createArsenalCard({ id: 'spell', name: 'Feitiço', category: 'habilidade', damage: { flat: 1 } });
    const weapon = createArsenalCard({ id: 'sword', name: 'Espada', category: 'arma', damage: { flat: 1 } });
    expect(resolveArsenalAction({ card: spell, actor: caster, targets: [actor({ id: 't', teamId: 'b' })] }).status).toBe('bloqueada');
    expect(resolveArsenalAction({ card: weapon, actor: caster, targets: [actor({ id: 't', teamId: 'b' })] }).status).toBe('concluida');
  });

  it('Molhado remove Queimando ao ser aplicado', () => {
    const burning = buildConditionEffect('queimando', 'normal');
    const wet = buildConditionEffect('molhado', 'normal', { removesBurning: true });
    const card = createArsenalCard({ id: 'splash', name: 'Água', category: 'habilidade', damage: { flat: 0 }, effects: [wet] });
    const target = actor({ id: 't', teamId: 'b', effects: applyActiveEffect([], burning) });
    const result = resolveArsenalAction({ card, actor: actor(), targets: [target] });
    expect(result.targets[0].effects.some(active => active.effect.name === 'Queimando')).toBe(false);
    expect(result.targets[0].effects.some(active => active.effect.name === 'Molhado')).toBe(true);
  });
});
