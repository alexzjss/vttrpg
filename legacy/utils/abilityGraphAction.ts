import { rollDice } from './dice';
import { mergeLevel, type AbilityGraph } from './abilityGraph';
import type { ArsenalHolding, CooldownConfig, ModifierContext, PreparationConfig } from './arsenal';
import { INSTANT_PREPARATION } from './arsenal';
import { interpretAbility, type TraceStep, type OngoingEffectIntent, type MovementIntent, type SummonIntent, type TransformIntent } from './abilityInterpreter';
import { resolveModifiedValue } from './effectModifiers';
import type { ArsenalActorState } from './arsenalPipeline';

export interface AbilityGraphActionRequest {
  graph: AbilityGraph;
  level: number;
  actor: ArsenalActorState;
  targets: ArsenalActorState[];
  roller?: (notation: string, label?: string) => number;
  /** Retoma uma habilidade cuja preparação já terminou — não cobra custo nem cooldown de novo. */
  resumePreparation?: boolean;
  /** Habilidades-companhia de um combo: rodam em sequência sobre o mesmo estado, após o grafo base. */
  combos?: { graph: AbilityGraph; level: number }[];
  /** Bônus de defesa somado a todos os alvos no teste de acerto (proteção/reação). */
  defenseBonus?: number;
  /** Alvos extras disponíveis para seletores 'todos_*' (ex.: o atacante original, numa reação de 'ao_ser_alvejado'),
   * mas que não entram no escopo padrão dos efeitos (só via um nó 'alvo' explícito). */
  additionalTargets?: ArsenalActorState[];
  /** Marca esta resolução como uma reação (janela de "ao ser alvejado") — usado por ModifierFilter.contexts
   *  dos modificadores de valor (buff/debuff v2), ex.: "+3 em testes de reação". */
  isReaction?: boolean;
  /** Nós iniciais opcionais para executar apenas um ramo salvo do grafo (ex.: efeito contínuo reagindo ao ser alvejado). */
  entryNodeIds?: string[];
  /** Alvos resolvidos geometricamente pela Cena (linha/raio/cone/quadrado, via utils/abilityArea.ts) — usados
   *  pelo nó 'alvo' quando o escopo é uma forma de área; não entram no escopo padrão dos efeitos (só via o nó). */
  areaTargets?: ArsenalActorState[];
}

export interface AbilityGraphActionResult {
  status: 'bloqueada' | 'preparando' | 'concluida';
  reason?: string;
  actor: ArsenalActorState;
  targets: ArsenalActorState[];
  preparation?: PreparationConfig;
  rolls: Record<string, never>;
  hitTargetIds: string[];
  defeatedIds: string[];
  trace: TraceStep[];
  fieldEffects: never[];
  ongoingEffectIntents: OngoingEffectIntent[];
  /** Estado atualizado dos additionalTargets (ex.: o atacante, se um nó 'alvo' o incluiu no escopo e o afetou). */
  additionalTargets: ArsenalActorState[];
  movementIntents: MovementIntent[];
  summonIntents: SummonIntent[];
  transformIntents: TransformIntent[];
  /** Valor do nó 'esquiva', se presente — substitui o 1d20 fixo de resolveGraphProtection como defenseBonus externo. */
  defenseRollOverride?: number;
  /** Estado final dos areaTargets do request (ex.: dano aplicado pelo nó 'alvo' com escopo geométrico). */
  areaTargets: ArsenalActorState[];
  /** Pausa por escolha manual de alvo (nó 'alvo' com scope 'escolha') — a Cena deve pedir ao jogador que
   *  escolha um alvo e retomar via entryNodeIds = pendingTargetChoice.nodeIds. */
  pendingTargetChoice?: { nodeId: string; nodeIds: string[] };
}

function block(actor: ArsenalActorState, targets: ArsenalActorState[], reason: string): AbilityGraphActionResult {
  return { status: 'bloqueada', reason, actor, targets, rolls: {}, hitTargetIds: [], defeatedIds: [], trace: [], fieldEffects: [], ongoingEffectIntents: [], additionalTargets: [], movementIntents: [], summonIntents: [], transformIntents: [], areaTargets: [] };
}

