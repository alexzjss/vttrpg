import { rollDice } from './dice';
import { mergeLevel, type AbilityGraph, type GraphNode } from './abilityGraph';
import { getNodeType } from './nodeRegistry';
import type { Element } from '../types';
import type { ArsenalActorState } from './arsenalPipeline';
import type { ArsenalTag, ModifierContext } from './arsenal';

export interface TraceStep { node: string; detail?: string }

export interface UnlockCardIntent {
  cardIds: string[];
  tags: string[];
  element: Element | null;
  cardType: string | null;
}

export interface OngoingEffectIntent {
  targetId: string;
  casterId: string;
  rounds: number;
  pendingReactions?: { eventType: string; nodeIds: string[] }[];
  unlockCardIntents?: UnlockCardIntent[];
}

export interface InterpretCtx {
  actor: ArsenalActorState;
  /** Escopo corrente dos efeitos (mutável ao longo do fluxo). */
  scope: ArsenalActorState[];
  /** Alvos escolhidos para a habilidade (base). */
  primaryTargets: ArsenalActorState[];
  /** Todos os combatentes (para seletores 'todos_*'). */
  allTargets: ArsenalActorState[];
  /** Alvos contextuais fora do escopo principal, como o atacante original em uma reação. */
  additionalTargets?: ArsenalActorState[];
  roller: (notation: string, label?: string) => number;
  element: Element | null;
  trace: TraceStep[];
  /** Resultado do último nó 'teste' avaliado no walk — usado por resolveAbilityGraphAction para decidir acerto/erro por alvo. */
  hitTest?: boolean;
  /** Bônus de defesa somado ao limiar do nó 'teste' quando comparador é 'defesa_alvo' (proteção/reação). */
  defenseBonus?: number;
  /** Alvos já resolvidos geometricamente pela Cena (linha/raio/cone/quadrado, via utils/abilityArea.ts) —
   *  o núcleo headless não tem acesso a posições, então essa lista chega pronta de fora, igual defenseBonus. */
  areaTargets?: ArsenalActorState[];
  /** Valor rolado pelo nó 'esquiva' — substitui o 1d20 fixo de resolveGraphProtection como defenseBonus externo, quando presente. */
  defenseRollOverride?: number;
  /** Reações registradas por triggers alcançados como filhos (não como ponto de entrada) durante este walk. */
  pendingReactions?: { eventType: string; nodeIds: string[] }[];
  /** Pausa registrada quando o walk encontra um nó 'alvo' com scope 'escolha' — o motor de combate deve
   *  pedir ao jogador que escolha um alvo e retomar o walk a partir de nodeIds com esse alvo como escopo. */
  pendingTargetChoice?: { nodeId: string; nodeIds: string[] };
  /** Intenções de liberar cartas não atribuídas ao personagem (nó 'liberar_cartas'), acumuladas neste walk. */
  unlockCardIntents?: UnlockCardIntent[];
  /** Sincroniza mutações do escopo de volta aos alvos/ator acumulados. */
  commit?: () => void;
  /** Intenções de movimento — materializadas no mapa da Cena via movementResolver; o núcleo headless só registra. */
  movementIntents?: MovementIntent[];
  /** Multiplicador de dano/cura por id de alvo, usado pelo nó 'corrente' para modelar atenuação por salto. */
  scopeMultiplier?: Map<string, number>;
  /** Intenção de invocação — materializada na Cena (Fase 4), que cria o ator real no combate. */
  summonIntents?: { entityName: string; teamId: string; rounds: number }[];
  /** Intenção de transformação — a resolução do FormModule é responsabilidade do catálogo do arsenal (Fase 4). */
  transformIntents?: { targetId: string; intoFormId: string }[];
  /** Última condição clássica aplicada a cada alvo (por id), usada pelo nó 'eco'. */
  lastEffectKind?: Map<string, string>;
  /** Intenções de aplicar a própria habilidade como efeito contínuo — materializadas pela Cena como activeOngoingEffects. */
  ongoingEffectIntents?: OngoingEffectIntent[];
  /** Id da carta/grafo sendo resolvido — usado por ModifierFilter.cardIds nos modificadores de valor (buff/debuff v2). */
  cardId?: string;
  /** Tags da carta/grafo sendo resolvido — usado por ModifierFilter.tags. */
  cardTags?: ArsenalTag[];
  /** Em qual contexto esta resolução está rodando (normal/reação/combo/preparação) — usado por ModifierFilter.contexts. */
  context?: ModifierContext;
}

