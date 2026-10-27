import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getNodeType } from '../nodeRegistry';
import { registerConditionNodes } from './conditionNodes';
import type { InterpretCtx } from '../abilityInterpreter';
import type { ArsenalActorState } from '../arsenalPipeline';

const alvo = (over: Partial<ArsenalActorState> = {}): ArsenalActorState => ({
  id: 't', teamId: 'B', name: 'Alvo', currentHp: 30, maxHp: 30, currentAura: 4, maxAura: 10,
  currentAmmo: 0, maxAmmo: 0, defense: 10, speed: 5, tags: [], equippedWeaponIds: [],
  activeFormIds: [], effects: [], holdings: [], isCurrentTurn: false, inCombat: true, ...over,
});

function ctx(over: Partial<InterpretCtx> = {}): InterpretCtx {
  return { actor: alvo(), scope: [alvo()], roller: () => 4, element: null, trace: [], ...over } as InterpretCtx;
}

describe('registerConditionNodes', () => {
  beforeEach(() => { _resetRegistry(); registerConditionNodes(); });

  it('se_vida_alvo: abaixo de X% é verdadeiro quando a vida do alvo está abaixo do limite', () => {
    const c = ctx({ scope: [alvo({ currentHp: 5, maxHp: 30 })] }); // ~16%
    expect(getNodeType('se_vida_alvo')!.evaluate!({ comparacao: 'abaixo', percent: 30 }, c)).toBe(true);
    expect(getNodeType('se_vida_alvo')!.evaluate!({ comparacao: 'acima', percent: 30 }, c)).toBe(false);
  });

  it('se_condicao_ativa: verdadeiro quando o alvo tem a condição', () => {
    const queimado = { effect: { id: 'q', name: 'Queimando', description: '', tags: [], duration: { type: 'rodadas' as const, amount: 2 }, stackBehavior: 'renova_duracao' as const, maxStacks: 1, triggers: [], modifiers: [], periodicDamage: { flat: 2, dice: null }, periodicHealing: null, auraConsumed: null, auraRestored: null, attackModifier: 0, defenseModifier: 0, speedModifier: 0, customEffect: null }, stacks: 1 };
    const c = ctx({ scope: [alvo({ effects: [queimado] })] });
    expect(getNodeType('se_condicao_ativa')!.evaluate!({ conditionName: 'Queimando' }, c)).toBe(true);
    expect(getNodeType('se_condicao_ativa')!.evaluate!({ conditionName: 'Molhado' }, c)).toBe(false);
  });

  it('se_aura_minima: verdadeiro quando a aura do usuário atinge o mínimo', () => {
    const c = ctx({ actor: alvo({ currentAura: 4 }) });
    expect(getNodeType('se_aura_minima')!.evaluate!({ amount: 3 }, c)).toBe(true);
    expect(getNodeType('se_aura_minima')!.evaluate!({ amount: 5 }, c)).toBe(false);
  });

  it('se_arma_equipada: verifica arma específica ou qualquer arma', () => {
    const c = ctx({ actor: alvo({ equippedWeaponIds: ['espada'] }) });
    expect(getNodeType('se_arma_equipada')!.evaluate!({ weaponId: 'espada' }, c)).toBe(true);
    expect(getNodeType('se_arma_equipada')!.evaluate!({ weaponId: 'lanca' }, c)).toBe(false);
    expect(getNodeType('se_arma_equipada')!.evaluate!({ weaponId: '' }, c)).toBe(true);
    expect(getNodeType('se_arma_equipada')!.evaluate!({ weaponId: '' }, ctx())).toBe(false);
  });

  it('se_forma_ativa: verifica forma específica ou qualquer forma', () => {
    const c = ctx({ actor: alvo({ activeFormIds: ['forma-solar'] }) });
    expect(getNodeType('se_forma_ativa')!.evaluate!({ formId: 'forma-solar' }, c)).toBe(true);
    expect(getNodeType('se_forma_ativa')!.evaluate!({ formId: 'forma-lunar' }, c)).toBe(false);
    expect(getNodeType('se_forma_ativa')!.evaluate!({ formId: '' }, c)).toBe(true);
    expect(getNodeType('se_forma_ativa')!.evaluate!({ formId: '' }, ctx())).toBe(false);
  });

  it('se_elemento_carta: verdadeiro quando o elemento da carta bate', () => {
    const c = ctx({ element: 'fogo' });
    expect(getNodeType('se_elemento_carta')!.evaluate!({ element: 'fogo' }, c)).toBe(true);
    expect(getNodeType('se_elemento_carta')!.evaluate!({ element: 'água' }, c)).toBe(false);
  });
});