/** Ids de todos os nós alcançáveis a partir da(s) raiz(es) principal(is) (trigger de família 'gatilho' que não
 * seja 'em_combo'/'enquanto_ativa') do grafo mesclado. Nós pendurados só numa raiz secundária (ex. um nó 'custo'
 * debaixo de 'em_combo') não contam para custo/cooldown/preparação da habilidade base — esse ramo só roda como
 * passe extra quando a habilidade é de fato usada em combo (ver resolveAbilityGraphAction), então contá-lo sempre
 * cobraria/aplicaria configuração que não se aplicou no uso solo. Se o grafo não tiver raiz principal alguma
 * (ex. um grafo de combo cujo único trigger é 'em_combo'), cai de volta para todas as raízes — senão nada seria
 * alcançável nesse grafo. Um nó solto sem trigger algum como ancestral não conta, mesmo sem arestas de entrada. */
export function reachableNodeIds(graph: AbilityGraph): Set<string> {
  const allTriggers = graph.nodes.filter(n => n.family === 'gatilho');
  const primaryTriggers = allTriggers.filter(n => n.type !== 'enquanto_ativa' && n.type !== 'em_combo');
  const roots = primaryTriggers.length ? primaryTriggers : allTriggers;
  const reachable = new Set<string>(roots.map(r => r.id));
  const queue = [...reachable];
  while (queue.length) {
    const id = queue.pop()!;
    for (const edge of graph.edges) {
      if (edge.from === id && !reachable.has(edge.to)) { reachable.add(edge.to); queue.push(edge.to); }
    }
  }
  return reachable;
}

export interface GraphCosts { aura: number; municao: number; vida: number }

/** Soma os nós 'custo' alcançáveis no grafo mesclado, agrupados por recurso. */
export function graphCosts(graph: AbilityGraph, level: number): GraphCosts {
  const merged = mergeLevel(graph, level);
  const reachable = reachableNodeIds(merged);
  const sum = (recurso: string) => merged.nodes
    .filter(n => reachable.has(n.id) && n.type === 'custo' && (n.props as { recurso?: string }).recurso === recurso)
    .reduce((total, n) => total + Number((n.props as { amount?: number }).amount ?? 0), 0);
  return { aura: sum('aura'), municao: sum('municao'), vida: sum('vida') };
}

export interface GraphComboConfig { stackKey: string; maxStacks: number }

/** Configuração de combo do grafo: presente se houver uma raiz secundária 'em_combo'. Não filtra por
 * `reachableNodeIds` — 'em_combo' é sempre uma raiz estrutural válida por si só (ver reachableNodeIds), mesmo
 * quando o grafo também tem um trigger principal. */
export function graphComboConfig(graph: AbilityGraph, level: number): GraphComboConfig | null {
  const merged = mergeLevel(graph, level);
  const node = merged.nodes.find(n => n.type === 'em_combo');
  if (!node) return null;
  const props = node.props as { stackKey?: string; maxStacks?: number };
  return { stackKey: props.stackKey ?? '', maxStacks: props.maxStacks ?? 2 };
}

/** Cooldown do grafo mesclado, lido do nó 'cooldown'. Ausente = sem cooldown. */
export function graphCooldown(graph: AbilityGraph, level: number): CooldownConfig {
  const merged = mergeLevel(graph, level);
  const reachable = reachableNodeIds(merged);
  const node = merged.nodes.find(n => reachable.has(n.id) && n.type === 'cooldown');
  if (!node) return { type: 'sem_cooldown' };
  const props = node.props as { tipo?: CooldownConfig['type']; amount?: number };
  const tipo = props.tipo ?? 'sem_cooldown';
  return tipo === 'sem_cooldown' ? { type: 'sem_cooldown' } : { type: tipo, amount: props.amount ?? 1 } as CooldownConfig;
}

