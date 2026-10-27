import type { Element } from '../types';

export type ArsenalCategory = 'habilidade' | 'selo' | 'item' | 'arma';
export type ArsenalVisibility = 'publica' | 'privada' | 'mestre' | 'oculta';
export type AbilityType = 'comum' | 'protecao' | 'combo' | 'forma';
export type SealType = 'ataque' | 'buff' | 'armadilha';
export type SealKind = 'explosao' | 'ritual';
export type ArsenalTag = string;

export interface AmountFormula {
  flat: number;
  dice?: string;
}

export type TargetConfig =
  | { type: 'proprio_usuario' }
  | { type: 'um_alvo' }
  | { type: 'multiplos_alvos'; maxTargets: number }
  | { type: 'todos_aliados' }
  | { type: 'todos_inimigos' }
  | { type: 'todos_em_area' }
  | { type: 'circulo_grid'; radius: number }
  | { type: 'celula_grid' }
  | { type: 'objeto_mapa' }
  /** Mapa inteiro: não mira ninguém específico — afeta todos os presentes no combate,
   *  sem distinção de time, como um efeito de campo de batalha (ver EncounterState.fieldEffects). */
  | { type: 'campo_de_batalha' };

export interface AreaConfig {
  shape: 'circulo' | 'cone' | 'linha' | 'quadrado' | 'customizada';
  size: number;
  unit: 'celulas' | 'metros' | 'unidades';
}

export type PreparationTiming =
  | { type: 'instantaneo' }
  | { type: 'turnos'; amount: number }
  | { type: 'rodadas'; amount: number }
  | { type: 'inicio_proximo_turno' }
  | { type: 'fim_turno_atual' }
  | { type: 'gatilho'; trigger: TriggerEvent };

export interface PreparationConfig {
  timing: PreparationTiming;
  cancellable: boolean;
  interruptedByDamage: boolean;
  persistsAfterDamage: boolean;
  visibility: 'visivel' | 'oculta';
}

export type CooldownConfig =
  | { type: 'sem_cooldown' }
  | { type: 'turnos'; amount: number }
  | { type: 'rodadas'; amount: number }
  | { type: 'usos'; amount: number }
  | { type: 'fim_combate' }
  | { type: 'descanso' }
  | { type: 'gatilho'; trigger: TriggerEvent };

export type ChargeRecharge =
  | { type: 'automatica'; amount: number }
  | { type: 'por_turno'; amount: number }
  | { type: 'por_rodada'; amount: number }
  | { type: 'por_evento'; event: TriggerEvent; amount: number }
  | { type: 'nao_recarrega' };

export interface ChargeConfig {
  maximum: number;
  current: number;
  recharge: ChargeRecharge;
}

export type EffectDurationType =
  | 'turnos'
  | 'rodadas'
  | 'usos'
  | 'permanente'
  | 'ate_removido'
  | 'enquanto_equipado'
  | 'enquanto_forma_ativa'
  | 'enquanto_condicao_verdadeira';

export interface EffectDuration {
  type: EffectDurationType;
  amount?: number;
  conditionId?: string;
}

export type StackBehavior =
  | 'nao_acumula'
  | 'renova_duracao'
  | 'acumula_intensidade'
  | 'acumula_duracao'
  | 'acumula_ambos';

export type TriggerEvent =
  | 'uso_manual'
  | 'ao_atacar'
  | 'ao_ser_atacado'
  | 'ao_causar_dano'
  | 'ao_receber_dano'
  | 'ao_curar'
  | 'ao_ser_curado'
  | 'inicio_turno'
  | 'fim_turno'
  | 'inicio_rodada'
  | 'fim_rodada'
  | 'entrar_combate'
  | 'sair_combate'
  | 'equipar_arma'
  | 'desequipar_arma'
  | 'ativar_forma'
  | 'perder_forma'
  | 'consumir_aura'
  | 'restaurar_aura'
  | 'aplicar_efeito'
  | 'efeito_expirar'
  | 'morrer'
  | 'derrotar_alvo';

