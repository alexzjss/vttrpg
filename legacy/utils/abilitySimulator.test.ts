import { describe, it, expect, beforeEach } from 'vitest';
import { simulateAbility, describeTrace } from './abilitySimulator';
import { _resetRegistry } from './nodeRegistry';
import { registerCoreNodes } from './nodes/coreNodes';
import { createAbilityGraph, type AbilityGraph } from './abilityGraph';

function graphDano(): AbilityGraph {
  return {
    ...createAbilityGraph({ id: 'g', name: 'Bola de Fogo', element: 'fogo' }),
    nodes: [
      { id: 'g', type: 'ao_ativar', family: 'gatilho', props: {} },
      { id: 'd', type: 'dano', family: 'efeito', props: { dice: '2d6', flat: 0, element: 'fogo' } },
      { id: 'c', type: 'aplicar_condicao', family: 'efeito', props: { conditionName: 'Queimando' } },
    ],
    edges: [{ id: 'e1', from: 'g', to: 'd' }, { id: 'e2', from: 'd', to: 'c' }],
  };
}

describe('simulateAbility', () => {
  beforeEach(() => { _resetRegistry(); registerCoreNodes(); });

  it('roda contra um alvo fictício com roller fixo e produz trace legível', () => {
    const res = simulateAbility(graphDano(), 1, { roller: () => 7 });
    const texto = describeTrace(res.trace);
    expect(texto).toContain('dano');
    expect(texto).toContain('Queimando');
    expect(res.targets[0].currentHp).toBeLessThan(res.targets[0].maxHp);
  });

  it('simula custo insuficiente: reporta bloqueio em vez de aplicar o efeito', () => {
    const graph: AbilityGraph = {
      ...createAbilityGraph({ id: 'sim-custo', name: 'Simulação com custo' }),
      nodes: [
        { id: 'g', type: 'ao_ativar', family: 'gatilho', props: {} },
        { id: 'custo', type: 'custo', family: 'efeito', props: { recurso: 'aura', amount: 999 } },
        { id: 'd', type: 'dano', family: 'efeito', props: { dice: undefined, flat: 10, element: 'fisico' } },
      ],
      edges: [{ id: 'e1', from: 'g', to: 'custo' }, { id: 'e2', from: 'custo', to: 'd' }],
    };
    const res = simulateAbility(graph, 1, { roller: () => 10 });
    expect(res.status).toBe('bloqueada');
  });
});