/** Preparação do grafo mesclado, lida do nó 'preparacao'. Ausente = instantânea. */
export function graphPreparation(graph: AbilityGraph, level: number): PreparationConfig {
  const merged = mergeLevel(graph, level);
  const reachable = reachableNodeIds(merged);
  const node = merged.nodes.find(n => reachable.has(n.id) && n.type === 'preparacao');
  if (!node) return INSTANT_PREPARATION;
  const props = node.props as { tipo?: 'instantaneo' | 'turnos' | 'rodadas'; amount?: number };
  const tipo = props.tipo ?? 'instantaneo';
  const timing = tipo === 'instantaneo' ? { type: 'instantaneo' as const } : { type: tipo, amount: props.amount ?? 1 };
  return { timing, cancellable: true, interruptedByDamage: false, persistsAfterDamage: true, visibility: 'visivel' };
}

/** Acha o id do nó de trigger de um tipo específico no grafo mesclado, para uso como entryNodeIds. */
function findEntryNodeIds(graph: AbilityGraph, level: number, triggerType: string): string[] {
  const node = mergeLevel(graph, level).nodes.find(n => n.type === triggerType);
  return node ? [node.id] : [];
}

export type AbilityGraphCooldownEvent = 'inicio_turno' | 'inicio_rodada' | 'uso_manual';

/** Avança o cooldown das habilidades-grafo do elenco: um contador simples por turnos/rodadas/usos —
 *  sem os gatilhos/eventos de combate do sistema de arsenal, que não se aplicam a grafos.
 *  `catalog` deve ser o elenco já mesclado no nível de cada holding (ver `leveledAbilityGraphs`). */
export function advanceAbilityGraphCooldowns(
  holdings: readonly ArsenalHolding[],
  catalog: readonly AbilityGraph[],
  event: AbilityGraphCooldownEvent,
): ArsenalHolding[] {
  return holdings.map(holding => {
    if (!holding.cooldownRemaining) return { ...holding };
    // `catalog` já está mesclado no nível correto de cada holding — lê o nó direto, sem remesclar (evita reaplicar mergeLevel com o nível errado).
    const node = catalog.find(entry => entry.id === holding.cardId)?.nodes.find(n => n.type === 'cooldown');
    const tipo = (node?.props as { tipo?: 'sem_cooldown' | 'turnos' | 'rodadas' | 'usos' } | undefined)?.tipo ?? 'sem_cooldown';
    const decrement = (event === 'inicio_turno' && tipo === 'turnos')
      || (event === 'inicio_rodada' && tipo === 'rodadas')
      || (event === 'uso_manual' && tipo === 'usos');
    return decrement ? { ...holding, cooldownRemaining: Math.max(0, holding.cooldownRemaining - 1) } : { ...holding };
  });
}