export interface TriggerConfig {
  event: TriggerEvent;
  tags?: ArsenalTag[];
  effectIds?: string[];
  /** Outras cartas disparadas por este gatilho. */
  cardIds?: string[];
  automatic?: boolean;
}

/** Filtro único de escopo, reutilizado por EffectModifier, DiceBonus e as tabelas de condição elemental. */
export interface EffectFilter {
  damageType?: Element[];
  cardIds?: string[];
  cardTags?: ArsenalTag[];
  categories?: ArsenalCategory[];
  abilityTypes?: AbilityType[];
  weaponIds?: string[];
  /** Só se aplica quando o efeito ativo foi originalmente aplicado por esta entidade. */
  sourceEntityId?: string;
}

export interface EffectModifier {
  stat: 'ataque' | 'defesa' | 'velocidade' | 'dano' | 'cura' | 'aura' | 'cura_recebida' | 'aura_recebida' | 'vida_maxima' | 'aura_maxima';
  operation: 'somar' | 'multiplicar' | 'definir';
  value: number;
  filter?: EffectFilter;
}

export type DiceBonusTarget = 'teste' | 'dano_extra' | 'dano' | 'cura';

/** Bônus de rolagem geral ou atrelado a um elemento/arma/tag específico. */
export interface DiceBonus {
  target: DiceBonusTarget;
  /** Dado extra somado à rolagem base (ex.: '1d4'). */
  bonusDice?: string | null;
  bonusFlat?: number;
  /** Rola a rolagem base duas vezes e fica com o maior resultado. */
  advantage?: boolean;
  /** Rola a rolagem base duas vezes e fica com o menor resultado. Anula vantagem. */
  disadvantage?: boolean;
  /** Rerrola uma vez quando o resultado base for menor que este limite. */
  rerollBelow?: number | null;
  /** Eleva o resultado base para, no mínimo, este valor antes dos bônus. */
  minimumResult?: number | null;
  filter?: EffectFilter;
}

// ─────────────────────────────────────────────────────────────────
// Modificadores de valor (buff/debuff genérico v2) — camada única que qualquer
// efeito usa para alterar testes, dano, cura ou recursos durante a resolução
// de uma carta/habilidade. Ver utils/effectModifiers.ts para o motor que
// interpreta isto (filtro, ordem de resolução, texto de log).
// ─────────────────────────────────────────────────────────────────

export type ModifierOperation =
  | 'somar' | 'subtrair' | 'multiplicar' | 'dividir'
  | 'adicionar_dado' | 'remover_dado'
  | 'aumentar_dado' | 'reduzir_dado'
  | 'vantagem' | 'desvantagem'
  | 'definir_minimo' | 'definir_maximo'
  /** Sobrescreve o valor final para exatamente este número (equivalente ao antigo EffectModifier 'definir'). */
  | 'definir';

/** Onde, na resolução de uma carta, o valor é calculado — o único conjunto de "ganchos" que o motor
 *  de combate realmente consulta. Tudo que é mais específico (físico/elemental, causado/recebido,
 *  crítico, de reação, etc.) é um FILTRO sobre um destes alvos, não um alvo novo — isso é o que evita
 *  ter que criar um caminho de código por combinação. */
export type ModifierTarget =
  | 'teste' | 'dano' | 'cura'
  | 'custo_aura' | 'custo_municao' | 'cooldown'
  | 'defesa' | 'velocidade'
  | 'vida_maxima' | 'aura_maxima' | 'recuperacao_aura';

export type ModifierDirection = 'causado' | 'recebido';
/** Subtipo do teste sendo rolado — só relevante quando target === 'teste'. */
export type ModifierTestKind = 'ataque' | 'reacao' | 'esquiva' | 'defesa' | 'fisico' | 'magico' | 'cura';
/** Em qual momento da ação isto se aplica. 'normal' = ação comum (não reação/combo/preparação). */
export type ModifierContext = 'normal' | 'reacao' | 'combo' | 'preparacao';
export type ModifierResource = 'vida' | 'aura';

