import { createAbilityGraph, type AbilityGraph, type GraphEdge, type GraphNode } from './abilityGraph';
import type { Element } from '../types';

export interface AbilityTemplateOptions {
  name?: string;
  testDice?: string | null;
  damageDice?: string | null;
  damageFlat?: number;
  auraCost?: number;
  conditionKind?: string;
  conditionRounds?: number;
  conditionValue?: number;
  conditionChance?: number;
  formBuffStat?: 'ataque' | 'defesa' | 'velocidade' | 'vida_maxima' | 'aura_maxima';
  formBuffValue?: number;
  formRounds?: number;
  formColor?: string;
  element?: Element | null;
  healDice?: string | null;
  healFlat?: number;
  statePercent?: number;
  stateDamageDice?: string | null;
}

export interface AbilityTemplateField {
  key: keyof AbilityTemplateOptions;
  label: string;
  kind: 'text' | 'dice' | 'number' | 'condition' | 'element' | 'buffStat' | 'color';
}

export interface AbilityTemplate {
  id: string;
  label: string;
  description: string;
  defaults: AbilityTemplateOptions;
  fields: AbilityTemplateField[];
  build: (options?: AbilityTemplateOptions) => AbilityGraph;
}

const attackFields: AbilityTemplateField[] = [
  { key: 'testDice', label: 'Rolagem inicial', kind: 'dice' },
  { key: 'damageDice', label: 'Dano em dados', kind: 'dice' },
  { key: 'damageFlat', label: 'Dano fixo', kind: 'number' },
  { key: 'element', label: 'Elemento', kind: 'element' },
];
const costField: AbilityTemplateField = { key: 'auraCost', label: 'Custo de aura', kind: 'number' };
const conditionFields: AbilityTemplateField[] = [
  { key: 'conditionKind', label: 'Condicao', kind: 'condition' },
  { key: 'conditionRounds', label: 'Duracao', kind: 'number' },
  { key: 'conditionValue', label: 'Valor', kind: 'number' },
  { key: 'conditionChance', label: 'Chance (%)', kind: 'number' },
];
const curaFields: AbilityTemplateField[] = [
  { key: 'healDice', label: 'Cura em dados', kind: 'dice' },
  { key: 'healFlat', label: 'Cura fixa', kind: 'number' },
];
const buffFields: AbilityTemplateField[] = [
  { key: 'formBuffStat', label: 'Atributo', kind: 'buffStat' },
  { key: 'formBuffValue', label: 'Valor', kind: 'number' },
  { key: 'formRounds', label: 'Duracao', kind: 'number' },
];

function n(id: string, type: string, family: GraphNode['family'], props: Record<string, unknown>): GraphNode {
  return { id, type, family, props };
}

function e(id: string, from: string, to: string): GraphEdge {
  return { id, from, to };
}

function chain(nodes: GraphNode[]): GraphEdge[] {
  return nodes.slice(1).map((node, index) => e(`e${index + 1}`, nodes[index].id, node.id));
}

/** Como chain(), mas a aresta que sai do nó em `gateIndex` (um nó 'teste'/'ramo') leva a marca `branch: 'entao'`,
 * fazendo o restante da cadeia só rodar quando o teste for bem-sucedido. */
function chainWithGate(nodes: GraphNode[], gateIndex: number): GraphEdge[] {
  return nodes.slice(1).map((node, index) => {
    const branch = index === gateIndex ? 'entao' as const : undefined;
    return { id: `e${index + 1}`, from: nodes[index].id, to: node.id, ...(branch ? { branch } : {}) };
  });
}

function testeNode(dice: string | null | undefined, comparador: 'defesa_alvo' | 'valor_fixo' = 'defesa_alvo'): GraphNode | null {
  return dice ? n('teste', 'teste', 'ramo', { dice, comparador, valorFixo: 0, modificador: 0 }) : null;
}