export function resolveAbilityGraphAction(request: AbilityGraphActionRequest): AbilityGraphActionResult {
  const roller = request.roller ?? (notation => rollDice(notation).total);
  const header = mergeLevel(request.graph, request.level).header;
  const combos = request.combos ?? [];
  const actor: ArsenalActorState = { ...request.actor, holdings: request.actor.holdings.map(h => ({ ...h })) };
  const targets = request.targets.map(t => ({ ...t }));
  const additionalTargets = (request.additionalTargets ?? []).map(t => ({ ...t }));
  const areaTargets = (request.areaTargets ?? []).map(t => ({ ...t }));
  const holding = actor.holdings.find(h => h.cardId === request.graph.id);

  if (!request.resumePreparation) {
    if (holding?.cooldownRemaining && holding.cooldownRemaining > 0) return block(actor, targets, 'Habilidade em cooldown');
    if (header.charges && (holding?.currentCharges ?? header.charges.current) <= 0) return block(actor, targets, 'Habilidade sem cargas');
  }
  const baseCosts = [graphCosts(request.graph, request.level), ...combos.map(c => graphCosts(c.graph, c.level))]
    .reduce((total, c) => ({ aura: total.aura + c.aura, municao: total.municao + c.municao, vida: total.vida + c.vida }), { aura: 0, municao: 0, vida: 0 });
  const modifierCtx = {
    actor, cardId: request.graph.id, cardTags: header.tags, element: header.element,
    context: (request.isReaction ? 'reacao' : request.resumePreparation ? 'preparacao' : combos.length > 0 ? 'combo' : 'normal') as ModifierContext,
  };
  const costs = {
    ...baseCosts,
    aura: Math.max(0, resolveModifiedValue({ target: 'custo_aura', baseFlat: baseCosts.aura, holder: actor, ctx: modifierCtx, roller }).total),
    municao: Math.max(0, resolveModifiedValue({ target: 'custo_municao', baseFlat: baseCosts.municao, holder: actor, ctx: modifierCtx, roller }).total),
  };
  if (!request.resumePreparation) {
    if (costs.aura > actor.currentAura) return block(actor, targets, 'Aura insuficiente');
    if (costs.municao > actor.currentAmmo) return block(actor, targets, 'Munição insuficiente');
    if (costs.vida >= actor.currentHp) return block(actor, targets, 'Vida insuficiente');
    actor.currentAura -= costs.aura;
    actor.currentAmmo -= costs.municao;
    actor.currentHp -= costs.vida;
  }

  const preparation = graphPreparation(request.graph, request.level);
  if (!request.resumePreparation && preparation.timing.type !== 'instantaneo') {
    return {
      status: 'preparando', actor, targets, preparation,
      rolls: {}, hitTargetIds: [], defeatedIds: [], trace: [], fieldEffects: [], ongoingEffectIntents: [], additionalTargets, movementIntents: [], summonIntents: [], transformIntents: [], areaTargets: [],
    };
  }

  const defenseBonus = request.defenseBonus ?? 0;
  const passesFor = () => [{ graph: request.graph, level: request.level }, ...combos];

  let passActor = actor;
  const trace: TraceStep[] = [];
  const ongoingEffectIntents: OngoingEffectIntent[] = [];
  const movementIntents: MovementIntent[] = [];
  const summonIntents: SummonIntent[] = [];
  const transformIntents: TransformIntent[] = [];
  let defenseRollOverride: number | undefined;
  let pendingTargetChoice: { nodeId: string; nodeIds: string[] } | undefined;
  const isCombo = combos.length > 0;
  const hitTargetIds: string[] = [];
  const resultTargetById = new Map<string, ArsenalActorState>();
  let currentAdditionalTargets = additionalTargets;
  let currentAreaTargets = areaTargets;

  for (const originalTarget of targets) {
    let currentTarget = originalTarget;
    let hit = true;
    for (const pass of passesFor()) {
      const passResult = interpretAbility(pass.graph, pass.level, {
        actor: passActor, primaryTargets: [currentTarget], allTargets: [passActor, ...targets, ...currentAdditionalTargets], roller, defenseBonus,
        areaTargets: currentAreaTargets,
        context: request.isReaction ? 'reacao' : request.resumePreparation ? 'preparacao' : 'normal',
      }, request.entryNodeIds?.length ? { entryNodeIds: request.entryNodeIds } : undefined);
      hit = hit && (passResult.hitTest ?? true);
      passActor = passResult.actor;
      currentTarget = passResult.targets.find(rt => rt.id === currentTarget.id) ?? currentTarget;
      currentAdditionalTargets = currentAdditionalTargets.map(t => passResult.targets.find(rt => rt.id === t.id) ?? t);
      currentAreaTargets = currentAreaTargets.map(t => passResult.targets.find(rt => rt.id === t.id) ?? t);
      trace.push(...passResult.trace);
      ongoingEffectIntents.push(...passResult.ongoingEffectIntents);
      movementIntents.push(...passResult.movementIntents);
      summonIntents.push(...passResult.summonIntents);
      transformIntents.push(...passResult.transformIntents);
      if (passResult.defenseRollOverride !== undefined) defenseRollOverride = passResult.defenseRollOverride;
      if (passResult.pendingTargetChoice) pendingTargetChoice = passResult.pendingTargetChoice;

      if (isCombo) {
        const comboResult = interpretAbility(pass.graph, pass.level, {
          actor: passActor, primaryTargets: [currentTarget], allTargets: [passActor, ...targets, ...currentAdditionalTargets], roller, defenseBonus,
          areaTargets: currentAreaTargets,
          context: 'combo',
        }, { entryNodeIds: findEntryNodeIds(pass.graph, pass.level, 'em_combo') });
        passActor = comboResult.actor;
        currentTarget = comboResult.targets.find(rt => rt.id === currentTarget.id) ?? currentTarget;
        currentAdditionalTargets = currentAdditionalTargets.map(t => comboResult.targets.find(rt => rt.id === t.id) ?? t);
        currentAreaTargets = currentAreaTargets.map(t => comboResult.targets.find(rt => rt.id === t.id) ?? t);
        trace.push(...comboResult.trace);
        ongoingEffectIntents.push(...comboResult.ongoingEffectIntents);
        movementIntents.push(...comboResult.movementIntents);
        summonIntents.push(...comboResult.summonIntents);
        transformIntents.push(...comboResult.transformIntents);
      }
    }
    if (hit) hitTargetIds.push(originalTarget.id);
    resultTargetById.set(originalTarget.id, currentTarget);
  }
  additionalTargets.splice(0, additionalTargets.length, ...currentAdditionalTargets);
  areaTargets.splice(0, areaTargets.length, ...currentAreaTargets);

  if (holding && !request.resumePreparation) {
    const cooldown = graphCooldown(request.graph, request.level);
    if (cooldown.type !== 'sem_cooldown') {
      const baseAmount = cooldown.type === 'turnos' || cooldown.type === 'rodadas' || cooldown.type === 'usos' ? cooldown.amount : 1;
      holding.cooldownRemaining = Math.max(0, resolveModifiedValue({ target: 'cooldown', baseFlat: baseAmount, holder: passActor, ctx: { ...modifierCtx, actor: passActor }, roller }).total);
    }
    if (header.charges) holding.currentCharges = Math.max(0, (holding.currentCharges ?? header.charges.current) - 1);
  }

  const resultTargets = targets.map(t => resultTargetById.get(t.id)!);

  return {
    status: 'concluida',
    actor: { ...passActor, holdings: actor.holdings },
    targets: resultTargets,
    rolls: {},
    hitTargetIds,
    defeatedIds: resultTargets.filter(t => t.currentHp <= 0).map(t => t.id),
    trace,
    fieldEffects: [],
    ongoingEffectIntents,
    additionalTargets,
    movementIntents,
    summonIntents,
    transformIntents,
    defenseRollOverride,
    areaTargets,
    pendingTargetChoice,
  };
}

