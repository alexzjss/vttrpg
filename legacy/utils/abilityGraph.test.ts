import { describe, it, expect, beforeEach } from 'vitest';
import { createAbilityGraph, mergeLevel, type AbilityGraph } from './abilityGraph';
import { _resetRegistry } from './nodeRegistry';
import { ensureNodesRegistered } from './nodes';

describe('createAbilityGraph', () => {
  it('cria um grafo com cabeçalho padrão, uma raiz-gatilho e sem perfis', () => {
    const g = createAbilityGraph({ id: 'a1', name: 'Bola de Fogo' });
    expect(g.kind).toBe('graph');
    expect(g.schemaVersion).toBe(2);
    expect(g.header.name).toBe('Bola de Fogo');
    expect(g.nodes).toHaveLength(1);
    expect(g.nodes[0].family).toBe('gatilho');
    expect(g.edges).toEqual([]);
    expect(g.levelProfiles).toEqual([]);
  });
});

describe('mergeLevel', () => {
  it('aplica overrides de campo de nó do nível pedido', () => {
    const base: AbilityGraph = {
      ...createAbilityGraph({ id: 'a1', name: 'X' }),
      nodes: [
        { id: 'g', type: 'ao_ativar', family: 'gatilho', props: {} },
        { id: 'd', type: 'dano', family: 'efeito', props: { dice: '1d6', flat: 0, element: 'fogo' } },
      ],
      edges: [{ id: 'e1', from: 'g', to: 'd' }],
      levelProfiles: [{ level: 2, overrides: [{ nodeId: 'd', field: 'dice', value: '2d6' }] }],
    };
    const merged = mergeLevel(base, 2);
    const dano = merged.nodes.find(n => n.id === 'd')!;
    expect(dano.props.dice).toBe('2d6');
    // nível 1 permanece o base
    expect(mergeLevel(base, 1).nodes.find(n => n.id === 'd')!.props.dice).toBe('1d6');
  });

  describe('validação de tipo do override', () => {
    beforeEach(() => { _resetRegistry(); ensureNodesRegistered(); });

    it('ignora override com valor de tipo incompatível com o campo declarado', () => {
      const base: AbilityGraph = {
        ...createAbilityGraph({ id: 'a1', name: 'X' }),
        nodes: [
          { id: 'g', type: 'ao_ativar', family: 'gatilho', props: {} },
          { id: 'd', type: 'dano', family: 'efeito', props: { dice: '1d6', flat: 2, element: 'fogo' } },
        ],
        edges: [{ id: 'e1', from: 'g', to: 'd' }],
        // 'flat' é campo 'numero' — um valor string não deveria ser aceito.
        levelProfiles: [{ level: 2, overrides: [{ nodeId: 'd', field: 'flat', value: 'não é número' }] }],
      };
      const merged = mergeLevel(base, 2);
      expect(merged.nodes.find(n => n.id === 'd')!.props.flat).toBe(2);
    });

    it('aceita override de campo dinâmico não listado em fields (ex.: específico de condição)', () => {
      const base: AbilityGraph = {
        ...createAbilityGraph({ id: 'a1', name: 'X' }),
        nodes: [
          { id: 'g', type: 'ao_ativar', family: 'gatilho', props: {} },
          { id: 'c', type: 'aplicar_condicao', family: 'efeito', props: { conditionName: 'Queimando', rounds: 2, chance: 100 } },
        ],
        edges: [{ id: 'e1', from: 'g', to: 'c' }],
        levelProfiles: [{ level: 2, overrides: [{ nodeId: 'c', field: 'damagePerRound', value: 5 }] }],
      };
      const merged = mergeLevel(base, 2);
      expect(merged.nodes.find(n => n.id === 'c')!.props.damagePerRound).toBe(5);
    });

    it('ignora override cujo nó não existe no grafo mesclado', () => {
      const base: AbilityGraph = {
        ...createAbilityGraph({ id: 'a1', name: 'X' }),
        nodes: [{ id: 'g', type: 'ao_ativar', family: 'gatilho', props: {} }],
        edges: [],
        levelProfiles: [{ level: 2, overrides: [{ nodeId: 'inexistente', field: 'flat', value: 5 }] }],
      };
      expect(() => mergeLevel(base, 2)).not.toThrow();
    });
  });

  it('liga nós marcados em enabledNodeIds a partir do nível', () => {
    const base: AbilityGraph = {
      ...createAbilityGraph({ id: 'a1', name: 'X' }),
      nodes: [
        { id: 'g', type: 'ao_ativar', family: 'gatilho', props: {} },
        { id: 'extra', type: 'cura', family: 'efeito', props: { dice: '1d4', flat: 0 }, enabledFromLevel: 3 },
      ],
      edges: [{ id: 'e1', from: 'g', to: 'extra' }],
    };
    expect(mergeLevel(base, 2).nodes.some(n => n.id === 'extra')).toBe(false);
    expect(mergeLevel(base, 3).nodes.some(n => n.id === 'extra')).toBe(true);
  });
});