function opts(defaults: AbilityTemplateOptions, options?: AbilityTemplateOptions): Required<Pick<AbilityTemplateOptions, 'damageFlat' | 'auraCost' | 'conditionRounds' | 'conditionValue' | 'conditionChance' | 'formBuffValue' | 'formRounds'>> & AbilityTemplateOptions {
  return {
    damageFlat: 0,
    auraCost: 0,
    conditionRounds: 2,
    conditionValue: 2,
    conditionChance: 100,
    formBuffValue: 2,
    formRounds: 3,
    ...defaults,
    ...options,
  };
}

function graphBase(id: string, name: string, o: AbilityTemplateOptions): AbilityGraph {
  return createAbilityGraph({
    id: `template-${id}`,
    name,
    element: o.element ?? null,
  });
}

function buildAttack(id: string, label: string, options?: AbilityTemplateOptions): AbilityGraph {
  const o = opts({ testDice: '1d20', damageDice: '1d6', damageFlat: 0, element: 'fisico' }, options);
  const teste = testeNode(o.testDice);
  const nodes = [
    n('g', 'ao_ativar', 'gatilho', {}),
    ...(o.auraCost > 0 ? [n('custo', 'custo', 'efeito', { recurso: 'aura', amount: o.auraCost })] : []),
    ...(teste ? [teste] : []),
    n('dano', 'dano', 'efeito', { dice: o.damageDice ?? undefined, flat: o.damageFlat, element: o.element ?? 'fisico' }),
    ...(o.conditionKind ? [n('condicao', 'aplicar_condicao', 'efeito', { conditionName: o.conditionKind, rounds: o.conditionRounds, chance: o.conditionChance })] : []),
  ];
  const gateIndex = teste ? nodes.findIndex(node => node.id === 'teste') : -1;
  return { ...graphBase(id, o.name || label, o), nodes, edges: gateIndex >= 0 ? chainWithGate(nodes, gateIndex) : chain(nodes) };
}

function buildReaction(id: string, label: string, options?: AbilityTemplateOptions): AbilityGraph {
  const o = opts({ testDice: '1d20', damageDice: null, damageFlat: 0, element: 'fisico' }, options);
  const hasRetaliation = !!(o.damageDice || o.damageFlat);
  // 'valor_fixo' com limiar 0: preserva o comportamento antigo do 'teste_defesa' (nunca bloqueia a
  // retaliação) — o dado ainda roda e fica disponível no trace/hitTest, só não gateia nada aqui.
  // Só existe quando há retaliação: sem nada para gatear, o nó de teste ficaria sem caminho de
  // sucesso (o bônus externo de proteção, hoje, é resolvido fora do grafo pela Cena com 1d20 fixo).
  const teste = hasRetaliation ? testeNode(o.testDice, 'valor_fixo') : null;
  // Reação pura (sem custo, sem retaliação) não teria nenhum nó de família 'efeito' — validateAbilityGraph
  // acusaria "não produz nenhum efeito". Um marcador de cooldown explícito ('sem_cooldown', o próprio
  // padrão) dá à árvore um nó de efeito real e documenta a configuração, sem mudar nenhum comportamento.
  const needsNoopEffect = o.auraCost <= 0 && !hasRetaliation;
  const nodes = [
    n('g', 'ao_ser_alvejado', 'gatilho', {}),
    ...(o.auraCost > 0 ? [n('custo', 'custo', 'efeito', { recurso: 'aura', amount: o.auraCost })] : []),
    ...(needsNoopEffect ? [n('cooldown', 'cooldown', 'efeito', { tipo: 'sem_cooldown', amount: 1 })] : []),
    ...(teste ? [teste] : []),
    ...(hasRetaliation ? [
      n('atacante', 'alvo', 'alvo', { scope: 'atacante_original' }),
      n('retaliacao', 'dano', 'efeito', { dice: o.damageDice ?? undefined, flat: o.damageFlat, element: o.element ?? 'fisico' }),
    ] : []),
  ];
  const gateIndex = teste ? nodes.findIndex(node => node.id === 'teste') : -1;
  return { ...graphBase(id, o.name || label, o), nodes, edges: gateIndex >= 0 ? chainWithGate(nodes, gateIndex) : chain(nodes) };
}

