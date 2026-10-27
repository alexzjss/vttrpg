import type { ArsenalEffect, ConditionIntensity, ConditionKind, ConditionParams } from './arsenal';

/** Valores padrão de cada condição na intensidade "normal". `durationRounds` e os campos
 *  específicos são o ponto de partida — tudo é sobrescrevível por carta via `overrides`. */
const NORMAL_DEFAULTS: Record<ConditionKind, ConditionParams> = {
  vulneravel: { kind: 'vulneravel', durationRounds: 2, element: 'fogo', extraDamagePercent: 25 },
  exposto: { kind: 'exposto', durationRounds: 2, attackBonusAgainstTarget: 2, defensePierceAgainstTarget: 0 },
  marcado: { kind: 'marcado', durationRounds: 2, sourceOnly: true, attackBonusFromSource: 3, damageBonusFromSource: 0 },
  sangrando: { kind: 'sangrando', durationRounds: 2, damagePerRound: 2, ignoresDefense: false },
  queimando: { kind: 'queimando', durationRounds: 2, damagePerRound: 2, removedByWater: true },
  congelado: { kind: 'congelado', durationRounds: 2, movementPenalty: 50, disablesReaction: true },
  eletrizado: { kind: 'eletrizado', durationRounds: 2, extraLightningDamage: 4, reactionPenalty: 2 },
  molhado: { kind: 'molhado', durationRounds: 2, extraLightningDamagePercent: 50, fireDamageReductionPercent: 50, removesBurning: true },
  enraizado: { kind: 'enraizado', durationRounds: 2, movementPenalty: 50, immuneToPush: true, immuneToPull: true },
  fragil: { kind: 'fragil', durationRounds: 2, defenseReduction: 2 },
  silenciado: { kind: 'silenciado', durationRounds: 2, blocksAuraCards: true, blocksForms: true, allowsReactions: true },
  atordoado: { kind: 'atordoado', durationRounds: 1, losesAction: true, losesReaction: true },
  derrubado: { kind: 'derrubado', durationRounds: 1, defensePenalty: 2, movementCostToStand: 1, meleeAttackBonusAgainstTarget: 2 },
  cego: { kind: 'cego', durationRounds: 2, attackPenalty: 4, reactionPenalty: 2 },
  amedrontado: { kind: 'amedrontado', durationRounds: 2, cannotApproachSource: false, attackPenaltyAgainstSource: 3 },
};

const CONDITION_NAMES: Record<ConditionKind, string> = {
  vulneravel: 'Vulnerável', exposto: 'Exposto', marcado: 'Marcado', sangrando: 'Sangrando',
  queimando: 'Queimando', congelado: 'Congelado', eletrizado: 'Eletrizado', molhado: 'Molhado',
  enraizado: 'Enraizado', fragil: 'Frágil', silenciado: 'Silenciado', atordoado: 'Atordoado',
  derrubado: 'Derrubado', cego: 'Cego', amedrontado: 'Amedrontado',
};

const CONDITION_TAGS: Record<ConditionKind, string[]> = {
  vulneravel: ['debuff', 'elemental'], exposto: ['debuff', 'controle'], marcado: ['debuff', 'controle'],
  sangrando: ['sangue', 'dano-periodico'], queimando: ['fogo', 'dano-periodico'], congelado: ['gelo', 'controle'],
  eletrizado: ['raio', 'controle'], molhado: ['água', 'interacao'], enraizado: ['terra', 'controle'],
  fragil: ['fisico', 'debuff'], silenciado: ['controle', 'debuff'], atordoado: ['controle', 'debuff'],
  derrubado: ['controle', 'debuff'], cego: ['controle', 'debuff'], amedrontado: ['controle', 'debuff'],
};

export interface ConditionFieldSchema {
  key: string;
  label: string;
  kind: 'numero' | 'toggle' | 'elemento' | 'texto';
}

/** Campos específicos de cada condição, na ordem em que devem aparecer no editor.
 *  Única fonte de verdade para a UI (NodeInspector) e para o nó "aplicar_condicao" extrair overrides. */