export interface MovementIntent { targetId: string; kind: string; distance: number }
export interface SummonIntent { entityName: string; teamId: 'party' | 'npc'; rounds: number; maxHp: number; maxAura: number; speed: number }
export interface TransformIntent { targetId: string; intoFormId: string }

export interface AbilityResult {
  actor: ArsenalActorState;
  targets: ArsenalActorState[];
  trace: TraceStep[];
  ongoingEffectIntents: OngoingEffectIntent[];
  hitTest?: boolean;
  pendingReactions?: { eventType: string; nodeIds: string[] }[];
  pendingTargetChoice?: { nodeId: string; nodeIds: string[] };
  unlockCardIntents?: UnlockCardIntent[];
  movementIntents: MovementIntent[];
  summonIntents: SummonIntent[];
  transformIntents: TransformIntent[];
  defenseRollOverride?: number;
}

export interface InterpretInput {
  actor: ArsenalActorState;
  primaryTargets: ArsenalActorState[];
  allTargets: ArsenalActorState[];
  roller?: (notation: string, label?: string) => number;
  /** Bônus de defesa somado ao limiar do nó 'teste' (comparador 'defesa_alvo') — usado por proteção/reação. */
  defenseBonus?: number;
  /** Alvos já resolvidos geometricamente pela Cena, para os scopes 'linha'/'raio'/'cone'/'quadrado' do nó 'alvo'. */
  areaTargets?: ArsenalActorState[];
  /** Id da carta/grafo — repassado ao ctx para os filtros de modificador de valor (buff/debuff v2). */
  cardId?: string;
  cardTags?: ArsenalTag[];
  context?: ModifierContext;
}