function buildForm(id: string, label: string, defaultStat: AbilityTemplateOptions['formBuffStat'], options?: AbilityTemplateOptions): AbilityGraph {
  const o = opts({ testDice: null, auraCost: 3, formBuffStat: defaultStat, formBuffValue: 10, formRounds: 3, formColor: '#f59e0b' }, options);
  const nodes = [
    n('g', 'ao_ativar', 'gatilho', {}),
    n('custo', 'custo', 'efeito', { recurso: 'aura', amount: o.auraCost }),
    n('alvo', 'alvo', 'alvo', { scope: 'proprio' }),
    n('efeito', 'aplicar_como_efeito', 'efeito', { alvo: 'proprio', rounds: o.formRounds }),
    n('buff', 'buff', 'efeito', { stat: o.formBuffStat, operation: 'somar', value: o.formBuffValue, rounds: o.formRounds }),
    n('cor', 'cor_token', 'efeito', { color: o.formColor || '#f59e0b' }),
  ];
  return { ...graphBase(id, o.name || label, o), nodes, edges: chain(nodes) };
}

function buildCura(id: string, label: string, options?: AbilityTemplateOptions): AbilityGraph {
  const o = opts({ testDice: null, healDice: '2d6', healFlat: 0 }, options);
  const nodes = [
    n('g', 'ao_ativar', 'gatilho', {}),
    ...(o.auraCost > 0 ? [n('custo', 'custo', 'efeito', { recurso: 'aura', amount: o.auraCost })] : []),
    n('cura', 'cura', 'efeito', { dice: o.healDice ?? undefined, flat: o.healFlat }),
  ];
  return { ...graphBase(id, o.name || label, o), nodes, edges: chain(nodes) };
}

function buildBuffDebuff(id: string, label: string, sign: 1 | -1, options?: AbilityTemplateOptions): AbilityGraph {
  const o = opts({
    testDice: null, auraCost: 0,
    formBuffStat: sign > 0 ? 'ataque' : 'defesa',
    formBuffValue: sign * 2, formRounds: 3,
  }, options);
  const nodes = [
    n('g', 'ao_ativar', 'gatilho', {}),
    ...(o.auraCost > 0 ? [n('custo', 'custo', 'efeito', { recurso: 'aura', amount: o.auraCost })] : []),
    n('alvo', 'alvo', 'alvo', { scope: sign > 0 ? 'proprio' : 'alvo_da_habilidade' }),
    n('buff', 'buff', 'efeito', { stat: o.formBuffStat, operation: 'somar', value: o.formBuffValue, rounds: o.formRounds }),
  ];
  return { ...graphBase(id, o.name || label, o), nodes, edges: chain(nodes) };
}

function buildEstadoAlvo(options?: AbilityTemplateOptions): AbilityGraph {
  const o = opts({
    testDice: '1d20', damageDice: '1d6', damageFlat: 0, element: 'fisico',
    statePercent: 30, stateDamageDice: '2d6',
  }, options);
  const teste = testeNode(o.testDice);
  const nodes = [
    n('g', 'ao_ativar', 'gatilho', {}),
    ...(teste ? [teste] : []),
    n('ramo', 'se_vida_alvo', 'ramo', { comparacao: 'abaixo', percent: o.statePercent }),
    n('dano_baixo', 'dano', 'efeito', { dice: o.stateDamageDice ?? undefined, flat: o.damageFlat, element: o.element ?? 'fisico' }),
    n('dano_normal', 'dano', 'efeito', { dice: o.damageDice ?? undefined, flat: o.damageFlat, element: o.element ?? 'fisico' }),
  ];
  const edges: GraphEdge[] = teste
    ? [e('e0', 'g', 'teste'), { id: 'e1', from: 'teste', to: 'ramo', branch: 'entao' }]
    : [e('e1', 'g', 'ramo')];
  edges.push(
    { id: 'e2', from: 'ramo', to: 'dano_baixo', branch: 'entao' },
    { id: 'e3', from: 'ramo', to: 'dano_normal', branch: 'senao' },
  );
  return { ...graphBase('estado-alvo', o.name || 'Golpe de misericordia', o), nodes, edges };
}