export const CONDITION_FIELD_SCHEMAS: Record<ConditionKind, ConditionFieldSchema[]> = {
  vulneravel: [
    { key: 'element', label: 'Elemento', kind: 'elemento' },
    { key: 'extraDamagePercent', label: 'Dano extra (%)', kind: 'numero' },
  ],
  exposto: [
    { key: 'attackBonusAgainstTarget', label: 'Bônus de ataque contra o alvo', kind: 'numero' },
    { key: 'defensePierceAgainstTarget', label: 'Ignora defesa do alvo', kind: 'numero' },
  ],
  marcado: [
    { key: 'sourceOnly', label: 'Só quem aplicou a marca', kind: 'toggle' },
    { key: 'attackBonusFromSource', label: 'Bônus de ataque da origem', kind: 'numero' },
    { key: 'damageBonusFromSource', label: 'Bônus de dano da origem', kind: 'numero' },
  ],
  sangrando: [
    { key: 'damagePerRound', label: 'Dano por rodada', kind: 'numero' },
    { key: 'ignoresDefense', label: 'Ignora defesa', kind: 'toggle' },
  ],
  queimando: [
    { key: 'damagePerRound', label: 'Dano por rodada', kind: 'numero' },
    { key: 'removedByWater', label: 'Removido por água', kind: 'toggle' },
  ],
  congelado: [
    { key: 'movementPenalty', label: 'Redução de movimento (%)', kind: 'numero' },
    { key: 'disablesReaction', label: 'Impede reação', kind: 'toggle' },
    { key: 'actionTestDifficulty', label: 'Dificuldade do teste para agir (1d20 ≥)', kind: 'numero' },
  ],
  eletrizado: [
    { key: 'extraLightningDamage', label: 'Dano extra no próximo raio', kind: 'numero' },
    { key: 'reactionPenalty', label: 'Penalidade de reação', kind: 'numero' },
    { key: 'paralysisChance', label: 'Chance de paralisar (%)', kind: 'numero' },
  ],
  molhado: [
    { key: 'extraLightningDamagePercent', label: 'Dano extra de raio (%)', kind: 'numero' },
    { key: 'fireDamageReductionPercent', label: 'Redução de dano de fogo (%)', kind: 'numero' },
    { key: 'removesBurning', label: 'Remove Queimando', kind: 'toggle' },
  ],
  enraizado: [
    { key: 'movementPenalty', label: 'Redução de movimento (%)', kind: 'numero' },
    { key: 'immuneToPush', label: 'Imune a empurrões', kind: 'toggle' },
    { key: 'immuneToPull', label: 'Imune a puxões', kind: 'toggle' },
  ],
  fragil: [
    { key: 'defenseReduction', label: 'Redução de defesa', kind: 'numero' },
    { key: 'extraPhysicalDamagePercent', label: 'Dano físico extra (%)', kind: 'numero' },
  ],
  silenciado: [
    { key: 'blocksAuraCards', label: 'Bloqueia cartas de aura/magia', kind: 'toggle' },
    { key: 'blocksForms', label: 'Bloqueia formas', kind: 'toggle' },
    { key: 'allowsReactions', label: 'Permite reações', kind: 'toggle' },
  ],
  atordoado: [
    { key: 'losesAction', label: 'Perde a ação', kind: 'toggle' },
    { key: 'losesReaction', label: 'Perde a reação', kind: 'toggle' },
    { key: 'endsAfterTakingDamage', label: 'Termina ao sofrer dano', kind: 'toggle' },
  ],
  derrubado: [
    { key: 'defensePenalty', label: 'Penalidade de defesa', kind: 'numero' },
    { key: 'movementCostToStand', label: 'Custo de movimento para levantar', kind: 'numero' },
    { key: 'meleeAttackBonusAgainstTarget', label: 'Bônus de ataque corpo a corpo contra o alvo', kind: 'numero' },
  ],
  cego: [
    { key: 'attackPenalty', label: 'Desvantagem no ataque', kind: 'toggle' },
    { key: 'reactionPenalty', label: 'Penalidade de reação', kind: 'numero' },
    { key: 'maximumTargetingRange', label: 'Alcance máximo de mira (células)', kind: 'numero' },
  ],
  amedrontado: [
    { key: 'sourceCharacterId', label: 'ID de quem aplicou o medo', kind: 'texto' },
    { key: 'cannotApproachSource', label: 'Não pode se aproximar da origem', kind: 'toggle' },
    { key: 'attackPenaltyAgainstSource', label: 'Penalidade de ataque contra a origem', kind: 'numero' },
  ],
};

const INTENSITY_FACTOR: Record<ConditionIntensity, number> = { fraco: 0.6, normal: 1, forte: 1.5 };

