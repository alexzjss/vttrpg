import { describe, expect, it } from 'vitest';
import { collectValueModifiers, resolveCausedAndReceivedValue, resolveModifiedValue, type ModifierResolutionContext } from './effectModifiers';
import type { ArsenalEffect, ValueModifier } from './arsenal';
import type { ActiveEffectState, ArsenalActorState } from './arsenalPipeline';

const actor = (overrides: Partial<ArsenalActorState> = {}): ArsenalActorState => ({
  id: 'actor', teamId: 'a', name: 'Ator', currentHp: 20, maxHp: 20,
  currentAura: 10, maxAura: 10, currentAmmo: 0, maxAmmo: 0, defense: 10, speed: 3, tags: [],
  equippedWeaponIds: [], activeFormIds: [], effects: [], holdings: [],
  isCurrentTurn: true, inCombat: true, ...overrides,
});

const baseEffect = (overrides: Partial<ArsenalEffect> = {}): ArsenalEffect => ({
  id: 'e', name: 'Efeito', description: '', tags: [], duration: { type: 'rodadas', amount: 2 },
  stackBehavior: 'renova_duracao', maxStacks: 1, triggers: [], modifiers: [],
  periodicDamage: null, periodicHealing: null, auraConsumed: null, auraRestored: null,
  attackModifier: 0, defenseModifier: 0, speedModifier: 0, customEffect: null, ...overrides,
});

const active = (effect: ArsenalEffect, stacks = 1, sourceId?: string): ActiveEffectState => ({ effect, stacks, sourceId });

const ctx = (overrides: Partial<ModifierResolutionContext> = {}): ModifierResolutionContext => ({ actor: actor(), ...overrides });

describe('collectValueModifiers', () => {
  it('encontra modificadores novos que casam com o target', () => {
    const effect = baseEffect({ name: 'Fúria', valueModifiers: [{ operation: 'somar', target: 'teste', value: 3, filter: { testKinds: ['ataque'] } }] });
    const holder = actor({ effects: [active(effect)] });
    const found = collectValueModifiers(holder, 'teste', ctx({ actor: holder, testKind: 'ataque' }));
    expect(found).toHaveLength(1);
    expect(found[0].modifier.value).toBe(3);
  });

  it('filtra por elemento', () => {
    const effect = baseEffect({ valueModifiers: [{ operation: 'multiplicar', target: 'dano', value: 1.5, filter: { elements: ['raio'] } }] });
    const holder = actor({ effects: [active(effect)] });
    expect(collectValueModifiers(holder, 'dano', ctx({ actor: holder, element: 'raio' }))).toHaveLength(1);
    expect(collectValueModifiers(holder, 'dano', ctx({ actor: holder, element: 'fogo' }))).toHaveLength(0);
  });

  it('converte modifiers antigos (attackModifier/EffectModifier) automaticamente', () => {
    const effect = baseEffect({ attackModifier: 2, modifiers: [{ stat: 'dano', operation: 'somar', value: 4 }] });
    const holder = actor({ effects: [active(effect)] });
    expect(collectValueModifiers(holder, 'teste', ctx({ actor: holder, testKind: 'ataque' }))).toHaveLength(1);
    expect(collectValueModifiers(holder, 'dano', ctx({ actor: holder, direction: 'causado' }))).toHaveLength(1);
  });

  it('respeita sourceEntityId do filtro', () => {
    const effect = baseEffect({ valueModifiers: [{ operation: 'somar', target: 'teste', value: 5, filter: { sourceEntityId: 'aplicador-1' } }] });
    const holder = actor({ effects: [active(effect, 1, 'aplicador-1')] });
    expect(collectValueModifiers(holder, 'teste', ctx({ actor: holder }))).toHaveLength(1);
    const holderOther = actor({ effects: [active(effect, 1, 'outro-id')] });
    expect(collectValueModifiers(holderOther, 'teste', ctx({ actor: holderOther }))).toHaveLength(0);
  });

  it('respeita faixa de vida do usuário', () => {
    const effect = baseEffect({ valueModifiers: [{ operation: 'somar', target: 'dano', value: 5, filter: { hpRange: { subject: 'usuario', max: 50 } } }] });
    const low = actor({ effects: [active(effect)], currentHp: 5, maxHp: 20 });
    const high = actor({ effects: [active(effect)], currentHp: 20, maxHp: 20 });
    expect(collectValueModifiers(low, 'dano', ctx({ actor: low }))).toHaveLength(1);
    expect(collectValueModifiers(high, 'dano', ctx({ actor: high }))).toHaveLength(0);
  });

  it('respeita condição exigida no alvo', () => {
    const wet = baseEffect({ name: 'Molhado' });
    const effect = baseEffect({ name: 'Choque', valueModifiers: [{ operation: 'multiplicar', target: 'dano', value: 2, filter: { requiredTargetConditions: ['Molhado'] } }] });
    const holder = actor({ effects: [active(effect)] });
    const wetTarget = actor({ id: 't', effects: [active(wet)] });
    const dryTarget = actor({ id: 't2' });
    expect(collectValueModifiers(holder, 'dano', ctx({ actor: holder, other: wetTarget }))).toHaveLength(1);
    expect(collectValueModifiers(holder, 'dano', ctx({ actor: holder, other: dryTarget }))).toHaveLength(0);
  });
});