function buildAreaBurst(options?: AbilityTemplateOptions): AbilityGraph {
  const o = opts({ testDice: '1d20', auraCost: 3, damageDice: '2d6', damageFlat: 0, element: 'fogo' }, options);
  const base = graphBase('area-burst', o.name || 'Explosao em area', o);
  const teste = testeNode(o.testDice);
  const nodes = [
    n('g', 'ao_ativar', 'gatilho', {}),
    ...(o.auraCost > 0 ? [n('custo', 'custo', 'efeito', { recurso: 'aura', amount: o.auraCost })] : []),
    n('area', 'alvo', 'alvo', { scope: 'todos_inimigos' }),
    ...(teste ? [teste] : []),
    n('dano', 'dano', 'efeito', { dice: o.damageDice ?? undefined, flat: o.damageFlat, element: o.element ?? 'fogo' }),
  ];
  const gateIndex = teste ? nodes.findIndex(node => node.id === 'teste') : -1;
  return {
    ...base,
    header: {
      ...base.header,
      target: { type: 'todos_inimigos' },
      area: { shape: 'circulo', size: 3, unit: 'celulas' },
      tags: ['area', 'jrpg'],
    },
    nodes,
    edges: gateIndex >= 0 ? chainWithGate(nodes, gateIndex) : chain(nodes),
  };
}

function buildChargedStrike(options?: AbilityTemplateOptions): AbilityGraph {
  const o = opts({ testDice: '1d20', auraCost: 2, damageDice: '3d6', damageFlat: 0, element: 'fisico', formRounds: 1 }, options);
  const base = graphBase('charged-strike', o.name || 'Golpe carregado', o);
  const teste = testeNode(o.testDice);
  const nodes = [
    n('g', 'ao_ativar', 'gatilho', {}),
    ...(o.auraCost > 0 ? [n('custo', 'custo', 'efeito', { recurso: 'aura', amount: o.auraCost })] : []),
    n('prep', 'preparacao', 'efeito', { tipo: 'rodadas', amount: o.formRounds }),
    ...(teste ? [teste] : []),
    n('dano', 'dano', 'efeito', { dice: o.damageDice ?? undefined, flat: o.damageFlat, element: o.element ?? 'fisico' }),
    n('cd', 'cooldown', 'efeito', { tipo: 'rodadas', amount: 2 }),
  ];
  const gateIndex = teste ? nodes.findIndex(node => node.id === 'teste') : -1;
  return {
    ...base,
    header: { ...base.header, tags: ['preparacao', 'jrpg'] },
    nodes,
    edges: gateIndex >= 0 ? chainWithGate(nodes, gateIndex) : chain(nodes),
  };
}