const NUMERIC_FIELDS_TO_SCALE = [
  'extraDamagePercent', 'attackBonusAgainstTarget', 'defensePierceAgainstTarget', 'attackBonusFromSource',
  'damageBonusFromSource', 'damagePerRound', 'movementPenalty', 'extraLightningDamage', 'reactionPenalty',
  'paralysisChance', 'extraLightningDamagePercent', 'fireDamageReductionPercent', 'defenseReduction',
  'extraPhysicalDamagePercent', 'defensePenalty', 'movementCostToStand', 'meleeAttackBonusAgainstTarget',
  'attackPenalty', 'maximumTargetingRange', 'attackPenaltyAgainstSource', 'applicationChance', 'actionTestDifficulty',
] as const;

function scaleParams(params: ConditionParams, intensity: ConditionIntensity): ConditionParams {
  const factor = INTENSITY_FACTOR[intensity];
  if (factor === 1) return { ...params };
  const scaled: Record<string, unknown> = { ...params };
  for (const key of NUMERIC_FIELDS_TO_SCALE) {
    const value = (params as unknown as Record<string, unknown>)[key];
    if (typeof value === 'number') scaled[key] = Math.max(0, Math.round(value * factor));
  }
  return scaled as unknown as ConditionParams;
}

/** Traduz a config tipada de uma condição para os campos genéricos que o motor (arsenalPipeline) já sabe interpretar.
 *  Único lugar com "lógica" de condição — compartilhado por todas as cartas, nunca duplicado por carta. */
function toGenericFields(params: ConditionParams): Partial<ArsenalEffect> {
  switch (params.kind) {
    case 'vulneravel':
      return params.element ? { elementalAffinities: [{ element: params.element, kind: 'vulnerabilidade', percent: params.extraDamagePercent ?? 25 }] } : {};
    case 'exposto':
      return {
        grantsAttackerBonus: params.attackBonusAgainstTarget ? { value: params.attackBonusAgainstTarget } : null,
        defensePierce: params.defensePierceAgainstTarget ? { value: params.defensePierceAgainstTarget } : null,
      };
    case 'marcado':
      return {
        grantsAttackerBonus: params.attackBonusFromSource ? { value: params.attackBonusFromSource, onlySource: params.sourceOnly ?? true } : null,
        grantsAttackerDamageBonus: params.damageBonusFromSource ? { value: params.damageBonusFromSource, onlySource: params.sourceOnly ?? true } : null,
      };
    case 'sangrando':
      return {
        periodicDamage: params.damagePerRound ? { flat: params.damagePerRound, dice: null } : null,
        periodicDamageElement: 'sangue',
        customEffect: params.ignoresDefense ? 'ignora_defesa' : null,
      };
    case 'queimando':
      return {
        periodicDamage: params.damagePerRound ? { flat: params.damagePerRound, dice: null } : null,
        periodicDamageElement: 'fogo',
        immunities: [],
      };
    case 'congelado':
      return {
        speedModifier: params.movementPenalty ? -params.movementPenalty : 0,
        blocksReaction: params.disablesReaction ?? false,
        actsRequireTest: params.actionTestDifficulty ? { dice: '1d20', minimum: params.actionTestDifficulty } : null,
      };
    case 'eletrizado':
      return {
        bonusDamageOnElement: params.extraLightningDamage ? { element: 'raio', flat: params.extraLightningDamage, consumeOnUse: true } : null,
        reactionModifier: params.reactionPenalty ? -params.reactionPenalty : 0,
      };
    case 'molhado':
      return {
        elementalAffinities: [
          ...(params.extraLightningDamagePercent ? [{ element: 'raio' as const, kind: 'vulnerabilidade' as const, percent: params.extraLightningDamagePercent }] : []),
          ...(params.fireDamageReductionPercent ? [{ element: 'fogo' as const, kind: 'resistencia' as const, percent: params.fireDamageReductionPercent }] : []),
        ],
      };
    case 'enraizado':
      return {
        speedModifier: params.movementPenalty ? -params.movementPenalty : 0,
        preventsForcedMovement: !!(params.immuneToPush || params.immuneToPull),
      };
    case 'fragil':
      return {
        defenseModifier: params.defenseReduction ? -params.defenseReduction : 0,
        elementalAffinities: params.extraPhysicalDamagePercent ? [{ element: 'fisico', kind: 'vulnerabilidade', percent: params.extraPhysicalDamagePercent }] : [],
      };
    case 'silenciado':
      return { silence: { blocksBasicAttack: false }, blocksReaction: params.allowsReactions === false };
    case 'atordoado':
      return { incapacitate: params.losesAction ?? true, blocksReaction: params.losesReaction ?? true };
    case 'derrubado':
      return {
        defenseModifier: params.defensePenalty ? -params.defensePenalty : 0,
        grantsAttackerBonus: params.meleeAttackBonusAgainstTarget ? { value: params.meleeAttackBonusAgainstTarget } : null,
      };
    case 'cego':
      return {
        diceBonuses: params.attackPenalty ? [{ target: 'teste', disadvantage: true }] : [],
        reactionModifier: params.reactionPenalty ? -params.reactionPenalty : 0,
      };
    case 'amedrontado':
      return { attackPenaltyAgainstSource: params.attackPenaltyAgainstSource ?? 0 };
  }
}

