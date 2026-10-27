import type { AbilityGraph, GraphNode } from './abilityGraph';
import { getNodeType } from './nodeRegistry';

function nodeSummary(node: GraphNode): string {
  const def = getNodeType(node.type);
  if (!def) return node.type;
  return def.summarize(node.props);
}

function walk(graph: AbilityGraph, nodeId: string, nodeById: Map<string, GraphNode>, visited: Set<string>): string[] {
  if (visited.has(nodeId)) return [];
  visited.add(nodeId);
  const node = nodeById.get(nodeId);
  if (!node) return [];

  if (node.family === 'ramo') {
    const thenIds = graph.edges.filter(e => e.from === nodeId && e.branch === 'entao').map(e => e.to);
    const elseIds = graph.edges.filter(e => e.from === nodeId && e.branch === 'senao').map(e => e.to);
    const thenText = thenIds.flatMap(id => walk(graph, id, nodeById, visited)).join(', ') || 'nada acontece';
    const elseText = elseIds.flatMap(id => walk(graph, id, nodeById, visited)).join(', ');
    const clause = elseIds.length
      ? `${nodeSummary(node)}: ${thenText}; senão, ${elseText}`
      : `${nodeSummary(node)}: ${thenText}`;
    return [clause];
  }

  const clauses = [nodeSummary(node)];
  const nextIds = graph.edges.filter(e => e.from === nodeId && e.branch === undefined).map(e => e.to);
  for (const id of nextIds) clauses.push(...walk(graph, id, nodeById, visited));
  return clauses;
}

/** Gera uma descricao textual legivel do grafo, atualizada a cada edicao. */
export function describeAbilityGraph(graph: AbilityGraph): string {
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]));
  const root = graph.nodes.find(n => n.family === 'gatilho' && n.type !== 'enquanto_ativa') ?? graph.nodes.find(n => n.family === 'gatilho');
  if (!root) return 'Habilidade sem gatilho definido.';

  const visited = new Set<string>([root.id]);
  const trigger = nodeSummary(root);
  const nextIds = graph.edges.filter(e => e.from === root.id && e.branch === undefined).map(e => e.to);
  const clauses = nextIds.flatMap(id => walk(graph, id, nodeById, visited));

  const parts = clauses;

  if (!parts.length) return `${trigger}.`;
  return `${trigger}, ${parts.join('. Em seguida, ')}.`;
}
