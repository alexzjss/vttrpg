import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getNodeType } from '../nodeRegistry';
import { registerFormaNodes } from './formaNodes';
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

describe('registerFormaNodes', () => {
  beforeEach(() => { _resetRegistry(); registerFormaNodes(); });

  it('cor_token tem campo de cor e registra no trace', () => {
    const def = getNodeType('cor_token')!;
    expect(def.fields.map(f => f.key)).toEqual(['color']);
    const c = ctx();
    def.interpret!({ color: '#ff0000' }, c);
    expect(c.trace.some(t => t.detail?.includes('#ff0000'))).toBe(true);
  });

  it('icone_token tem campo de ícone e registra no trace', () => {
    const def = getNodeType('icone_token')!;
    expect(def.fields.map(f => f.key)).toEqual(['icon']);
    const c = ctx();
    def.interpret!({ icon: 'https://x/lua.png' }, c);
    expect(c.trace.some(t => t.detail?.includes('lua.png'))).toBe(true);
  });
});