function slug(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const YES = 'sim';
void YES;

/** Gera a descrição textual automática de uma condição a partir dos valores configurados. */
export function describeCondition(params: ConditionParams): string {
  const parts: string[] = [];
  const name = CONDITION_NAMES[params.kind];
  parts.push(`${name} por ${params.durationRounds} rodada${params.durationRounds === 1 ? '' : 's'}.`);
  switch (params.kind) {
    case 'vulneravel':
      if (params.element) parts.push(`Recebe +${params.extraDamagePercent ?? 0}% de dano de ${params.element}.`);
      break;
    case 'exposto':
      if (params.attackBonusAgainstTarget) parts.push(`Ataques contra o alvo recebem +${params.attackBonusAgainstTarget} no teste.`);
      if (params.defensePierceAgainstTarget) parts.push(`Ignora ${params.defensePierceAgainstTarget} de defesa do alvo.`);
      break;
    case 'marcado':
      if (params.attackBonusFromSource) parts.push(`${params.sourceOnly ? 'Quem aplicou a marca' : 'Qualquer atacante'} recebe +${params.attackBonusFromSource} no teste de ataque.`);
      if (params.damageBonusFromSource) parts.push(`${params.sourceOnly ? 'Quem aplicou a marca' : 'Qualquer atacante'} causa +${params.damageBonusFromSource} de dano.`);
      break;
    case 'sangrando':
      if (params.damagePerRound) parts.push(`Sofre ${params.damagePerRound} de dano de sangue por rodada${params.ignoresDefense ? ' (ignora defesa)' : ''}.`);
      break;
    case 'queimando':
      if (params.damagePerRound) parts.push(`Sofre ${params.damagePerRound} de dano de fogo por rodada.`);
      if (params.removedByWater) parts.push('Removido por dano de água.');
      break;
    case 'congelado':
      if (params.movementPenalty) parts.push(`Movimento reduzido em ${params.movementPenalty}%.`);
      if (params.disablesReaction) parts.push('Não pode reagir.');
      if (params.actionTestDifficulty) parts.push(`Precisa de 1d20 ≥ ${params.actionTestDifficulty} para agir.`);
      break;
    case 'eletrizado':
      if (params.extraLightningDamage) parts.push(`O próximo ataque de raio recebido causa +${params.extraLightningDamage} de dano.`);
      if (params.reactionPenalty) parts.push(`Reações sofrem -${params.reactionPenalty}.`);
      if (params.paralysisChance) parts.push(`${params.paralysisChance}% de chance de paralisar.`);
      break;
    case 'molhado':
      if (params.extraLightningDamagePercent) parts.push(`Recebe +${params.extraLightningDamagePercent}% de dano de raio.`);
      if (params.fireDamageReductionPercent) parts.push(`Recebe -${params.fireDamageReductionPercent}% de dano de fogo.`);
      if (params.removesBurning) parts.push('Remove Queimando ao ser aplicado.');
      break;
    case 'enraizado':
      if (params.movementPenalty) parts.push(`Movimento reduzido em ${params.movementPenalty}%.`);
      if (params.immuneToPush) parts.push('Imune a empurrões.');
      if (params.immuneToPull) parts.push('Imune a puxões.');
      break;
    case 'fragil':
      if (params.defenseReduction) parts.push(`Defesa reduzida em ${params.defenseReduction}.`);
      if (params.extraPhysicalDamagePercent) parts.push(`Recebe +${params.extraPhysicalDamagePercent}% de dano físico.`);
      break;
    case 'silenciado':
      if (params.blocksAuraCards) parts.push('Não pode usar cartas de aura/magia.');
      if (params.blocksForms) parts.push('Não pode ativar formas.');
      if (params.allowsReactions === false) parts.push('Também não pode reagir.');
      break;
    case 'atordoado':
      if (params.losesAction) parts.push('Perde a ação principal.');
      if (params.losesReaction) parts.push('Perde a reação.');
      if (params.endsAfterTakingDamage) parts.push('Termina ao sofrer dano.');
      break;
    case 'derrubado':
      if (params.defensePenalty) parts.push(`Defesa reduzida em ${params.defensePenalty}.`);
      if (params.movementCostToStand) parts.push(`Custa ${params.movementCostToStand} de movimento para levantar.`);
      if (params.meleeAttackBonusAgainstTarget) parts.push(`Ataques corpo a corpo contra o alvo recebem +${params.meleeAttackBonusAgainstTarget}.`);
      break;
    case 'cego':
      if (params.attackPenalty) parts.push('Desvantagem nos testes de ataque.');
      if (params.reactionPenalty) parts.push(`Reações sofrem -${params.reactionPenalty}.`);
      if (params.maximumTargetingRange) parts.push(`Só pode mirar alvos a até ${params.maximumTargetingRange} células.`);
      break;
    case 'amedrontado':
      if (params.attackPenaltyAgainstSource) parts.push(`Ataques contra quem aplicou o medo sofrem -${params.attackPenaltyAgainstSource}.`);
      if (params.cannotApproachSource) parts.push('Não pode se aproximar de quem aplicou o medo.');
      break;
  }
  if (params.applicationChance != null && params.applicationChance < 100) parts.push(`${params.applicationChance}% de chance de aplicar.`);
  if (params.savingThrow) parts.push(`O alvo resiste com ${params.savingThrow.dice} ≥ ${params.savingThrow.minimum}.`);
  if (params.maxStacks && params.maxStacks > 1) parts.push(`Acumula até ${params.maxStacks} vezes.`);
  return parts.join(' ');
}

/** Constrói o ArsenalEffect de uma condição base a partir da config tipada (ou de overrides parciais).
 *  `intensity` escala os valores numéricos padrão; `overrides` tem prioridade final sobre tudo. */
export function buildConditionEffect(kind: ConditionKind, intensity: ConditionIntensity = 'normal', overrides: Partial<ConditionParams> = {}): ArsenalEffect {
  const base = scaleParams(NORMAL_DEFAULTS[kind], intensity);
  const params = { ...base, ...overrides, kind } as ConditionParams;
  const generic = toGenericFields(params);
  const name = CONDITION_NAMES[kind];
  return {
    id: `preset-${slug(name)}`, name, description: describeCondition(params), tags: CONDITION_TAGS[kind],
    duration: { type: 'rodadas', amount: params.durationRounds },
    stackBehavior: 'renova_duracao', maxStacks: params.maxStacks ?? 1,
    triggers: [], modifiers: [], periodicDamage: null, periodicHealing: null, auraConsumed: null, auraRestored: null,
    attackModifier: 0, defenseModifier: 0, speedModifier: 0, customEffect: null,
    condition: params,
    ...generic,
  };
}

export const CONDITION_KINDS: ConditionKind[] = [
  'vulneravel', 'exposto', 'marcado', 'sangrando', 'queimando', 'congelado', 'eletrizado', 'molhado',
  'enraizado', 'fragil', 'silenciado', 'atordoado', 'derrubado', 'cego', 'amedrontado',
];

/** Nomes legados do sistema clássico anterior, mapeados para a condição base equivalente. */
const LEGACY_ALIASES: Record<string, ConditionKind> = {
  queimadura: 'queimando', queimado: 'queimando', queimada: 'queimando',
  sangramento: 'sangrando', congelamento: 'congelado', congelada: 'congelado',
  eletrocutado: 'eletrizado', eletrocutada: 'eletrizado', encharcado: 'molhado', encharcada: 'molhado',
  desnorteado: 'atordoado', desnorteada: 'atordoado', caido: 'derrubado', caida: 'derrubado',
  fraco: 'fragil', fraca: 'fragil', vulneravelmente: 'vulneravel',
};

export function conditionKindByName(name: string): ConditionKind | undefined {
  const key = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
  if (LEGACY_ALIASES[key]) return LEGACY_ALIASES[key];
  return CONDITION_KINDS.find(kind => CONDITION_NAMES[kind].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR') === key || kind === key);
}

export const CONDITION_INTENSITIES: ConditionIntensity[] = ['fraco', 'normal', 'forte'];

/** Só os campos específicos (exclui kind e os 4 campos gerais) — usado para mesclar defaults ao trocar condição/intensidade na UI. */
export function conditionSpecificDefaults(kind: ConditionKind, intensity: ConditionIntensity): Record<string, unknown> {
  const { kind: _kind, durationRounds: _d, applicationChance: _a, maxStacks: _m, savingThrow: _s, ...specific } = buildConditionEffect(kind, intensity).condition as ConditionParams & Record<string, unknown>;
  return specific;
}

export { CONDITION_NAMES };