/** Faixa de vida (%) do sujeito indicado, para condicionar o modificador (ex.: "só abaixo de 50%"). */
export interface ModifierHpRange {
  subject: 'usuario' | 'alvo';
  min?: number;
  max?: number;
}

/** Filtro de escopo do modificador v2 — mais rico que EffectFilter porque cobre contexto de uso
 *  (reação/combo/preparação), direção (causado/recebido), condições ativas e faixa de vida.
 *  Todo campo ausente = sem restrição nessa dimensão (passa sempre). */
export interface ModifierFilter {
  elements?: Element[];
  tags?: ArsenalTag[];
  categories?: ArsenalCategory[];
  abilityTypes?: AbilityType[];
  cardIds?: string[];
  weaponIds?: string[];
  formIds?: string[];
  /** Só relevante para target 'teste'. Ausente = qualquer tipo de teste. */
  testKinds?: ModifierTestKind[];
  /** Só relevante para target 'dano'/'cura'. Ausente = ambas as direções. */
  direction?: ModifierDirection;
  /** Só relevante para target 'dano'. */
  periodic?: boolean;
  critical?: boolean;
  /** Contextos de uso em que o modificador se aplica. Ausente = qualquer contexto. */
  contexts?: ModifierContext[];
  /** Só relevante para target 'cura'/'recuperacao_aura'/'aura_maxima'. */
  resource?: ModifierResource;
  /** Nomes de condição (ex.: "Molhado") que o USUÁRIO precisa ter ativas para o modificador valer. */
  requiredUserConditions?: string[];
  /** Nomes de condição que o ALVO da ação precisa ter ativas. */
  requiredTargetConditions?: string[];
  hpRange?: ModifierHpRange;
  /** Restringe a quem originalmente aplicou o efeito ativo (mesma semântica de EffectFilter.sourceEntityId). */
  sourceEntityId?: string;
}

/** Um modificador de valor genérico: operação + valor/dado + onde se aplica + filtro de quando vale.
 *  Substitui a necessidade de lógica específica por carta — a carta só declara isto, o motor interpreta. */
export interface ValueModifier {
  operation: ModifierOperation;
  target: ModifierTarget;
  /** Usado por somar/subtrair/multiplicar/dividir/definir_minimo/definir_maximo/aumentar_dado/reduzir_dado
   *  (nº de passos na escada de dados) e vantagem/desvantagem (ignorado). */
  value?: number;
  /** Usado por adicionar_dado (dado extra somado ao total) e remover_dado (nº de dados a remover do pool base). */
  dice?: string;
  filter?: ModifierFilter;
}

export type ElementalAffinityKind = 'resistencia' | 'vulnerabilidade' | 'imunidade' | 'absorcao';

/** Afinidade elemental concedida por um efeito ativo (resistência/vulnerabilidade/imunidade/absorção). */
export interface ElementalAffinity {
  element: Element;
  kind: ElementalAffinityKind;
  /** Percentual do multiplicador para resistência/vulnerabilidade/absorção (0-100+). Ignorado em imunidade. */
  percent: number;
  /** Some junto com o efeito que a concede assim que ela influenciar um dano recebido (ex.: Eletrizado: só o próximo ataque de raio). */
  consumeOnUse?: boolean;
}

/** Rolagem exigida para o portador poder agir enquanto o efeito está ativo (ex.: Congelado em intensidade forte). Falhar cancela a ação. */
export interface ActionTestRequirement {
  dice: string;
  minimum: number;
}

export type ConditionKind =
  | 'vulneravel' | 'exposto' | 'marcado' | 'sangrando' | 'queimando' | 'congelado'
  | 'eletrizado' | 'molhado' | 'enraizado' | 'fragil' | 'silenciado' | 'atordoado'
  | 'derrubado' | 'cego' | 'amedrontado';

export type ConditionIntensity = 'fraco' | 'normal' | 'forte';

