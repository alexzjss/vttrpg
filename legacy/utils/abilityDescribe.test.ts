import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry } from './nodeRegistry';
import { ensureNodesRegistered } from './nodes';
import { listAbilityTemplates } from './abilityTemplates';
import { describeAbilityGraph } from './abilityDescribe';

describe('describeAbilityGraph', () => {
  beforeEach(() => { _resetRegistry(); ensureNodesRegistered(); });

  it('descreve um ataque simples com teste, dano e condicao', () => {
    const graph = listAbilityTemplates().find(t => t.id === 'ataque_aura_condicao')!.build({
      testDice: '1d20', auraCost: 3, damageDice: '2d6', element: 'fogo', conditionKind: 'queimadura', conditionRounds: 2,
    });
    const text = describeAbilityGraph(graph);
    expect(text).toContain('1d20');
    expect(text).toContain('Custo');
    expect(text).toContain('Dano');
    expect(text).toContain('queimadura');
  });

  it('descreve um ramo condicional com senao', () => {
    const graph = listAbilityTemplates().find(t => t.id === 'estado_alvo')!.build({ statePercent: 30 });
    const text = describeAbilityGraph(graph);
    expect(text).toContain('senão');
  });

  it('grafo sem gatilho retorna mensagem de erro textual', () => {
    const graph = listAbilityTemplates().find(t => t.id === 'cura')!.build();
    const semGatilho = { ...graph, nodes: graph.nodes.filter(n => n.family !== 'gatilho') };
    expect(describeAbilityGraph(semGatilho)).toBe('Habilidade sem gatilho definido.');
  });
});
