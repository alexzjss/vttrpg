import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry } from './nodeRegistry';
import { ensureNodesRegistered } from './nodes';
import { createAbilityGraph, type AbilityGraph, type GraphNode } from './abilityGraph';
import { graphAreaConfig, resolveAreaTargets } from './abilityArea';

function attachToRoot(graph: AbilityGraph, node: GraphNode): AbilityGraph {
  const rootId = graph.nodes.find(n => n.family === 'gatilho')!.id;
  return { ...graph, nodes: [...graph.nodes, node], edges: [...graph.edges, { id: `edge-${node.id}`, from: rootId, to: node.id }] };
}

describe('graphAreaConfig', () => {
  beforeEach(() => { _resetRegistry(); ensureNodesRegistered(); });

  it('acha o nó alvo geométrico alcançável e devolve sua config', () => {
    const graph = attachToRoot(createAbilityGraph({ id: 'g', name: 'Bola de Fogo' }), {
      id: 'a', type: 'alvo', family: 'alvo', props: { scope: 'raio', radius: 3 },
    });
    expect(graphAreaConfig(graph, 1)).toEqual(expect.objectContaining({ shape: 'raio', radius: 3 }));
  });

  it('retorna null quando o grafo não tem nó alvo geométrico', () => {
    const graph = createAbilityGraph({ id: 'g2', name: 'Golpe' });
    expect(graphAreaConfig(graph, 1)).toBeNull();
  });

  it('retorna null quando o nó alvo geométrico está desconectado (não alcançável)', () => {
    const graph: AbilityGraph = {
      ...createAbilityGraph({ id: 'g3', name: 'Desconectado' }),
      nodes: [
        { id: 'gt', type: 'ao_ativar', family: 'gatilho', props: {} },
        { id: 'a', type: 'alvo', family: 'alvo', props: { scope: 'raio', radius: 3 } },
      ],
      edges: [],
    };
    expect(graphAreaConfig(graph, 1)).toBeNull();
  });
});

describe('resolveAreaTargets', () => {
  const tokens = {
    origin: { x: 50, y: 50 },
    near: { x: 55, y: 50 },   // 5 de distância em x
    far: { x: 90, y: 50 },    // 40 de distância em x
    aimed: { x: 50, y: 30 },  // 20 acima do origin (direção da mira)
    onLine: { x: 50, y: 40 }, // no meio do caminho até 'aimed', bem alinhado
    offLine: { x: 80, y: 40 }, // longe lateralmente da linha
  };
  const candidateIds = ['near', 'far', 'aimed', 'onLine', 'offLine'];

  it('raio: inclui só quem está dentro do raio (em unidades de MOVE_UNIT_PCT)', () => {
    const result = resolveAreaTargets({ shape: 'raio', distance: 0, width: 0, radius: 1, range: 0, angle: 0, size: 0 }, 'origin', null, tokens, candidateIds);
    expect(result).toEqual(['near']); // raio 1 = 8%; near está a 5% de distância, far está a 40%
  });

  it('quadrado: inclui quem está dentro da caixa centrada no ator', () => {
    const result = resolveAreaTargets({ shape: 'quadrado', distance: 0, width: 0, radius: 0, range: 0, angle: 0, size: 2 }, 'origin', null, tokens, candidateIds);
    expect(result).toContain('near');
    expect(result).not.toContain('far');
  });

  it('linha: sem mira definida (aimAt null), não atinge ninguém', () => {
    const result = resolveAreaTargets({ shape: 'linha', distance: 3, width: 1, radius: 0, range: 0, angle: 0, size: 0 }, 'origin', null, tokens, candidateIds);
    expect(result).toEqual([]);
  });

  it('linha: com mira definida, atinge quem está alinhado no caminho, não quem está fora', () => {
    const result = resolveAreaTargets({ shape: 'linha', distance: 3, width: 1, radius: 0, range: 0, angle: 0, size: 0 }, 'origin', 'aimed', tokens, candidateIds);
    expect(result).toContain('onLine');
    expect(result).toContain('aimed');
    expect(result).not.toContain('offLine');
    expect(result).not.toContain('near'); // perpendicular à linha, não no caminho
  });

  it('cone: sem mira definida, não atinge ninguém', () => {
    const result = resolveAreaTargets({ shape: 'cone', distance: 0, width: 0, radius: 0, range: 3, angle: 60, size: 0 }, 'origin', null, tokens, candidateIds);
    expect(result).toEqual([]);
  });

  it('cone: com mira definida, atinge quem está no ângulo e alcance, não quem está fora do cone', () => {
    const result = resolveAreaTargets({ shape: 'cone', distance: 0, width: 0, radius: 0, range: 3, angle: 60, size: 0 }, 'origin', 'aimed', tokens, candidateIds);
    expect(result).toContain('aimed');
    expect(result).toContain('onLine');
    expect(result).not.toContain('offLine');
  });

  it('origem ou mira ausente em tokens não quebra, retorna vazio', () => {
    expect(resolveAreaTargets({ shape: 'raio', distance: 0, width: 0, radius: 1, range: 0, angle: 0, size: 0 }, 'missing', null, tokens, candidateIds)).toEqual([]);
  });
});