/** Campos comuns a todas as 15 condições base — o único lugar onde duração/chance/stacks/resistência vivem. */
export interface ConditionBaseParams {
  durationRounds: number;
  /** 0-100. Chance de a condição pegar no alvo ao ser aplicada. Ausente = 100 (sempre aplica). */
  applicationChance?: number;
  maxStacks?: number;
  /** Teste de resistência do alvo contra a aplicação (ex.: 1d20 ≥ 12). Falhar o teste = a condição não pega. */
  savingThrow?: { dice: string; minimum: number } | null;
}

/** Configuração declarativa e tipada de uma das 15 condições base. A carta só referencia isso —
 *  toda a interpretação (dano, bônus, penalidades) fica centralizada no motor (arsenalPipeline). */
export type ConditionParams =
  | (ConditionBaseParams & { kind: 'vulneravel'; element?: Element; extraDamagePercent?: number })
  | (ConditionBaseParams & { kind: 'exposto'; attackBonusAgainstTarget?: number; defensePierceAgainstTarget?: number })
  | (ConditionBaseParams & { kind: 'marcado'; sourceOnly?: boolean; attackBonusFromSource?: number; damageBonusFromSource?: number })
  | (ConditionBaseParams & { kind: 'sangrando'; damagePerRound?: number; ignoresDefense?: boolean })
  | (ConditionBaseParams & { kind: 'queimando'; damagePerRound?: number; removedByWater?: boolean })
  | (ConditionBaseParams & { kind: 'congelado'; movementPenalty?: number; disablesReaction?: boolean; actionTestDifficulty?: number })
  | (ConditionBaseParams & { kind: 'eletrizado'; extraLightningDamage?: number; reactionPenalty?: number; paralysisChance?: number })
  | (ConditionBaseParams & { kind: 'molhado'; extraLightningDamagePercent?: number; fireDamageReductionPercent?: number; removesBurning?: boolean })
  | (ConditionBaseParams & { kind: 'enraizado'; movementPenalty?: number; immuneToPush?: boolean; immuneToPull?: boolean })
  | (ConditionBaseParams & { kind: 'fragil'; defenseReduction?: number; extraPhysicalDamagePercent?: number })
  | (ConditionBaseParams & { kind: 'silenciado'; blocksAuraCards?: boolean; blocksForms?: boolean; allowsReactions?: boolean })
  | (ConditionBaseParams & { kind: 'atordoado'; losesAction?: boolean; losesReaction?: boolean; endsAfterTakingDamage?: boolean })
  | (ConditionBaseParams & { kind: 'derrubado'; defensePenalty?: number; movementCostToStand?: number; meleeAttackBonusAgainstTarget?: number })
  | (ConditionBaseParams & { kind: 'cego'; attackPenalty?: number; reactionPenalty?: number; maximumTargetingRange?: number })
  | (ConditionBaseParams & { kind: 'amedrontado'; sourceCharacterId?: string; cannotApproachSource?: boolean; attackPenaltyAgainstSource?: number });

