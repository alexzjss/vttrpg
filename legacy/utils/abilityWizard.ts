import { createAbilityGraph, type AbilityGraph } from './abilityGraph';
import { addNode, updateNodeProps, setRootTrigger, addSecondaryTrigger } from './abilityGraphEdit';
import type { Element } from '../types';

export type WizardTargetScope = 'proprio' | 'alvo_da_habilidade' | 'todos_inimigos' | 'todos_aliados' | 'atacante_original';
export type WizardTiming = 'instantanea' | 'preparacao' | 'reacao';
export type WizardEffectKind = 'dano' | 'cura' | 'condicao' | 'buff';
export type WizardBuffStat = 'ataque' | 'defesa' | 'velocidade' | 'vida_maxima' | 'aura_maxima';

export interface WizardAnswers {
  name: string;
  targetScope: WizardTargetScope;
  hasTest: boolean;
  testDice: string;
  effectKinds: WizardEffectKind[];
  damageDice: string;
  damageFlat: number;
  element: Element | null;
  healDice: string;
  healFlat: number;
  conditionKind: string;
  conditionRounds: number;
  conditionValue: number;
  conditionChance: number;
  buffStat: WizardBuffStat;
  buffValue: number;
  hasCost: boolean;
  auraCost: number;
  hasDuration: boolean;
  durationRounds: number;
  timing: WizardTiming;
  comboEnabled: boolean;
}

export const WIZARD_DEFAULTS: WizardAnswers = {
  name: '',
  targetScope: 'alvo_da_habilidade',
  hasTest: true,
  testDice: '1d20',
  effectKinds: ['dano'],
  damageDice: '1d6',
  damageFlat: 0,
  element: 'fisico',
  healDice: '2d6',
  healFlat: 0,
  conditionKind: 'Queimando',
  conditionRounds: 2,
  conditionValue: 2,
  conditionChance: 100,
  buffStat: 'ataque',
  buffValue: 2,
  hasCost: false,
  auraCost: 1,
  hasDuration: false,
  durationRounds: 3,
  timing: 'instantanea',
  comboEnabled: false,
};

/** Monta o grafo automaticamente a partir das respostas do modo simples (perguntas guiadas). */
export function buildGraphFromWizard(answers: WizardAnswers): AbilityGraph {
  let graph = createAbilityGraph({
    id: `wizard-${crypto.randomUUID()}`,
    name: answers.name || 'Nova habilidade',
    element: answers.element,
  });
  const rootType = answers.timing === 'reacao' ? 'ao_ser_alvejado' : 'ao_ativar';
  graph = setRootTrigger(graph, rootType);
  let parentId = graph.nodes.find(n => n.family === 'gatilho')!.id;
  // Depois de um nó 'teste' (família 'ramo'), a próxima aresta precisa da marca 'entao' para o
  // restante da cadeia só rodar quando o teste for bem-sucedido; branches normais não usam marca.
  let pendingBranch: 'entao' | undefined;

  if (answers.hasCost && answers.auraCost > 0) {
    const r = addNode(graph, parentId, 'custo', pendingBranch);
    graph = updateNodeProps(r.graph, r.nodeId, { recurso: 'aura', amount: answers.auraCost });
    parentId = r.nodeId; pendingBranch = undefined;
  }

  if (answers.hasTest) {
    // Numa reação, ctx.scope[0] é o próprio defensor — comparar contra a própria defesa não faz
    // sentido, então usa 'valor_fixo' (0) para nunca bloquear a cadeia, preservando o comportamento
    // de "o teste sempre roda, mas não gateia nada sozinho" que a reação já tinha.
    const comparador = answers.timing === 'reacao' ? 'valor_fixo' : 'defesa_alvo';
    const r = addNode(graph, parentId, 'teste', pendingBranch);
    graph = updateNodeProps(r.graph, r.nodeId, { dice: answers.testDice, comparador, valorFixo: 0, modificador: 0 });
    parentId = r.nodeId; pendingBranch = 'entao';
  }

  if (answers.timing === 'preparacao') {
    const r = addNode(graph, parentId, 'preparacao', pendingBranch);
    graph = updateNodeProps(r.graph, r.nodeId, { tipo: 'rodadas', amount: 1 });
    parentId = r.nodeId; pendingBranch = undefined;
  }

  if (answers.targetScope !== 'alvo_da_habilidade') {
    const r = addNode(graph, parentId, 'alvo', pendingBranch);
    graph = updateNodeProps(r.graph, r.nodeId, { scope: answers.targetScope });
    parentId = r.nodeId; pendingBranch = undefined;
  }

  if (answers.effectKinds.includes('dano')) {
    const r = addNode(graph, parentId, 'dano', pendingBranch);
    graph = updateNodeProps(r.graph, r.nodeId, { dice: answers.damageDice || undefined, flat: answers.damageFlat, element: answers.element ?? 'fisico' });
    parentId = r.nodeId; pendingBranch = undefined;
  }
  if (answers.effectKinds.includes('cura')) {
    const r = addNode(graph, parentId, 'cura', pendingBranch);
    graph = updateNodeProps(r.graph, r.nodeId, { dice: answers.healDice || undefined, flat: answers.healFlat });
    parentId = r.nodeId; pendingBranch = undefined;
  }
  if (answers.effectKinds.includes('condicao')) {
    const r = addNode(graph, parentId, 'aplicar_condicao', pendingBranch);
    graph = updateNodeProps(r.graph, r.nodeId, {
      conditionName: answers.conditionKind, rounds: answers.conditionRounds,
      chance: answers.conditionChance,
    });
    parentId = r.nodeId; pendingBranch = undefined;
  }
  if (answers.effectKinds.includes('buff')) {
    const r = addNode(graph, parentId, 'buff', pendingBranch);
    graph = updateNodeProps(r.graph, r.nodeId, {
      stat: answers.buffStat, operation: 'somar', value: answers.buffValue,
      rounds: answers.hasDuration ? answers.durationRounds : 1,
    });
    parentId = r.nodeId; pendingBranch = undefined;
  }

  if (answers.comboEnabled) graph = addSecondaryTrigger(graph, 'em_combo');

  return graph;
}
