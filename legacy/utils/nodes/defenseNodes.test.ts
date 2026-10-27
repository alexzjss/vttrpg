import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getNodeType } from '../nodeRegistry';
import { registerDefenseNodes } from './defenseNodes';
import type { InterpretCtx } from '../abilityInterpreter';
import type { ArsenalActorState } from '../arsenalPipeline';

const alvo = (): ArsenalActorState => ({
  id: 't', teamId: 'B', name: 'Alvo', currentHp: 30, maxHp: 30, currentAura: 0, maxAura: 0,
  currentAmmo: 0, maxAmmo: 0, defense: 10, speed: 5, tags: [], equippedWeaponIds: [],
  activeFormIds: [], effects: [], holdings: [], isCurrentTurn: false, inCombat: true,
});

function ctx(over: Partial<InterpretCtx> = {}): InterpretCtx {
  return { actor: alvo(), scope: [alvo()], roller: () => 4, element: null, trace: [], ...over } as InterpretCtx;
}

describe('registerDefenseNodes', () => {
  beforeEach(() => { _resetRegistry(); registerDefenseNodes(); });

  it('roubo_vida concede lifeSteal', () => {
    const c = ctx();
    getNodeType('roubo_vida')!.interpret!({ percent: 25, rounds: 3 }, c);
    expect(c.scope[0].effects[0].effect.lifeSteal).toBe(25);
  });

  it('esquiva grava o valor rolado (fixo + dado) em ctx.defenseRollOverride', () => {
    const c = ctx();
    getNodeType('esquiva')!.interpret!({ dice: '1d8', flat: 2 }, c);
    expect(c.defenseRollOverride).toBe(6); // roller fixo=4 -> 4+2
  });

});