export interface ArsenalEffect {
  id: string;
  name: string;
  description: string;
  tags: ArsenalTag[];
  duration: EffectDuration;
  stackBehavior: StackBehavior;
  maxStacks: number;
  triggers: TriggerConfig[];
  modifiers: EffectModifier[];
  periodicDamage: AmountFormula | null;
  periodicHealing: AmountFormula | null;
  auraConsumed: AmountFormula | null;
  auraRestored: AmountFormula | null;
  attackModifier: number;
  defenseModifier: number;
  speedModifier: number;
  /** Penalidade/bônus aplicado às reações do portador enquanto este efeito está ativo. */
  reactionModifier?: number;
  customEffect: string | null;
  /** Exige uma rolagem para o portador poder agir enquanto ativo (ex.: Congelado em intensidade forte). Ausente = age livremente. */
  actsRequireTest?: ActionTestRequirement | null;
  /** Impede o portador de realizar reações enquanto ativo (ex.: Congelado, Atordoado). */
  blocksReaction?: boolean;
  /** Impede que o portador seja movido por efeitos de terceiros (empurrar/puxar/teleportar) enquanto ativo. */
  preventsForcedMovement?: boolean;
  /** Concede bônus de ataque a quem atacar o portador enquanto ativo (ex.: Exposto, Marcado). `onlySource` restringe o bônus a quem aplicou o efeito. */
  grantsAttackerBonus?: { value: number; onlySource?: boolean } | null;
  /** Reduz a defesa efetiva do portador contra ataques (ex.: Exposto). `onlySource` restringe a quem aplicou o efeito. */
  defensePierce?: { value: number; onlySource?: boolean } | null;
  /** Concede bônus de dano a quem atacar o portador enquanto ativo (ex.: Marcado). `onlySource` restringe o bônus a quem aplicou o efeito. */
  grantsAttackerDamageBonus?: { value: number; onlySource?: boolean } | null;
  /** Bônus de dano flat quando o portador é atingido pelo elemento indicado; pode se consumir no primeiro uso (ex.: Eletrizado). */
  bonusDamageOnElement?: { element: Element; flat: number; consumeOnUse?: boolean } | null;
  /** Penaliza o ataque do portador quando o alvo dele é quem aplicou este efeito (ex.: Amedrontado). */
  attackPenaltyAgainstSource?: number | null;
  /** Elemento associado ao dano periódico deste efeito, usado para aplicar afinidades elementais do próprio portador (ex.: Queimando = fogo). */
  periodicDamageElement?: Element | null;
  /** Configuração tipada de uma das 15 condições base — fonte de verdade para a descrição automática e para a UI de edição. */
  condition?: ConditionParams | null;
  /** Modificadores de valor genéricos (buff/debuff v2) — ver utils/effectModifiers.ts. Substitui `modifiers`/
   *  `diceBonuses`/`attackModifier`/`defenseModifier`/`speedModifier` para efeitos novos; os campos antigos
   *  continuam funcionando (convertidos internamente pelo motor), não precisam ser migrados. */
  valueModifiers?: ValueModifier[];
  /** Bônus de rolagem (dado extra, flat, vantagem) concedidos enquanto este efeito está ativo. */
  diceBonuses?: DiceBonus[];
  /** Resistência/vulnerabilidade/imunidade/absorção elemental concedida a quem carrega o efeito. */
  elementalAffinities?: ElementalAffinity[];
  /** Deltas temporários sobre a guarda/estagger do portador (buff/debuff v2) — somados aos valores base em defense.ts. */
  guardModifiers?: {
    defenseReductionDelta?: number;
    defenseRegenerationDelta?: number;
    staggerMaxDelta?: number;
    staggerRecoveryDelta?: number;
    staggerDamageMultiplierDelta?: number;
  } | null;
  /** Percentual do dano causado pelo portador que retorna como cura (0-100). */
  lifeSteal?: number | null;
  /** Dano refletido ao atacante quando o portador é atingido. */
  thorns?: AmountFormula | null;
  /** IDs ou nomes de efeitos que o portador não pode receber enquanto este efeito está ativo. */
  immunities?: string[];