function buildComboElemental(options?: AbilityTemplateOptions): AbilityGraph {
  const o = opts({
    testDice: '1d20', auraCost: 2, damageDice: '1d8', damageFlat: 0, element: 'raio',
    conditionKind: 'Molhado', stateDamageDice: '3d6',
  }, options);
  const base = graphBase('combo-elemental', o.name || 'Combo elemental', o);
  const teste = testeNode(o.testDice);
  const nodes = [
    n('g', 'ao_ativar', 'gatilho', {}),
    ...(o.auraCost > 0 ? [n('custo', 'custo', 'efeito', { recurso: 'aura', amount: o.auraCost })] : []),
    ...(teste ? [teste] : []),
    n('ramo', 'se_condicao_ativa', 'ramo', { conditionName: o.conditionKind ?? 'Molhado' }),
    n('dano_combo', 'dano', 'efeito', { dice: o.stateDamageDice ?? undefined, flat: o.damageFlat, element: o.element ?? 'raio' }),
    n('dano_normal', 'dano', 'efeito', { dice: o.damageDice ?? undefined, flat: o.damageFlat, element: o.element ?? 'raio' }),
    n('combo', 'em_combo', 'gatilho', { stackKey: `${o.element ?? 'raio'}-${o.conditionKind ?? 'Molhado'}`, maxStacks: 2 }),
  ];
  const firstEffect = o.auraCost > 0 ? 'custo' : teste ? 'teste' : 'ramo';
  const edges: GraphEdge[] = [e('e0', 'g', firstEffect)];
  if (o.auraCost > 0 && teste) edges.push(e('e1', 'custo', 'teste'));
  if (o.auraCost > 0 && !teste) edges.push(e('e1', 'custo', 'ramo'));
  if (teste) edges.push({ id: 'e2', from: 'teste', to: 'ramo', branch: 'entao' });
  edges.push(
    { id: 'e3', from: 'ramo', to: 'dano_combo', branch: 'entao' },
    { id: 'e4', from: 'ramo', to: 'dano_normal', branch: 'senao' },
    { id: 'e5', from: 'g', to: 'combo' },
  );
  return {
    ...base,
    header: { ...base.header, tags: ['combo', 'elemental', 'jrpg'] },
    nodes,
    edges,
  };
}

function buildBossPhase(options?: AbilityTemplateOptions): AbilityGraph {
  const o = opts({ auraCost: 0, formBuffStat: 'ataque', formBuffValue: 4, formRounds: 999, formColor: '#dc2626', statePercent: 50 }, options);
  const base = graphBase('boss-phase', o.name || 'Fase 2 do chefe', o);
  const nodes = [
    n('g', 'ao_ativar', 'gatilho', {}),
    n('alvo', 'alvo', 'alvo', { scope: 'proprio' }),
    n('limiar', 'se_vida_alvo', 'ramo', { comparacao: 'abaixo', percent: o.statePercent }),
    n('efeito', 'aplicar_como_efeito', 'efeito', { alvo: 'proprio', rounds: o.formRounds }),
    n('buff', 'buff', 'efeito', { stat: o.formBuffStat, operation: 'somar', value: o.formBuffValue, rounds: o.formRounds }),
    n('cor', 'cor_token', 'efeito', { color: o.formColor || '#dc2626' }),
  ];
  return {
    ...base,
    header: { ...base.header, tags: ['chefe', 'fase', 'forma'] },
    nodes,
    edges: [
      e('e1', 'g', 'alvo'),
      e('e2', 'alvo', 'limiar'),
      { id: 'e3', from: 'limiar', to: 'efeito', branch: 'entao' },
      e('e4', 'efeito', 'buff'),
      e('e5', 'buff', 'cor'),
    ],
  };
}

