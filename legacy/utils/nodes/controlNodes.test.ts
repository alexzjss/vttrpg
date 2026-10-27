import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getNodeType } from '../nodeRegistry';
import { registerControlNodes } from './controlNodes';
import type { InterpretCtx } from '../abilityInterpreter';
import type { ArsenalActorState } from '../arsenalPipeline';

const alvo = (): ArsenalActorState => ({
  id: 't', teamId: 'B', name: 'Alvo', currentHp: 30, maxHp: 30, currentAura: 0, maxAura: 0,
  currentAmmo: 0, maxAmmo: 0, defense: 10, speed: 5, tags: [], equippedWeaponIds: [],
  activeFormIds: [], effects: [], holdings: [], isCurrentTurn: false, inCombat: true,
});

function ctx(over: Partial<InterpretCtx> = {}): InterpretCtx {
  return { actor: alvo(), scope: [alvo()], roller: () => 4, element: null, trace: [], movementIntents: [], ...over } as InterpretCtx;
}

describe('registerControlNodes', () => {
  beforeEach(() => { _resetRegistry(); registerControlNodes(); });

  it('mover registra a intenção sem alterar o ArsenalActorState', () => {
    const c = ctx();
    getNodeType('mover')!.interpret!({ kind: 'empurrar', distance: 2 }, c);
    expect(c.movementIntents).toEqual([{ targetId: 't', kind: 'empurrar', distance: 2 }]);
  });
});