  /** Barreira que absorve dano antes de descontar da vitalidade; some ao esgotar. */
  shield?: AmountFormula | null;
  /** Concede ações/reações extras no turno (ex.: ataque bônus, movimento extra). */
  extraActions?: { kind: 'acao' | 'reacao' | 'movimento'; amount: number } | null;
  /** Empurra, puxa, teleporta ou troca de posição com o alvo. */
  movement?: { kind: 'empurrar' | 'puxar' | 'teleportar' | 'trocar_lugar'; distance: number } | null;
  /** Impede o alvo de usar habilidades/selos (não afeta ataques básicos, salvo flag). */
  silence?: { blocksBasicAttack: boolean } | null;
  /** Impede o alvo de agir no próprio turno (ex.: Atordoado). */
  incapacitate?: boolean;
  /** Torna o portador indetectável/inatacável até quebrar por ação própria ou receber dano. */
  invisibility?: { breaksOnAction: boolean; breaksOnDamage: boolean } | null;
  /** Força o alvo a atacar/mirar apenas o portador (taunt/provocação). */
  taunt?: boolean;
  /** Remove efeitos ativos do alvo. */
  dispel?: { category: 'positivo' | 'negativo' | 'qualquer'; count: number } | null;
  /** Converte um tipo de dano recebido/causado em outro elemento enquanto ativo. */
  damageConversion?: { from: Element | 'qualquer'; to: Element } | null;
  /** Invoca uma entidade aliada temporária (referencia ficha/token pré-configurado). */
  summon?: { entityId: string; duration: EffectDuration } | null;
  /** Transforma o portador (troca de forma/estatísticas) enquanto o efeito durar. */
  transform?: { intoFormId: string } | null;
  /** Ressuscita o alvo com uma fração da vitalidade máxima ao ser derrotado. */
  revive?: { hpPercent: number; usesLeft: number } | null;
  /** Gera recurso (carga de habilidade, munição, aura) ao portador quando o efeito dispara. */
  resourceGeneration?: { resource: 'carga' | 'aura' | 'municao'; amount: number; targetCardIds?: string[] } | null;
  /** Reduz custo (aura) ou cooldown de outras cartas enquanto ativo. */
  costReduction?: { auraDelta: number; cooldownTurnsDelta: number; filter?: EffectFilter } | null;
  /** Ricocheteia o efeito de origem para alvos adicionais, com atenuação percentual por salto. */
  chain?: { maxBounces: number; falloffPercent: number } | null;
  /** Sorteia um efeito dentre a lista ponderada ao ser aplicado (ex.: "efeito selvagem"). */
  randomTable?: { effectId: string; weight: number }[] | null;
  /** Marca o alvo: próximo dano/cura recebido de fonte compatível é amplificado. */
  markVulnerable?: { amplifyPercent: number; filter?: EffectFilter } | null;
  /** Copia o último efeito relevante aplicado/recebido (ex.: "eco", "espelho") pelo portador ou alvo. */
  echoLastEffect?: { subject: 'usuario' | 'alvo' } | null;
}

export type UsageCondition =
  | { type: 'arma_equipada'; weaponIds?: string[]; tags?: ArsenalTag[] }
  | { type: 'forma_ativa'; formIds?: string[]; tags?: ArsenalTag[] }
  | { type: 'elemento'; element: Element }
  | { type: 'aura_minima'; amount: number }
  | { type: 'vida_acima'; value: number; unit: 'valor' | 'percentual' }
  | { type: 'vida_abaixo'; value: number; unit: 'valor' | 'percentual' }
  | { type: 'efeito_ativo'; effectId: string }
  | { type: 'alvo_com_efeito'; effectId: string }
  | { type: 'proprio_turno' }
  | { type: 'reacao' }
  | { type: 'fora_turno' }
  | { type: 'em_combate' }
  | { type: 'fora_combate' }
  | { type: 'tag'; tag: ArsenalTag; subject: 'usuario' | 'alvo' | 'carta' };

export interface WeaponModule {
  freelyEquippable: boolean;
  grantedAbilityIds: string[];
  /** Efeitos passivos concedidos enquanto a arma está equipada (duração forçada para 'enquanto_equipado'). */
  effects?: ArsenalEffect[];
}

export interface FormModule {
  grantedAbilityIds: string[];
  removedAbilityIds: string[];
  hpBonus: number;
  auraBonus: number;
  color?: string;
  iconOverride?: string;
  /** Duração em rodadas. null/ausente = permanente até reverter ou o combate acabar. */
  durationRounds?: number | null;
  /** Efeitos passivos concedidos enquanto a forma está ativa (duração forçada para 'enquanto_forma_ativa'). */
  effects?: ArsenalEffect[];
}

/** Direções aceitas pelo grid ritualístico. Mantidas como contrato compartilhado
 * entre o editor do Arsenal e qualquer VTT que consuma o JSON exportado. */
