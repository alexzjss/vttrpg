import type { AbilityGraph, GraphNode, GraphEdge, NodeFamily } from './abilityGraph';
import { getNodeType } from './nodeRegistry';

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

/** Cria um nó com os defaults do tipo registrado e o conecta ao pai (com `branch` se o pai for um ramo). */
export function addNode(
  graph: AbilityGraph, parentId: string, type: string, branch?: 'entao' | 'senao',
): { graph: AbilityGraph; nodeId: string } {
  const def = getNodeType(type);
  const nodeId = newId(type);
  const node: GraphNode = { id: nodeId, type, family: (def?.family ?? 'efeito') as NodeFamily, props: def?.defaults() ?? {} };
  const edge: GraphEdge = { id: newId('edge'), from: parentId, to: nodeId, ...(branch ? { branch } : {}) };
  return { graph: { ...graph, nodes: [...graph.nodes, node], edges: [...graph.edges, edge] }, nodeId };
}

/** Um nó é raiz estrutural do grafo se nenhuma aresta aponta para ele. */
function isStructuralRoot(graph: AbilityGraph, nodeId: string): boolean {
  return !graph.edges.some(e => e.to === nodeId);
}

/** Quantos nós de trigger (família 'gatilho') são raízes estruturais no grafo — o principal mais
 * quaisquer raízes secundárias soltas (ex. 'em_combo', 'enquanto_ativa' sem pai). */
function structuralTriggerRootCount(graph: AbilityGraph): number {
  return graph.nodes.filter(n => n.family === 'gatilho' && isStructuralRoot(graph, n.id)).length;
}

/** Remove um nó e toda a subárvore alcançável a partir dele. No-op se `nodeId` for a única raiz
 * estrutural de trigger do grafo (o grafo precisa manter ao menos um ponto de entrada) — qualquer
 * outro nó, incluindo raízes secundárias soltas ou triggers pendurados como filhos, pode ser
 * removido normalmente. */
export function removeNode(graph: AbilityGraph, nodeId: string): AbilityGraph {
  const target = graph.nodes.find(n => n.id === nodeId);
  if (!target) return graph;
  if (target.family === 'gatilho' && isStructuralRoot(graph, nodeId) && structuralTriggerRootCount(graph) <= 1) return graph;

  const toRemove = new Set<string>([nodeId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const edge of graph.edges) {
      if (toRemove.has(edge.from) && !toRemove.has(edge.to)) { toRemove.add(edge.to); grew = true; }
    }
  }

  return {
    ...graph,
    nodes: graph.nodes.filter(n => !toRemove.has(n.id)),
    edges: graph.edges.filter(e => !toRemove.has(e.from) && !toRemove.has(e.to)),
  };
}

export function updateNodeProps(graph: AbilityGraph, nodeId: string, patch: Record<string, unknown>): AbilityGraph {
  return {
    ...graph,
    nodes: graph.nodes.map(n => n.id === nodeId ? { ...n, props: { ...n.props, ...patch } } : n),
  };
}

export function moveNode(graph: AbilityGraph, nodeId: string, position: { x: number; y: number }): AbilityGraph {
  return { ...graph, nodes: graph.nodes.map(n => n.id === nodeId ? { ...n, position } : n) };
}

/** Cria ou atualiza, no perfil do nível informado, o override do campo de um nó. */
export function setLevelOverride(graph: AbilityGraph, level: number, nodeId: string, field: string, value: unknown): AbilityGraph {
  const profiles = [...graph.levelProfiles];
  const index = profiles.findIndex(p => p.level === level);
  if (index < 0) {
    return { ...graph, levelProfiles: [...profiles, { level, overrides: [{ nodeId, field, value }] }] };
  }
  const existing = profiles[index];
  const overrideIndex = existing.overrides.findIndex(o => o.nodeId === nodeId && o.field === field);
  const overrides = overrideIndex < 0
    ? [...existing.overrides, { nodeId, field, value }]
    : existing.overrides.map((o, i) => i === overrideIndex ? { ...o, value } : o);
  profiles[index] = { ...existing, overrides };
  return { ...graph, levelProfiles: profiles };
}

