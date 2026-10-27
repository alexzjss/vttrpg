import type { AbilityGraph } from './abilityGraph';

export interface Point { x: number; y: number }

const X_STEP = 200;
const Y_STEP = 130;

/** Layout top-down por BFS a partir de cada raiz-gatilho; respeita node.position quando já definido. */
export function layoutGraph(graph: AbilityGraph, options: { respectPositions?: boolean } = {}): Map<string, Point> {
  const respectPositions = options.respectPositions !== false;
  const positions = new Map<string, Point>();
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const childrenOf = (id: string) => graph.edges.filter(e => e.from === id).map(e => e.to);

  const roots = graph.nodes.filter(n => n.family === 'gatilho');
  let nextColumn = 0;
  const visited = new Set<string>();

  const place = (id: string, depth: number): void => {
    if (visited.has(id)) return;
    visited.add(id);
    const node = byId.get(id);
    const existing = respectPositions ? node?.position : undefined;
    const children = childrenOf(id);
    if (children.length === 0) {
      positions.set(id, existing ?? { x: nextColumn * X_STEP, y: depth * Y_STEP });
      if (!existing) nextColumn += 1;
      return;
    }
    const startColumn = nextColumn;
    for (const childId of children) place(childId, depth + 1);
    const childColumns = children.map(childId => positions.get(childId)!.x / X_STEP);
    const centerColumn = existing ? existing.x / X_STEP : (Math.min(...childColumns) + Math.max(...childColumns)) / 2;
    positions.set(id, existing ?? { x: centerColumn * X_STEP, y: depth * Y_STEP });
    void startColumn;
  };

  for (const root of roots) place(root.id, 0);
  // nós órfãos (sem aresta de entrada, fora de qualquer raiz alcançada) recebem uma coluna própria
  for (const node of graph.nodes) if (!visited.has(node.id)) place(node.id, 0);

  return positions;
}

export function arrangeGraph(graph: AbilityGraph): AbilityGraph {
  const positions = layoutGraph(graph, { respectPositions: false });
  return {
    ...graph,
    nodes: graph.nodes.map(node => ({
      ...node,
      position: positions.get(node.id) ?? node.position,
    })),
  };
}

/** Curva simples entre dois pontos (linha reta é suficiente para o MVP do canvas). */
export function edgePath(from: Point, to: Point): string {
  const midY = from.y + Math.max(42, (to.y - from.y) * 0.45);
  return `M${from.x},${from.y} C${from.x},${midY} ${to.x},${midY} ${to.x},${to.y}`;
}
