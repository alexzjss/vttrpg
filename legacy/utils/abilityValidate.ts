import type { AbilityGraph } from './abilityGraph';

export interface GraphIssue {
  severity: 'erro' | 'aviso';
  message: string;
  nodeId?: string;
}

const EFFECT_TYPES_WITH_DAMAGE = new Set(['dano', 'cura']);
const AURA_COST_WARNING_THRESHOLD = 8;

/** Nós que participam de algum ciclo no grafo (DFS com pilha de recursão). O motor de interpretação já se
 *  protege de ciclo em runtime (para de andar ao revisitar um nó — ver abilityInterpreter.ts), mas isso
 *  significa que parte do grafo simplesmente nunca roda de novo, silenciosamente; o autor precisa saber
 *  disso ANTES de salvar, não descobrir só ao simular. */
function nodesInCycles(graph: AbilityGraph): Set<string> {
  const inCycle = new Set<string>();
  const visiting = new Set<string>();
  const done = new Set<string>();
  const outgoing = (id: string) => graph.edges.filter(e => e.from === id).map(e => e.to);
  const visit = (id: string, path: string[]) => {
    if (done.has(id)) return;
    if (visiting.has(id)) {
      const cycleStart = path.indexOf(id);
      for (const node of path.slice(cycleStart)) inCycle.add(node);
      return;
    }
    visiting.add(id);
    for (const next of outgoing(id)) visit(next, [...path, id]);
    visiting.delete(id);
    done.add(id);
  };
  for (const node of graph.nodes) visit(node.id, []);
  return inCycle;
}

function ancestorsOf(graph: AbilityGraph, nodeId: string): Set<string> {
  const seen = new Set<string>();
  const stack = [nodeId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const edge of graph.edges) {
      if (edge.to === id && !seen.has(edge.from)) {
        seen.add(edge.from);
        stack.push(edge.from);
      }
    }
  }
  return seen;
}

export function validateAbilityGraph(graph: AbilityGraph): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const root = graph.nodes.find(n => n.family === 'gatilho' && n.type !== 'enquanto_ativa') ?? graph.nodes.find(n => n.family === 'gatilho');

  if (!root) {
    issues.push({ severity: 'erro', message: 'Habilidade sem gatilho (nó raiz).' });
    return issues;
  }

  // Nó desconectado: qualquer nó que não seja alcançável a partir da raiz.
  const reachable = new Set<string>([root.id]);
  const queue = [root.id];
  while (queue.length) {
    const id = queue.pop()!;
    for (const edge of graph.edges) {
      if (edge.from === id && !reachable.has(edge.to)) {
        reachable.add(edge.to);
        queue.push(edge.to);
      }
    }
  }
  for (const node of graph.nodes) {
    if (node.id !== root.id && !reachable.has(node.id)) {
      issues.push({ severity: 'erro', message: `Nó "${node.type}" está desconectado do fluxo.`, nodeId: node.id });
    }
  }

  // Ciclo no fluxo: o motor não trava (para de andar ao revisitar um nó), mas parte do grafo depois do
  // ciclo nunca roda de novo silenciosamente — o autor precisa ver isso antes de salvar.
  for (const nodeId of nodesInCycles(graph)) {
    issues.push({ severity: 'erro', message: 'Nó faz parte de um ciclo no fluxo — a habilidade para de andar ao revisitá-lo, então o que vem depois do ciclo nunca roda de novo.', nodeId });
  }

  // Habilidade sem resultado final: nenhum nó de família 'efeito' em todo o grafo.
  if (!graph.nodes.some(n => n.family === 'efeito')) {
    issues.push({ severity: 'erro', message: 'Habilidade não produz nenhum efeito (dano, cura, condição, etc.).' });
  }

  for (const node of graph.nodes) {
    const props = node.props as Record<string, unknown>;

    // Dano sem alvo definido: efeito de dano/cura numa reação sem um nó 'alvo' antes dele.
    if (EFFECT_TYPES_WITH_DAMAGE.has(node.type) && root.type === 'ao_ser_alvejado') {
      const ancestors = ancestorsOf(graph, node.id);
      const hasTargetNode = [...ancestors].some(id => graph.nodes.find(n => n.id === id)?.family === 'alvo');
      if (!hasTargetNode) {
        issues.push({ severity: 'aviso', message: `"${node.type}" numa reação não define um alvo explícito (use um nó Alvo antes).`, nodeId: node.id });
      }
    }

    // Efeito contínuo sem duração.
    if ((node.type === 'aplicar_como_efeito' || node.type === 'buff') && (!props.rounds || Number(props.rounds) <= 0)) {
      issues.push({ severity: 'erro', message: `"${node.type}" é um efeito contínuo mas não tem duração definida.`, nodeId: node.id });
    }

    // Custo de aura muito acima dos valores comuns.
    if (node.type === 'custo' && props.recurso === 'aura' && Number(props.amount) > AURA_COST_WARNING_THRESHOLD) {
      issues.push({ severity: 'aviso', message: `Custo de aura (${props.amount}) está bem acima do comum (~${AURA_COST_WARNING_THRESHOLD}).`, nodeId: node.id });
    }

    // Ramo condicional sem caminho de sucesso.
    if (node.family === 'ramo') {
      const hasThen = graph.edges.some(e => e.from === node.id && e.branch === 'entao');
      if (!hasThen) {
        issues.push({ severity: 'erro', message: `Ramo "${node.type}" não tem um caminho de sucesso (SE).`, nodeId: node.id });
      }
      // Condição que nunca pode ser alcançada.
      if (node.type === 'teste' && props.comparador === 'porcentagem') {
        const percent = Number(props.valorFixo);
        if (percent <= 0) issues.push({ severity: 'aviso', message: 'Chance de 0% ou menos: o caminho SE nunca acontece.', nodeId: node.id });
        if (percent >= 100) issues.push({ severity: 'aviso', message: 'Chance de 100% ou mais: o caminho SENÃO nunca acontece.', nodeId: node.id });
      }
      if (node.type === 'se_vida_alvo') {
        const percent = Number(props.percent);
        if (props.comparacao === 'abaixo' && percent <= 0) issues.push({ severity: 'aviso', message: 'Vida abaixo de 0% nunca é verdadeiro.', nodeId: node.id });
        if (props.comparacao === 'acima' && percent >= 100) issues.push({ severity: 'aviso', message: 'Vida acima de 100% nunca é verdadeiro.', nodeId: node.id });
      }
    }
  }

  // Reação que não identifica o causador do gatilho: reação com retaliação mas sem 'atacante_original'.
  if (root.type === 'ao_ser_alvejado') {
    const hasRetaliation = graph.nodes.some(n => EFFECT_TYPES_WITH_DAMAGE.has(n.type));
    const hasAttackerScope = graph.nodes.some(n => n.type === 'alvo' && (n.props as Record<string, unknown>).scope === 'atacante_original');
    if (hasRetaliation && !hasAttackerScope) {
      issues.push({ severity: 'aviso', message: 'Reação com retaliação não identifica o causador do gatilho (adicione um nó Alvo com escopo "atacante original").' });
    }
  }

  return issues;
}