/** Troca o tipo do nó-raiz (gatilho) existente, preservando id/props/arestas. Usa os defaults do novo tipo. */
export function setRootTrigger(graph: AbilityGraph, type: string): AbilityGraph {
  const root = graph.nodes.find(n => n.family === 'gatilho');
  if (!root) return graph;
  const def = getNodeType(type);
  return {
    ...graph,
    nodes: graph.nodes.map(n => n.id === root.id ? { ...n, type, props: def?.defaults() ?? {} } : n),
  };
}

/** Anexa uma raiz secundária solta (sem arestas) ao grafo, ex. 'enquanto_ativa'. No-op se já existir uma com o mesmo tipo. */
export function addSecondaryTrigger(graph: AbilityGraph, type: string): AbilityGraph {
  if (graph.nodes.some(n => n.type === type)) return graph;
  const def = getNodeType(type);
  const node: GraphNode = { id: `gatilho-${type}-${crypto.randomUUID()}`, type, family: 'gatilho', props: def?.defaults() ?? {} };
  return ensureStandardCards({ ...graph, nodes: [...graph.nodes, node] }, node.id);
}

function reachableFrom(graph: AbilityGraph, rootId: string): Set<string> {
  const reachable = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length) {
    const id = queue.pop()!;
    for (const edge of graph.edges) {
      if (edge.from === id && !reachable.has(edge.to)) { reachable.add(edge.to); queue.push(edge.to); }
    }
  }
  return reachable;
}

/** Garante que o gatilho `triggerId` venha com os dois "cartões padrão": um nó 'alvo' CONECTADO
 *  como filho direto (scope 'alvo_da_habilidade' — o mesmo comportamento implícito de sempre, então
 *  não muda nada ao ser inserido), reconectando quaisquer filhos já existentes por baixo dele; e um
 *  nó 'teste' DESCONECTADO (sem aresta nenhuma), só disponível no canvas pra o designer ligar quando
 *  quiser — nunca afeta a execução sozinho. Idempotente: seguro de chamar de novo sobre o mesmo gatilho. */
export function ensureStandardCards(graph: AbilityGraph, triggerId: string): AbilityGraph {
  return ensureTestCard(ensureTargetCard(graph, triggerId), triggerId);
}

function ensureTargetCard(graph: AbilityGraph, triggerId: string): AbilityGraph {
  const directChildren = graph.edges.filter(e => e.from === triggerId);
  const hasAlvo = directChildren.some(e => graph.nodes.find(n => n.id === e.to)?.type === 'alvo');
  if (hasAlvo) return graph;
  const alvoId = `alvo-standard-${triggerId}`;
  if (graph.nodes.some(n => n.id === alvoId)) return graph;
  const def = getNodeType('alvo');
  const alvoNode: GraphNode = { id: alvoId, type: 'alvo', family: 'alvo', props: def?.defaults() ?? {} };
  const rewired = graph.edges.map(e => e.from === triggerId ? { ...e, from: alvoId } : e);
  const newEdge: GraphEdge = { id: newId('edge'), from: triggerId, to: alvoId };
  return { ...graph, nodes: [...graph.nodes, alvoNode], edges: [...rewired, newEdge] };
}

function ensureTestCard(graph: AbilityGraph, triggerId: string): AbilityGraph {
  const testeId = `teste-standard-${triggerId}`;
  if (graph.nodes.some(n => n.id === testeId)) return graph;
  const reachable = reachableFrom(graph, triggerId);
  if (graph.nodes.some(n => reachable.has(n.id) && n.type === 'teste')) return graph;
  const def = getNodeType('teste');
  const testeNode: GraphNode = { id: testeId, type: 'teste', family: 'ramo', props: def?.defaults() ?? {} };
  return { ...graph, nodes: [...graph.nodes, testeNode] };
}

/** Aplica `ensureStandardCards` a todo gatilho do grafo — usado na migração de grafos já salvos
 *  (ver runMigrations em utils/database.ts) e reaproveitável sempre que for preciso garantir os
 *  cartões padrão num grafo inteiro de uma vez. Idempotente, como ensureStandardCards. */
export function ensureStandardCardsOnAllTriggers(graph: AbilityGraph): AbilityGraph {
  return graph.nodes
    .filter(n => n.family === 'gatilho')
    .reduce((g, trigger) => ensureStandardCards(g, trigger.id), graph);
}