/** Roda a árvore 'enquanto_ativa' de um grafo sobre o dono do efeito contínuo (sem custo/cooldown/teste de acerto). */
export function runOngoingEffect(
  graph: AbilityGraph, level: number, owner: ArsenalActorState, roller: (notation: string) => number,
) {
  return interpretAbility(graph, level, { actor: owner, primaryTargets: [owner], allTargets: [owner], roller }, { entryNodeIds: findEntryNodeIds(graph, level, 'enquanto_ativa') });
}

export interface GraphFormaVisual {
  isForma: boolean;
  color?: string;
  iconOverride?: string;
  hpBonus: number;
  auraBonus: number;
}

/** Introspecciona o grafo mesclado no nível: é forma se tem cor_token/icone_token; bônus vem de nós buff com stat vida_maxima/aura_maxima. */
export function graphFormaVisual(graph: AbilityGraph, level: number): GraphFormaVisual {
  const merged = mergeLevel(graph, level);
  const reachable = reachableNodeIds(merged);
  const colorNode = merged.nodes.find(n => reachable.has(n.id) && n.type === 'cor_token');
  const iconNode = merged.nodes.find(n => reachable.has(n.id) && n.type === 'icone_token');
  const isForma = !!colorNode || !!iconNode;
  const hpBonus = merged.nodes
    .filter(n => reachable.has(n.id) && n.type === 'buff' && (n.props as { stat?: string }).stat === 'vida_maxima')
    .reduce((sum, n) => sum + Number((n.props as { value?: number }).value ?? 0), 0);
  const auraBonus = merged.nodes
    .filter(n => reachable.has(n.id) && n.type === 'buff' && (n.props as { stat?: string }).stat === 'aura_maxima')
    .reduce((sum, n) => sum + Number((n.props as { value?: number }).value ?? 0), 0);
  return {
    isForma,
    color: (colorNode?.props as { color?: string })?.color,
    iconOverride: (iconNode?.props as { icon?: string })?.icon,
    hpBonus, auraBonus,
  };
}