export function interpretAbility(graph: AbilityGraph, level: number, input: InterpretInput, opts?: { entryNodeIds?: string[] }): AbilityResult {
  const merged = mergeLevel(graph, level);
  const roller = input.roller ?? (notation => rollDice(notation).total);

  // acumuladores de estado por id
  const byId = new Map<string, ArsenalActorState>();
  byId.set(input.actor.id, { ...input.actor });
  // Em ações no próprio usuário, o ator já contém custos/cargas pagos pelo pipeline.
  // Não deixe a cópia pré-pagamento do alvo sobrescrever esse estado.
  for (const t of input.primaryTargets) if (!byId.has(t.id)) byId.set(t.id, { ...t });
  for (const t of input.allTargets) if (!byId.has(t.id)) byId.set(t.id, { ...t });
  for (const t of input.areaTargets ?? []) if (!byId.has(t.id)) byId.set(t.id, { ...t });

  const ctx: InterpretCtx = {
    actor: byId.get(input.actor.id)!,
    scope: input.primaryTargets.map(t => byId.get(t.id)!),
    primaryTargets: input.primaryTargets.map(t => byId.get(t.id)!),
    allTargets: [...byId.values()],
    additionalTargets: input.allTargets.filter(t => !input.primaryTargets.some(primary => primary.id === t.id) && t.id !== input.actor.id).map(t => byId.get(t.id)!),
    roller,
    defenseBonus: input.defenseBonus,
    areaTargets: input.areaTargets?.map(t => byId.get(t.id) ?? t),
    element: graph.header.element,
    trace: [],
    commit: undefined,
    movementIntents: [],
    summonIntents: [],
    transformIntents: [],
    lastEffectKind: new Map(),
    ongoingEffectIntents: [],
    pendingReactions: [],
    unlockCardIntents: [],
    cardId: input.cardId ?? graph.id,
    cardTags: input.cardTags ?? graph.header.tags,
    context: input.context ?? 'normal',
  };
  ctx.commit = () => {
    for (const s of ctx.scope) {
      byId.set(s.id, s);
      if (s.id === ctx.actor.id) ctx.actor = s; // mantém ctx.actor em sincronia quando o próprio ator está no escopo
    }
    byId.set(ctx.actor.id, ctx.actor);
  };

  const nodeById = new Map(merged.nodes.map(n => [n.id, n]));
  const outgoing = (id: string, branch?: 'entao' | 'senao') =>
    merged.edges.filter(e => e.from === id && (branch === undefined ? e.branch === undefined : e.branch === branch));

  const structuralRoots = opts?.entryNodeIds
    ? opts.entryNodeIds.map(id => nodeById.get(id)).filter((n): n is GraphNode => !!n)
    : merged.nodes.filter(n => !merged.edges.some(e => e.to === n.id));
  // Sem entryNodeIds explícito, só a raiz 'ao_ativar' dispara por padrão quando presente — evita que um
  // trigger reativo (ao_atacar/ao_ser_alvejado/ao_esquivar) pendurado solto no mesmo grafo (ex.: por engano
  // de edição, desconectado da árvore de 'aplicar_como_efeito') dispare imediatamente na ativação em vez de
  // virar reação pendente. Grafos dedicados a um único trigger reativo (ex.: cartas de proteção cuja única
  // raiz é 'ao_ser_alvejado') continuam dependendo desse mesmo trigger por padrão, já que não há 'ao_ativar'.
  const hasAtivarRoot = structuralRoots.some(n => n.type === 'ao_ativar');
  const entryPoints = opts?.entryNodeIds
    ? structuralRoots
    : structuralRoots.filter(n => {
        if (n.type === 'enquanto_ativa' || n.type === 'em_combo') return false;
        return hasAtivarRoot ? n.type === 'ao_ativar' : true;
      });
  if (!entryPoints.length) return { actor: ctx.actor, targets: [...byId.values()].filter(a => a.id !== ctx.actor.id), trace: ctx.trace, ongoingEffectIntents: [], movementIntents: [], summonIntents: [], transformIntents: [] };

  const entryIds = new Set(entryPoints.map(n => n.id));
  const visited = new Set<string>();
  const walk = (node: GraphNode | undefined) => {
    if (!node || visited.has(node.id)) return;   // guarda anti-ciclo acidental
    visited.add(node.id);
    const def = getNodeType(node.type);
    if (node.family === 'gatilho' && !entryIds.has(node.id)) {
      // trigger alcançado como filho (não como entrada): registra a reação e para o walk aqui.
      const childIds = outgoing(node.id).map(e => e.to);
      if (childIds.length) {
        const pendingReaction = { eventType: node.type, nodeIds: childIds };
        ctx.pendingReactions = [...(ctx.pendingReactions ?? []), pendingReaction];
        ctx.ongoingEffectIntents = (ctx.ongoingEffectIntents ?? []).map(intent => ({
          ...intent,
          pendingReactions: [...(intent.pendingReactions ?? []), pendingReaction],
        }));
      }
      return;
    }
    if (node.type === 'alvo' && (node.props as { scope?: string })?.scope === 'escolha') {
      // Escolha manual de alvo: pausa o walk aqui — o motor de combate pede ao jogador que escolha um
      // alvo e retoma a interpretação a partir de nodeIds (opts.entryNodeIds), com o escolhido como escopo.
      const childIds = outgoing(node.id).map(e => e.to);
      ctx.pendingTargetChoice = { nodeId: node.id, nodeIds: childIds };
      ctx.trace.push({ node: 'alvo', detail: 'Aguardando escolha manual de alvo' });
      return;
    }
    if (!def) { ctx.trace.push({ node: node.type, detail: 'nó desconhecido — ignorado' }); }
    else if (node.family === 'ramo' && def.evaluate) {
      const branch = def.evaluate(node.props, ctx) ? 'entao' : 'senao';
      ctx.trace.push({ node: node.type, detail: `→ ${branch}` });
      for (const e of outgoing(node.id, branch)) walk(nodeById.get(e.to));
      return;
    } else if (def.interpret) {
      def.interpret(node.props, ctx);
    }
    for (const e of outgoing(node.id)) walk(nodeById.get(e.to));
  };
  for (const entry of entryPoints) walk(entry);
  ctx.commit?.();

  return {
    actor: byId.get(input.actor.id)!,
    targets: [...byId.values()].filter(a => a.id !== input.actor.id),
    trace: ctx.trace,
    ongoingEffectIntents: ctx.ongoingEffectIntents ?? [],
    hitTest: ctx.hitTest,
    pendingReactions: ctx.pendingReactions,
    pendingTargetChoice: ctx.pendingTargetChoice,
    unlockCardIntents: ctx.unlockCardIntents,
    movementIntents: ctx.movementIntents ?? [],
    summonIntents: ctx.summonIntents ?? [],
    transformIntents: ctx.transformIntents ?? [],
    defenseRollOverride: ctx.defenseRollOverride,
  };
}