export type RitualConnectorDirection =
  | 'top' | 'right' | 'bottom' | 'left'
  | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

export type RitualNodeRole = 'nucleo' | 'condutor' | 'modificador' | 'catalisador' | 'material';

/** Metadados puramente estruturais de uma peça ritualística.
 * Custos, efeitos e elemento continuam nos campos canônicos de ArsenalCard. */
export interface RitualNodeConfig {
  /** false remove a carta da biblioteca do construtor sem apagar sua configuração. */
  enabled: boolean;
  /** Identificador humano estável usado pelo arquivo externo de combinações. */
  key: string;
  role: RitualNodeRole;
  connectors: RitualConnectorDirection[];
  rotationAllowed: boolean;
  /** Limite de cópias simultâneas no grid. Ausente = sem limite além do inventário. */
  maxPerRitual?: number;
  /** Canais/tags que esta peça oferece para regras de compatibilidade. */
  connectionTags: ArsenalTag[];
  /** Bloqueia ligação com peças que ofereçam qualquer uma destas tags. */
  forbiddenConnectionTags: ArsenalTag[];
  /** Para itens: consome uma unidade quando o ritual for confirmado. */
  consumedOnConfirm?: boolean;
}

export interface ItemModule {
  consumable: boolean;
  quantity: number;
  disappearsOnUse: boolean;
  /** Quantas unidades cada ativação consome. Ausente/menor que 1 = 1. */
  usesPerActivation?: number;
  /** Configuração opcional de uso do item como material/nó no construtor de rituais. */
  ritual?: RitualNodeConfig;
}

export interface SealModule {
  /** Comportamento principal. `type` é mantido para compatibilidade com cartas antigas. */
  kind: SealKind;
  type?: SealType;
  persistent: boolean;
  consumable: boolean;
  requiredItems: { itemId: string; quantity: number }[];
  /** Duração geral do ritual em rodadas. null = sem duração definida. */
  durationRounds: number | null;
  /** Configuração visual/estrutural usada pelo construtor de rituais. */
  ritual?: RitualNodeConfig;
}

export interface ComboModule {
  /** Cartas de combo com a mesma chave podem ser empilhadas na mesma jogada. */
  stackKey: string;
  maxStacks: number;
  /** Campos legados, lidos apenas durante a migração. */
  abilityIds?: string[];
  minimumAbilities?: number;
  resolution: 'sequencial' | 'simultanea';
}

/** Valores que podem evoluir de um nível para o seguinte. */
export interface ArsenalLevel {
  level: number;
  name?: string;
  description?: string;
  element?: Element | null;
  testDice?: string | null;
  extraDamageDice?: string | null;
  damage?: AmountFormula | null;
  healing?: AmountFormula | null;
  auraConsumed?: AmountFormula | null;
  auraRestored?: AmountFormula | null;
  ammoConsumed?: AmountFormula | null;
  ammoRestored?: AmountFormula | null;
  effects?: ArsenalEffect[];
  cooldown?: CooldownConfig;
  charges?: ChargeConfig | null;
  form?: FormModule;
  weapon?: WeaponModule;
  seal?: SealModule;
  item?: ItemModule;
}