/** Equivalente de `availableCardIds` (arsenalState.ts) para o catálogo de habilidades-grafo: uma habilidade
 *  com `header.weaponLinks`/`header.formLinks` só fica disponível enquanto uma das armas/formas listadas
 *  estiver equipada/ativa — permite que uma forma-grafo "conceda" outras habilidades-grafo enquanto ativa,
 *  do mesmo jeito que `FormModule.grantedAbilityIds` faz para cartas clássicas. */
export function availableAbilityGraphIds(
  loadout: { holdings: readonly { cardId: string; quantity: number }[]; equippedWeaponIds: readonly string[]; activeFormIds: readonly string[] },
  catalog: readonly AbilityGraph[],
): string[] {
  const owned = new Set(loadout.holdings.filter(h => h.quantity > 0).map(h => h.cardId));
  for (const graph of catalog) {
    const hasLinks = (graph.header.weaponLinks?.length ?? 0) > 0 || (graph.header.formLinks?.length ?? 0) > 0;
    if (!hasLinks || !owned.has(graph.id)) continue;
    const unlocked = (graph.header.weaponLinks ?? []).some(id => loadout.equippedWeaponIds.includes(id))
      || (graph.header.formLinks ?? []).some(id => loadout.activeFormIds.includes(id));
    if (!unlocked) owned.delete(graph.id);
  }
  return [...owned];
}

/** Equivalente de `unlockedCardIds` (arsenalState.ts) para o catálogo de habilidades-grafo: casa os
 *  critérios de um nó 'liberar_cartas' (id explícito, tag ou elemento) contra `header.tags`/`header.element`. */
export function unlockedAbilityGraphIds(
  criteria: readonly { cardIds: string[]; tags: string[]; element: string | null; cardType: string | null }[],
  catalog: readonly AbilityGraph[],
): string[] {
  const ids = new Set<string>();
  for (const c of criteria) {
    for (const id of c.cardIds) ids.add(id);
    if (!c.tags.length && !c.element) continue;
    for (const graph of catalog) {
      const matchesTag = c.tags.length > 0 && c.tags.some(tag => (graph.header.tags as string[] | undefined)?.includes(tag));
      const matchesElement = !!c.element && graph.header.element === c.element;
      if (matchesTag || matchesElement) ids.add(graph.id);
    }
  }
  return [...ids];
}

export interface GraphFormAvailability {
  graph: AbilityGraph;
  ok: boolean;
  reason: string | null;
  isActive: boolean;
}

/** Formas-grafo (detectadas por cor_token/icone_token) possuídas pelo ator, com um dry-run de custo/cooldown. */
export function activatableGraphForms(
  actor: ArsenalActorState,
  catalog: readonly AbilityGraph[],
  loadout: { holdings: readonly { cardId: string; quantity: number }[]; activeFormIds: readonly string[] },
): GraphFormAvailability[] {
  const owned = new Set(loadout.holdings.filter(h => h.quantity > 0).map(h => h.cardId));
  const formas = catalog.filter(graph => owned.has(graph.id) && graphFormaVisual(graph, 1).isForma);
  return formas.map(graph => {
    const isActive = loadout.activeFormIds.includes(graph.id);
    if (isActive) return { graph, ok: false, reason: null, isActive };
    const dryRun = resolveAbilityGraphAction({ graph, level: 1, actor, targets: [actor] });
    const ok = dryRun.status !== 'bloqueada';
    return { graph, ok, reason: ok ? null : dryRun.reason ?? 'Indisponível', isActive };
  });
}
