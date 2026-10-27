import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getNodeType } from '../nodeRegistry';
import { registerModifierNodes } from './modifierNodes';
import type { InterpretCtx } from '../abilityInterpreter';
import type { ArsenalActorState } from '../arsenalPipeline';
import type { ModificarValorProps } from './modifierNodes';

const alvo = (over: Partial<ArsenalActorState> = {}): ArsenalActorState => ({
  id: 't', teamId: 'B', name: 'Alvo', currentHp: 30, maxHp: 30, currentAura: 4, maxAura: 10,
  currentAmmo: 0, maxAmmo: 0, defense: 10, speed: 5, tags: [], equippedWeaponIds: [],
  activeFormIds: [], effects: [], holdings: [], isCurrentTurn: false, inCombat: true, ...over,
});

function ctx(over: Partial<InterpretCtx> = {}): InterpretCtx {
  return { actor: alvo({ id: 'actor' }), scope: [alvo()], roller: () => 4, element: null, trace: [], ...over } as InterpretCtx;
}

const props = (over: Partial<ModificarValorProps> = {}): ModificarValorProps => ({
  name: '', target: 'dano', operation: 'somar', value: 2, rounds: 2, chance: 100, stackRule: 'renovar', ...over,
});

describe('registerModifierNodes', () => {
  beforeEach(() => { _resetRegistry(); registerModifierNodes(); });

  it('empilha um efeito com o valueModifier configurado no alvo', () => {
    const c = ctx();
    getNodeType('modificar_valor')!.interpret!(props({ name: 'Fúria', target: 'teste', operation: 'somar', value: 3 }), c);
    const active = c.scope[0].effects[0];
    expect(active.effect.name).toBe('Fúria');
    expect(active.effect.valueModifiers).toEqual([{ operation: 'somar', target: 'teste', value: 3, filter: {} }]);
    expect(active.effect.duration).toEqual({ type: 'rodadas', amount: 2 });
  });

  it('respeita a chance de aplicação', () => {
    const c = ctx({ roller: () => 80 });
    getNodeType('modificar_valor')!.interpret!(props({ chance: 50 }), c);
    expect(c.scope[0].effects).toHaveLength(0);
  });

  it('constrói o filtro a partir dos campos planos (elemento, tags, direção)', () => {
    const c = ctx();
    getNodeType('modificar_valor')!.interpret!(props({
      name: 'Choque', target: 'dano', operation: 'multiplicar', value: 1.5,
      filterElement: 'raio', filterTags: 'combo, esquiva', filterDirection: 'causado',
    }), c);
    const modifier = c.scope[0].effects[0].effect.valueModifiers![0];
    expect(modifier.filter).toMatchObject({ elements: ['raio'], tags: ['combo', 'esquiva'], direction: 'causado' });
  });

  it('"não permitir duplicação" ignora uma segunda aplicação do mesmo buff', () => {
    const c = ctx();
    getNodeType('modificar_valor')!.interpret!(props({ name: 'Fúria', stackRule: 'nao_duplicar' }), c);
    getNodeType('modificar_valor')!.interpret!(props({ name: 'Fúria', stackRule: 'nao_duplicar', value: 99 }), c);
    expect(c.scope[0].effects).toHaveLength(1);
    expect(c.scope[0].effects[0].effect.valueModifiers![0].value).toBe(2); // manteve o primeiro
  });

  it('"manter o maior valor" só substitui se o novo valor for maior em módulo', () => {
    const c = ctx();
    getNodeType('modificar_valor')!.interpret!(props({ name: 'Fúria', stackRule: 'manter_maior', value: 5 }), c);
    getNodeType('modificar_valor')!.interpret!(props({ name: 'Fúria', stackRule: 'manter_maior', value: 2 }), c);
    expect(c.scope[0].effects[0].effect.valueModifiers![0].value).toBe(5);
    getNodeType('modificar_valor')!.interpret!(props({ name: 'Fúria', stackRule: 'manter_maior', value: 9 }), c);
    expect(c.scope[0].effects[0].effect.valueModifiers![0].value).toBe(9);
  });

  it('"acumular valor" empilha em vez de renovar', () => {
    const c = ctx();
    getNodeType('modificar_valor')!.interpret!(props({ name: 'Fúria', stackRule: 'acumular_valor' }), c);
    getNodeType('modificar_valor')!.interpret!(props({ name: 'Fúria', stackRule: 'acumular_valor' }), c);
    expect(c.scope[0].effects).toHaveLength(1);
    expect(c.scope[0].effects[0].stacks).toBe(2);
  });
});