describe('resolveModifiedValue — ordem de resolução', () => {
  it('soma e subtração antes de multiplicação e divisão', () => {
    const effect = baseEffect({
      valueModifiers: [
        { operation: 'somar', target: 'dano', value: 5 },
        { operation: 'multiplicar', target: 'dano', value: 2 },
      ],
    });
    const holder = actor({ effects: [active(effect)] });
    const result = resolveModifiedValue({ target: 'dano', baseFlat: 10, holder, ctx: ctx({ actor: holder }), roller: () => 0 });
    // (10 + 5) * 2 = 30
    expect(result.total).toBe(30);
  });

  it('remove um dado do pool antes de rolar', () => {
    const effect = baseEffect({ valueModifiers: [{ operation: 'remover_dado', target: 'dano', value: 1 }] });
    const holder = actor({ effects: [active(effect)] });
    const rolls: number[] = [];
    const result = resolveModifiedValue({ target: 'dano', baseDice: '3d6', baseFlat: 0, holder, ctx: ctx({ actor: holder }), roller: notation => { rolls.push(0); return 4; } });
    expect(result.total).toBe(4); // 2d6 rolado (mockado pra sempre 4) = 4, não 3x
  });

  it('aumenta o tipo do dado (1d6 -> 1d8)', () => {
    const effect = baseEffect({ valueModifiers: [{ operation: 'aumentar_dado', target: 'dano', value: 1 }] });
    const holder = actor({ effects: [active(effect)] });
    let rolledNotation = '';
    resolveModifiedValue({ target: 'dano', baseDice: '1d6', baseFlat: 0, holder, ctx: ctx({ actor: holder }), roller: notation => { rolledNotation = notation; return 5; } });
    expect(rolledNotation).toBe('1d8');
  });

  it('adiciona um dado extra independente ao total', () => {
    const effect = baseEffect({ valueModifiers: [{ operation: 'adicionar_dado', target: 'dano', dice: '1d6' }] });
    const holder = actor({ effects: [active(effect)] });
    const rolls: Record<string, number> = { '1d6': 4 };
    const result = resolveModifiedValue({ target: 'dano', baseDice: undefined, baseFlat: 10, holder, ctx: ctx({ actor: holder }), roller: notation => rolls[notation] ?? 0 });
    expect(result.total).toBe(14);
  });

  it('vantagem escolhe a maior de duas rolagens', () => {
    const effect = baseEffect({ valueModifiers: [{ operation: 'vantagem', target: 'teste' }] });
    const holder = actor({ effects: [active(effect)] });
    const rolls = [8, 15];
    const result = resolveModifiedValue({ target: 'teste', baseDice: '1d20', baseFlat: 0, holder, ctx: ctx({ actor: holder, testKind: 'ataque' }), roller: () => rolls.shift()! });
    expect(result.total).toBe(15);
  });

  it('desvantagem escolhe a menor de duas rolagens', () => {
    const effect = baseEffect({ valueModifiers: [{ operation: 'desvantagem', target: 'teste' }] });
    const holder = actor({ effects: [active(effect)] });
    const rolls = [8, 15];
    const result = resolveModifiedValue({ target: 'teste', baseDice: '1d20', baseFlat: 0, holder, ctx: ctx({ actor: holder }), roller: () => rolls.shift()! });
    expect(result.total).toBe(8);
  });

  it('define mínimo e máximo por último', () => {
    const effect = baseEffect({ valueModifiers: [{ operation: 'definir_minimo', target: 'dano', value: 5 }] });
    const holder = actor({ effects: [active(effect)] });
    const result = resolveModifiedValue({ target: 'dano', baseFlat: 2, holder, ctx: ctx({ actor: holder }), roller: () => 0 });
    expect(result.total).toBe(5);
  });

  it('acumula stacks para operações somar/multiplicar', () => {
    const effect = baseEffect({ valueModifiers: [{ operation: 'somar', target: 'dano', value: 2 }] });
    const holder = actor({ effects: [active(effect, 3)] });
    const result = resolveModifiedValue({ target: 'dano', baseFlat: 10, holder, ctx: ctx({ actor: holder }), roller: () => 0 });
    expect(result.total).toBe(16); // 10 + 2*3
  });

  it('passos do log seguem a decomposição: base, dado, soma, multiplicação, final', () => {
    const effect = baseEffect({
      name: 'Lâmina de Indra',
      valueModifiers: [
        { operation: 'somar', target: 'dano', value: 3 },
        { operation: 'multiplicar', target: 'dano', value: 2 },
      ],
    });
    const holder = actor({ effects: [active(effect)] });
    const result = resolveModifiedValue({ target: 'dano', baseFlat: 5, holder, ctx: ctx({ actor: holder }), roller: () => 0 });
    expect(result.steps[0]).toContain('Base');
    expect(result.steps.some(s => s.includes('+3'))).toBe(true);
    expect(result.steps.some(s => s.includes('×2'))).toBe(true);
    expect(result.steps.at(-1)).toContain('Final');
  });
});

describe('resolveCausedAndReceivedValue', () => {
  it('aplica o lado de quem causa e depois o de quem recebe, em sequência', () => {
    const attackerBuff = baseEffect({ name: 'Fúria', valueModifiers: [{ operation: 'somar', target: 'dano', value: 5, filter: { direction: 'causado' } }] });
    const defenderDebuff = baseEffect({ name: 'Molhado', valueModifiers: [{ operation: 'multiplicar', target: 'dano', value: 1.5, filter: { direction: 'recebido', elements: ['raio'] } }] });
    const source = actor({ id: 'atk', effects: [active(attackerBuff)] });
    const recipient = actor({ id: 'def', effects: [active(defenderDebuff)] });
    const result = resolveCausedAndReceivedValue({ target: 'dano', baseFlat: 10, source, recipient, ctx: { element: 'raio' }, roller: () => 0 });
    // (10 + 5) * 1.5 = 22.5 -> 23 (Math.round)
    expect(result.total).toBe(23);
  });
});