const TEMPLATES: AbilityTemplate[] = [
  { id: 'ataque', label: 'Ataque', description: 'Ataque simples com rolagem e dano.', defaults: { testDice: '1d20', damageDice: '1d6', damageFlat: 0, element: 'fisico' }, fields: attackFields, build: o => buildAttack('ataque', 'Ataque', o) },
  { id: 'ataque_aura', label: 'Ataque com custo de aura', description: 'Ataque que consome aura antes do dano.', defaults: { testDice: '1d20', auraCost: 1, damageDice: '1d8', damageFlat: 0, element: 'fisico' }, fields: [...attackFields, costField], build: o => buildAttack('ataque-aura', 'Ataque com aura', o) },
  { id: 'ataque_aura_condicao', label: 'Ataque com aura e condicao', description: 'Ataque com custo de aura e condicao no alvo.', defaults: { testDice: '1d20', auraCost: 2, damageDice: '1d6', damageFlat: 0, element: 'fogo', conditionKind: 'Queimando', conditionRounds: 2, conditionValue: 2, conditionChance: 100 }, fields: [...attackFields, costField, ...conditionFields], build: o => buildAttack('ataque-aura-condicao', 'Ataque com condicao', o) },
  { id: 'reacao', label: 'Reacao', description: 'Reacao defensiva com teste.', defaults: { testDice: '1d20', damageDice: null, damageFlat: 0 }, fields: [{ key: 'testDice', label: 'Rolagem de reacao', kind: 'dice' }], build: o => buildReaction('reacao', 'Reacao', o) },
  { id: 'reacao_aura', label: 'Reacao com custo de aura', description: 'Reacao defensiva que consome aura.', defaults: { testDice: '1d20', auraCost: 1, damageDice: null, damageFlat: 0 }, fields: [{ key: 'testDice', label: 'Rolagem de reacao', kind: 'dice' }, costField], build: o => buildReaction('reacao-aura', 'Reacao com aura', o) },
  { id: 'reacao_aura_dano', label: 'Reacao com aura e contra-ataque', description: 'Reage ao ser atacado e causa dano no agressor.', defaults: { testDice: '1d20', auraCost: 2, damageDice: '1d6', damageFlat: 0, element: 'fisico' }, fields: [{ key: 'testDice', label: 'Rolagem de reacao', kind: 'dice' }, costField, { key: 'damageDice', label: 'Dano em dados', kind: 'dice' }, { key: 'damageFlat', label: 'Dano fixo', kind: 'number' }, { key: 'element', label: 'Elemento', kind: 'element' }], build: o => buildReaction('reacao-aura-dano', 'Contra-ataque', o) },
  { id: 'cura', label: 'Cura', description: 'Cura simples, sem custo.', defaults: { healDice: '2d6', healFlat: 0 }, fields: curaFields, build: o => buildCura('cura', 'Cura', o) },
  { id: 'cura_aura', label: 'Cura com custo de aura', description: 'Cura que consome aura do usuario.', defaults: { auraCost: 2, healDice: '2d6', healFlat: 0 }, fields: [...curaFields, costField], build: o => buildCura('cura-aura', 'Cura com aura', o) },
  { id: 'buff', label: 'Buff temporario', description: 'Aumenta um atributo proprio por algumas rodadas.', defaults: { formBuffStat: 'ataque', formBuffValue: 2, formRounds: 3 }, fields: [...buffFields, costField], build: o => buildBuffDebuff('buff', 'Buff', 1, o) },
  { id: 'debuff', label: 'Debuff temporario', description: 'Reduz um atributo do alvo por algumas rodadas.', defaults: { formBuffStat: 'defesa', formBuffValue: -2, formRounds: 3 }, fields: [...buffFields, costField], build: o => buildBuffDebuff('debuff', 'Debuff', -1, o) },
  { id: 'forma_ofensiva', label: 'Forma ofensiva', description: 'Forma que aumenta ataque enquanto ativa.', defaults: { auraCost: 3, formBuffStat: 'ataque', formBuffValue: 4, formRounds: 3, formColor: '#ef4444' }, fields: [costField, ...buffFields, { key: 'formColor', label: 'Cor da forma', kind: 'color' }], build: o => buildForm('forma-ofensiva', 'Forma ofensiva', 'ataque', o) },
  { id: 'forma_defensiva', label: 'Forma defensiva', description: 'Forma que aumenta defesa enquanto ativa.', defaults: { auraCost: 3, formBuffStat: 'defesa', formBuffValue: 4, formRounds: 3, formColor: '#3b82f6' }, fields: [costField, ...buffFields, { key: 'formColor', label: 'Cor da forma', kind: 'color' }], build: o => buildForm('forma-defensiva', 'Forma defensiva', 'defesa', o) },
  { id: 'forma_tecnica', label: 'Forma tecnica', description: 'Forma que aumenta velocidade enquanto ativa.', defaults: { auraCost: 3, formBuffStat: 'velocidade', formBuffValue: 4, formRounds: 3, formColor: '#a855f7' }, fields: [costField, ...buffFields, { key: 'formColor', label: 'Cor da forma', kind: 'color' }], build: o => buildForm('forma-tecnica', 'Forma tecnica', 'velocidade', o) },
  { id: 'forma_especial', label: 'Forma com efeito especial', description: 'Forma com custo de aura, duracao e buff visual configuravel.', defaults: { testDice: null, auraCost: 3, formBuffStat: 'vida_maxima', formBuffValue: 10, formRounds: 3, formColor: '#f59e0b' }, fields: [costField, { key: 'formRounds', label: 'Duracao', kind: 'number' }, { key: 'formBuffStat', label: 'Efeito especial', kind: 'buffStat' }, { key: 'formBuffValue', label: 'Valor do efeito', kind: 'number' }, { key: 'formColor', label: 'Cor da forma', kind: 'color' }], build: o => buildForm('forma', 'Forma', 'vida_maxima', o) },
  { id: 'estado_alvo', label: 'Habilidade por estado do alvo', description: 'Causa mais dano se o alvo estiver com vida baixa.', defaults: { testDice: '1d20', element: 'fisico', damageDice: '1d6', damageFlat: 0, statePercent: 30, stateDamageDice: '2d6' }, fields: [...attackFields, { key: 'statePercent', label: 'Vida do alvo abaixo de (%)', kind: 'number' }, { key: 'stateDamageDice', label: 'Dano se abaixo do limite', kind: 'dice' }], build: buildEstadoAlvo },
  { id: 'area_burst', label: 'Explosao em area', description: 'Atinge todos os inimigos: ideal para magias e especiais de JRPG.', defaults: { testDice: '1d20', auraCost: 3, damageDice: '2d6', damageFlat: 0, element: 'fogo' }, fields: [...attackFields, costField], build: buildAreaBurst },
  { id: 'golpe_carregado', label: 'Golpe carregado', description: 'Telegrapha uma preparacao antes de soltar dano alto e cooldown.', defaults: { testDice: '1d20', auraCost: 2, damageDice: '3d6', damageFlat: 0, element: 'fisico', formRounds: 1 }, fields: [...attackFields, costField, { key: 'formRounds', label: 'Rodadas carregando', kind: 'number' }], build: buildChargedStrike },
  { id: 'combo_elemental', label: 'Combo elemental', description: 'Dano maior se o alvo ja estiver com a condicao certa.', defaults: { testDice: '1d20', auraCost: 2, damageDice: '1d8', damageFlat: 0, element: 'raio', conditionKind: 'Molhado', stateDamageDice: '3d6' }, fields: [...attackFields, costField, { key: 'conditionKind', label: 'Condicao exigida', kind: 'condition' }, { key: 'stateDamageDice', label: 'Dano no combo', kind: 'dice' }], build: buildComboElemental },
  { id: 'fase_chefe', label: 'Fase de chefe', description: 'Transformacao quando a vida cai abaixo de um limiar.', defaults: { formBuffStat: 'ataque', formBuffValue: 4, formRounds: 999, formColor: '#dc2626', statePercent: 50 }, fields: [{ key: 'statePercent', label: 'Vida abaixo de (%)', kind: 'number' }, ...buffFields, { key: 'formColor', label: 'Cor da fase', kind: 'color' }], build: buildBossPhase },
];

export function listAbilityTemplates(): AbilityTemplate[] {
  return TEMPLATES;
}
