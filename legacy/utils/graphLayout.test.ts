import { describe, it, expect } from 'vitest';
import { layoutGraph, edgePath } from './graphLayout';
import { createAbilityGraph, type AbilityGraph } from './abilityGraph';

describe('layoutGraph', () => {
  it('posiciona a raiz no topo e filhos em profundidades crescentes', () => {
    const graph: AbilityGraph = {
      ...createAbilityGraph({ id: 'a', name: 'X' }),
      nodes: [
        { id: 'g', type: 'ao_ativar', family: 'gatilho', props: {} },
        { id: 'd1', type: 'dano', family: 'efeito', props: {} },
        { id: 'd2', type: 'cura', family: 'efeito', props: {} },
      ],
      edges: [{ id: 'e1', from: 'g', to: 'd1' }, { id: 'e2', from: 'd1', to: 'd2' }],
    };
    const positions = layoutGraph(graph);
    expect(positions.get('g')!.y).toBeLessThan(positions.get('d1')!.y);
    expect(positions.get('d1')!.y).toBeLessThan(positions.get('d2')!.y);
  });

  it('separa irmãos no eixo x', () => {
    const graph: AbilityGraph = {
      ...createAbilityGraph({ id: 'a', name: 'X' }),
      nodes: [
        { id: 'g', type: 'ao_ativar', family: 'gatilho', props: {} },
        { id: 'd1', type: 'dano', family: 'efeito', props: {} },
        { id: 'd2', type: 'cura', family: 'efeito', props: {} },
      ],
      edges: [{ id: 'e1', from: 'g', to: 'd1' }, { id: 'e2', from: 'g', to: 'd2' }],
    };
    const positions = layoutGraph(graph);
    expect(positions.get('d1')!.x).not.toBe(positions.get('d2')!.x);
    expect(positions.get('d1')!.y).toBe(positions.get('d2')!.y);
  });

  it('respeita node.position quando já definido', () => {
    const graph: AbilityGraph = {
      ...createAbilityGraph({ id: 'a', name: 'X' }),
      nodes: [
        { id: 'g', type: 'ao_ativar', family: 'gatilho', props: {}, position: { x: 999, y: 888 } },
      ],
      edges: [],
    };
    const positions = layoutGraph(graph);
    expect(positions.get('g')).toEqual({ x: 999, y: 888 });
  });
});

describe('edgePath', () => {
  it('gera uma string de path SVG entre dois pontos', () => {
    const d = edgePath({ x: 0, y: 0 }, { x: 100, y: 120 });
    expect(d.startsWith('M0,0')).toBe(true);
    expect(d).toContain('100,120');
  });
});