/** Entidade canônica do arsenal. A UI antiga é adaptada para este contrato. */
export interface ArsenalCard {
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  category: ArsenalCategory;
  icon: string;
  /** CSS `object-position`/`background-position` da arte da carta (ex.: "50% 30%"). */
  iconPosition?: string;
  /** 'horizontal' (padrão, banner curto) ou 'full' (arte vertical cobrindo o fundo da carta). */
  artLayout?: 'horizontal' | 'full';
  tags: ArsenalTag[];
  element: Element | null;
  testDice: string | null;
  extraDamageDice: string | null;
  damage: AmountFormula | null;
  healing: AmountFormula | null;
  auraConsumed: AmountFormula | null;
  auraRestored: AmountFormula | null;
  ammoConsumed: AmountFormula | null;
  ammoRestored: AmountFormula | null;
  target: TargetConfig;
  area: AreaConfig | null;
  preparation: PreparationConfig;
  conditions: UsageCondition[];
  triggers: TriggerConfig[];
  effects: ArsenalEffect[];
  cooldown: CooldownConfig;
  charges: ChargeConfig | null;
  visibility: ArsenalVisibility;
  weaponLinks: string[];
  formLinks: string[];
  abilityType?: AbilityType;
  weapon?: WeaponModule;
  form?: FormModule;
  item?: ItemModule;
  seal?: SealModule;
  combo?: ComboModule;
  /** Nível 1 é a própria carta; a lista contém somente os níveis seguintes. */
  levels: ArsenalLevel[];
  metadata?: Record<string, unknown>;
  /** Sobrescreve a chance padrão de aplicar a condição elemental do seu tipo de dano (0-1). */
  elementalConditionChance?: number;
  /** false desativa completamente o proc de condição elemental para esta carta. */
  applyElementalCondition?: boolean;
}

export interface ArsenalHolding {
  cardId: string;
  quantity: number;
  equipped: boolean;
  active: boolean;
  /** Maior nivel que este personagem pode usar desta entrada. Ausente = sem limite. */
  maxLevel?: number;
  currentCharges?: number;
  cooldownRemaining?: number;
}

export const INSTANT_PREPARATION: PreparationConfig = {
  timing: { type: 'instantaneo' },
  cancellable: false,
  interruptedByDamage: false,
  persistsAfterDamage: true,
  visibility: 'visivel',
};

export function createArsenalCard(
  input: Pick<ArsenalCard, 'id' | 'name' | 'category'> & Partial<Omit<ArsenalCard, 'id' | 'name' | 'category'>>,
): ArsenalCard {
  return {
    schemaVersion: 1,
    description: '',
    icon: '',
    tags: [],
    element: null,
    testDice: null,
    extraDamageDice: null,
    damage: null,
    healing: null,
    auraConsumed: null,
    auraRestored: null,
    ammoConsumed: null,
    ammoRestored: null,
    target: { type: 'um_alvo' },
    area: null,
    preparation: INSTANT_PREPARATION,
    conditions: [],
    triggers: [{ event: 'uso_manual' }],
    effects: [],
    cooldown: { type: 'sem_cooldown' },
    charges: null,
    visibility: 'publica',
    weaponLinks: [],
    formLinks: [],
    levels: [],
    ...input,
  };
}

export function arsenalMaxLevel(card: ArsenalCard): number {
  return Math.max(1, ...card.levels.map(entry => entry.level));
}

/** Resolve a carta efetiva acumulando as substituições até o nível escolhido. */
export function arsenalCardAtLevel(card: ArsenalCard, requestedLevel = 1): ArsenalCard {
  const level = Math.max(1, Math.min(Math.floor(requestedLevel) || 1, arsenalMaxLevel(card)));
  const base = structuredClone(card);
  const levels = base.levels;
  for (const entry of [...levels].sort((a, b) => a.level - b.level)) {
    if (entry.level > level) break;
    const { level: _level, ...changes } = entry;
    Object.assign(base, structuredClone(changes));
  }
  base.levels = levels;
  return base;
}

export function normalizeTags(tags: readonly string[] | undefined): ArsenalTag[] {
  return [...new Set((tags ?? []).map(tag => tag.trim().toLocaleLowerCase('pt-BR')).filter(Boolean))];
}

export function hasAllTags(source: readonly ArsenalTag[], required: readonly ArsenalTag[]): boolean {
  const normalized = new Set(normalizeTags(source));
  return normalizeTags(required).every(tag => normalized.has(tag));
}

export function grantedAbilities(card: ArsenalCard): string[] {
  if (card.category === 'arma') return card.weapon?.grantedAbilityIds ?? [];
  if (card.abilityType === 'forma') return card.form?.grantedAbilityIds ?? [];
  return [];
}
