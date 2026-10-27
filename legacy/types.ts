import type { ArsenalEffect, ArsenalHolding, ChargeConfig, CooldownConfig } from './utils/arsenal';

export type CardType = 'ataque' | 'reação' | 'ação' | 'reforço' | 'vínculo' | 'combinação' | 'forma';

export type DamageType = 'fisico' | 'fogo' | 'raio' | 'água' | 'terra' | 'vento' | 'escuridão' | 'luminoso' | 'sangue' | 'aura';

/** Elemento de dano do sistema unificado (mesma união do DamageType legado). */
export type Element = DamageType;

/** Afinidade elemental de uma ficha: fraco ×1.5, resistente ×0.5, imune ×0. */
export type Affinity = 'fraco' | 'resistente' | 'imune';

/** Posse de uma entrada do grimório por um personagem. */
export interface GrimoireHolding {
  entryId: string;
  /** Unidades possuídas (consumíveis). Ausente = 1. */
  quantity?: number;
  /** Nível escolhido no módulo de níveis da entrada. Ausente = perfil base. */
  level?: number;
}

export interface ArsenalBase {
  id: string;
  name: string;
  image: string;
  description: string;
  isHidden?: boolean;
  /** Equipe explícita para participantes invocados que vivem no roster de NPCs. */
  teamOverride?: 'party' | 'npc';
  summonedRoundsRemaining?: number;
}

export interface CardLevel {
  level: number;
  name?: string;
  auraCost?: number;
  ammoCost?: number;
  diceRoll?: string;
  damage?: number;
  damageValue?: number;
  impactValue?: number;
  damageType?: DamageType;
  dc?: number;
  conditionEffect?: string;
  conditionDuration?: number;
  description?: string;
}

/** Bonus que uma carta pode conferir ao ser ativada */
export interface CardBonus {
  type: 'healHp' | 'recoverAura' | 'recoverAmmo' | 'rollBonusGeneral' | 'rollBonusByType' | 'rollBonusByElement';
  value: number;
  targetCardType?: CardType;
  targetElement?: 'fogo' | 'água' | 'terra' | 'vento' | 'raio';
  duration?: number; // rodadas (0=perm, 1=próxima rolagem)
  label?: string;
}

export type ConditionEffectType =
  | 'damage'        // lose HP each round
  | 'heal'          // gain HP each round
  | 'drainAura'     // lose Aura each round
  | 'recoverAura'   // gain Aura each round
  | 'drainAmmo'     // lose Ammo each round
  | 'recoverAmmo'   // gain Ammo each round
  | 'dicePenalty'   // subtract from dice roll
  | 'diceBonus';    // add to dice roll

export interface ConditionEffect {
  type: ConditionEffectType;
  value: number;        // flat value (damage/heal etc) or dice bonus
  diceRoll?: string;    // optional: if set, roll this die instead of flat value
}

/** Map of condition name -> effects applied each round */
export type ConditionEffectMap = Record<string, ConditionEffect[]>;

export interface Condition {
  name: string;
  duration: number;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  image: string;
  link?: string;
  isHidden?: boolean;
  quantity?: number;
  maxQuantity?: number;
  durability?: number;
  maxDurability?: number;
  wearPerUse?: number;
  usesPerActivation?: number;
  cooldown?: CooldownConfig;
  charges?: ChargeConfig | null;
  category?: string;
  effects?: ArsenalEffect[];
  // Combat usage
  usableInCombat?: boolean;
  combatHeal?: number;
  combatDamage?: number;
  combatDamageType?: DamageType;
  combatAuraRecover?: number;
  combatAmmoRecover?: number;
  combatAuraCost?: number;
  combatConditionEffect?: string;
  combatConditionDuration?: number;
  combatDc?: number;
  consumeOnUse?: boolean;
  combatAmmoCost?: number;
  combatTargeting?: "self" | "other" | "area" | "choice";
  combatDiceRoll?: string;
  combatRange?: number;
  combatAreaSize?: number;
  combatAreaShape?: 'circle' | 'cone' | 'line' | 'square';
}

export interface Card {
  id: string;
  name: string;
  image: string;
  auraCost: number;
  ammoCost?: number;
  type: CardType;
  dc?: number;
  damage?: number;
  damageValue?: number;
  impactValue?: number;
  damageType?: DamageType;
  description: string;
  conditionEffect?: string;
  conditionDuration?: number;
  isAreaEffect?: boolean;
  element?: 'fogo' | 'água' | 'terra' | 'vento' | 'raio';
  isHidden?: boolean;
  comboMinUsers?: number;
  comboMaxUsers?: number;
  comboFixedUsers?: boolean;
  comboDiceMode?: 'sum' | 'highest';
  levels?: CardLevel[];
  bonuses?: CardBonus[];
  formaColor?: string;
  formaIcon?: string;
  formaCardIds?: string[];
  formaDuration?: number; // 0 = permanent
  formaHpBonus?: number;  // max HP increase while active
  formaAuraBonus?: number; // max Aura increase while active
  diceRoll?: string;
  code?: string;
  conditionEffects?: ConditionEffectMap; // per-condition round effects
}

export interface Weapon {
  id: string;
  name: string;
  description: string;
  image: string;
  category?: string;
  damage?: number;
  damageType?: DamageType;
  range?: 'melee' | 'ranged' | 'thrown';
  bonus?: number;
  traits?: string[];
  isHidden?: boolean;
  // Combat usage (same fields as Item)
  usableInCombat?: boolean;
  combatHeal?: number;
  combatDamage?: number;
  combatDamageType?: DamageType;
  combatAuraRecover?: number;
  combatAmmoRecover?: number;
  combatConditionEffect?: string;
  combatConditionDuration?: number;
  combatDc?: number;
  consumeOnUse?: boolean;
  combatAmmoCost?: number;
  combatTargeting?: "self" | "other" | "area" | "choice";
  combatDiceRoll?: string;
}

/** Posse referenciada de um item do catálogo global. */
export interface OwnedItem {
  itemId: string;
  quantity: number;
  durability?: number;
  maxDurability?: number;
}

export interface ActiveForma {
  combatantId: string;
  cardId: string;
  color: string;
  iconOverride?: string;
  extraCardIds: string[];
  duration?: number; // number of rounds remaining (0 = permanent)
  hpBonus?: number;  // bonus max HP while forma is active
  auraBonus?: number; // bonus max Aura while forma is active
}

// ─────────────────────────────────────────────────────────────────
//  Grid de Combate — Tipos Novos
// ─────────────────────────────────────────────────────────────────

export interface StatPopup {
  id: string;
  combatId: string;
  type: 'hp' | 'aura' | 'ammo';
  delta: number;
}

export type GridInteractionMode =
  | { type: 'select' }
  | { type: 'target-single' }
  | { type: 'target-area' }
  | { type: 'item-target' }
  | { type: 'union' };

export type ToolbarMode =
  | 'none'
  | 'ruler'
  | 'aoe-circle'
  | 'aoe-cone'
  | 'aoe-line'
  | 'fog-reveal'
  | 'fog-hide';

export interface FogState {
  density: number;        // resolução do pincel de névoa (ex: 20 → grade 20×20), independente de gridDensity
  revealed: boolean[][];  // [row][col]
}

export type AoEShape = 'circle' | 'cone' | 'line';

export interface AoETemplate {
  id: string;
  shape: AoEShape;
  color: string;          // ex: '#ef444466'
  label?: string;
  x: number;              // origem em % da arena (0–100)
  y: number;              // origem em % da arena (0–100)
  radius?: number;         // circle: raio em % width
  angle?: number;          // cone/line: direção em graus (0 = direita)
  arc?: number;            // cone: abertura em graus
  length?: number;         // cone/line: comprimento em % width
  width?: number;          // line: largura em % width
  visibleToPlayers: boolean;
}

// ─────────────────────────────────────────────────────────────────
//  Stacks de Personagem
// ─────────────────────────────────────────────────────────────────
export interface CharacterStack {
  id: string;
  name: string;
  color: string;      // hex or css color
  current: number;
  max: number;
}

export interface Character {
  id: string;
  name: string;
  icon: string;
  /** CSS `object-position`/`background-position` do retrato (ex.: "50% 30%"). */
  iconPosition?: string;
  bannerImage?: string;
  bannerImagePosition?: string;
  maxHp: number;
  currentHp: number;
  maxAura: number;
  currentAura: number;
  maxAmmo: number;
  currentAmmo: number;
  baseInitiative: number;
  defense?: number;   // defesa para teste de acerto (default DEFAULT_DEFENSE)
  defenseMax?: number;
  defenseCurrent?: number;
  defenseReduction?: number;
  defenseRegeneration?: number;
  defenseActivationThreshold?: number;
  staggerMax?: number;
  staggerCurrent?: number;
  staggerRecovery?: number;
  staggerDamageMultiplier?: number;
  staggerDuration?: number;
  isDefenseBroken?: boolean;
  isStaggered?: boolean;
  staggerTurnsRemaining?: number;
  speed?: number;          // velocidade base; influencia iniciativa e ordem efetiva
  cardIds: string[];
  pinnedCardIds?: string[];
  weaponIds?: string[];
  sealIds?: string[];
  conditions: Condition[];
  isInJourney?: boolean;
  items: Item[];
  isHidden?: boolean;
  /** @deprecated Mantido apenas para abrir arquivos antigos. Todos agora são personagens. */
  role?: 'cast' | 'npc';
  code?: string;
  bonds?: string[]; // list of vínculo names this character has
  stacks?: CharacterStack[];
  ownedItems?: OwnedItem[]; // posse referenciada (catálogo global)
  /** Acervo unificado do grimório (substituirá cardIds/sealIds/weaponIds/ownedItems na Fase 3). */
  grimoire?: GrimoireHolding[];
  /** Estado canônico de posse/equipamento. Os campos legados acima seguem como adaptadores da UI atual. */
  arsenal?: ArsenalHolding[];
  /** Efeitos canônicos atualmente aplicados diretamente ao personagem. */
  activeEffects?: Array<{ effect: ArsenalEffect; stacks: number; remaining?: number; sourceId?: string; appliedAtRound?: number; metadata?: Record<string, unknown> }>;
  /** Afinidades elementais: fraco / resistente / imune por elemento. */
  affinities?: Partial<Record<Element, Affinity>>;
}

/** Defesa padrão quando o personagem não tem `defense` definido. */
export const DEFAULT_DEFENSE = 10;

export interface Combatant extends Character {
  combatId: string;
  initiativeResult: number;
  gridPos: { x: number; y: number }; // legado — mantido para migration
  pos: { x: number; y: number };     // novo: % da arena (0–100)
}

export interface CombatHistoryItem {
  id: string;
  round: number;
  actor: string;
  target?: string;
  cardName: string;
  roll: number;
  damageDealt?: number;
  dc?: number;
  reactionRoll?: number;
  isSuccess: boolean;
  timestamp: number;
}

export interface CustomPin {
  id: string;
  label: string;
  color: string;
  gridPos: { x: number; y: number };
}

export interface CombatantUnion {
  id: string;
  combatantIds: string[];
  color: string;
}

export interface CombatState {
  isActive: boolean;
  round: number;
  turnIndex: number;
  combatants: Combatant[];
  history: CombatHistoryItem[];
  backgroundImage: string;
  globalBonus: number;
  gridWidth: number;
  gridHeight: number;
  visualWidthPct: number;
  visualHeightPx: number;
  maintainAspectRatio: boolean;
  savedState?: CombatState | null;
  customPins?: CustomPin[];
  unions?: CombatantUnion[];
  activeForms?: ActiveForma[];
  // Novos campos da refatoração da grid
  gridVisible: boolean;
  gridDensity: number;        // ex: 10 → grade 10×10 visual
  fog?: FogState;
  aoeTemplates?: AoETemplate[];
}

// ─────────────────────────────────────────────────────────────────
//  Receitas (Cozinhar & Forjar)
// ─────────────────────────────────────────────────────────────────
export type RecipeType = 'cozinhar' | 'forjar';

export interface RecipeIngredient {
  itemName: string;   // nome do item consumido
  quantity: number;   // quantidade necessária
}

export interface Recipe {
  id: string;
  type: RecipeType;
  name: string;               // nome do resultado
  description: string;
  resultItemName: string;     // nome do item criado
  resultQuantity: number;     // quantidade criada
  resultDescription: string;
  resultImage?: string;
  resultCategory?: string;
  ingredients: RecipeIngredient[];
  craftingTime?: string;      // tempo estimado (ex: "1 hora")
  difficulty?: 'fácil' | 'médio' | 'difícil';
}

// ─────────────────────────────────────────────────────────────────
//  Sistema de Upgrades (Loja)
// ─────────────────────────────────────────────────────────────────
export type UpgradeOfferType =
  | 'vitalidade'    // raro baixo — mais aparição
  | 'aura'          // mais aparição
  | 'reroll'        // média aparição
  | 'par'           // média aparição
  | 'trinca'        // baixa aparição
  | 'quadra'        // baixa aparição
  | 'nova_carta'    // baixa aparição
  | 'desejo';       // baixíssima aparição

export type UpgradeLuck = 'sorte' | 'neutro' | 'azar';

export interface UpgradeOffer {
  id: string;
  type: UpgradeOfferType;
  label: string;
  description: string;
  basePrice: number;
  finalPrice: number;      // after luck modifier
  priceModifier: number;   // 1.0 = normal, < 1.0 = discount, > 1.0 = increase
  value?: number;          // HP/Aura amount, or number of cards for par/trinca/quadra
  cardId?: string;         // for nova_carta
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
}

export interface UpgradeShopState {
  offers: UpgradeOffer[];
  luck: UpgradeLuck;
  offerCount: number;
  currency: number;       // moedas do grupo
  rerollsUsed: number;
}

export interface JourneyState {
  locationName: string;
  description: string;
  image: string;
  weather: 'sunny' | 'rain' | 'storm' | 'fog' | 'snow' | 'night';
  isNight?: boolean;
  weatherEffects?: ('rain' | 'storm' | 'fog' | 'snow')[];
  notes: string;
  history?: JourneyState[];
  future?: JourneyState[];
  recipes?: Recipe[];
  upgradeShop?: UpgradeShopState;
}

// ─────────────────────────────────────────────────────────────────
//  Selos
// ─────────────────────────────────────────────────────────────────
export type SealExecutionMode = 'immediate' | 'preparation' | 'combo';
export type SealExecutionModes = SealExecutionMode[];
export type SealDamageModTarget = 'none' | 'cardType' | 'element';

export interface SealRequirement {
  type: 'specificCharacter' | 'linkedCard' | 'itemCount' | 'minHp' | 'minAura' | 'hasVinculo';
  characterId?: string;
  cardId?: string;
  itemName?: string;
  itemQuantity?: number;
  value?: number; // for minHp/minAura (percentage 0-100)
  vinculoName?: string; // for hasVinculo requirement
}

export interface SealCost {
  hp?: number;
  aura?: number;
  ammo?: number;
  itemName?: string;
  itemQuantity?: number;
}

export interface Seal {
  id: string;
  name: string;
  code: string;
  image: string;
  description: string;
  diceRoll?: string;
  dc?: number;
  damage?: number;
  damageType?: DamageType;
  healAura?: number;
  healHp?: number;
  conditionEffect?: string;
  conditionDuration?: number;
  effects?: ArsenalEffect[];
  cooldown?: CooldownConfig;
  charges?: ChargeConfig | null;
  combatTargeting?: "self" | "other" | "area" | "choice";
  directionMode?: 'source_to_target' | 'target_to_source' | 'around_user' | 'line' | 'cone' | 'free';
  range?: number;
  areaSize?: number;
  connectors?: Array<'top' | 'right' | 'bottom' | 'left' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'>;
  ritualKey?: string;
  ritualRole?: 'nucleo' | 'condutor' | 'amplificador' | 'estabilizador' | 'material';
  rotationAllowed?: boolean;
  maxPerRitual?: number | null;
  connectionTags?: string[];
  forbiddenConnectionTags?: string[];
  duration?: number;
  damageModTarget?: SealDamageModTarget;
  damageModCardType?: string;
  damageModElement?: string;
  damageModValue?: number;
  damageModPercent?: number;
  executionMode?: SealExecutionMode;
  executionModes?: SealExecutionMode[]; // multiple modes allowed
  symbol?: string; // text or image URL for ritual animation
  preparationRounds?: number;
  comboMinUsers?: number;
  comboMaxUsers?: number;
  cost?: SealCost;
  requirements?: SealRequirement[];
  isHidden?: boolean;
}

export interface ActiveSeal {
  combatantId: string;
  sealId: string;
  roundsRemaining: number;
}

export interface SealPreparation {
  combatantId: string;
  sealId: string;
  roundsRemaining: number;
  participantIds?: string[];
}

// ─────────────────────────────────────────────────────────────────
//  Preset Conditions (universais)
// ─────────────────────────────────────────────────────────────────
export interface PresetConditionTemplate {
  name: string;
  emoji: string;
  description: string;
  color: string;
  defaultDuration: number;
  /** default damage/value used in the effect */
  defaultValue?: number;
  /** default dice for paralysis check */
  defaultDice?: string;
  /** minimum roll needed (for Paralisado) */
  defaultMinRoll?: number;
  damageType?: DamageType;
  /** Efeito aplicado no início do turno do portador. */
  perTurn?: 'damage' | 'heal';
}

export const PRESET_CONDITIONS: PresetConditionTemplate[] = [
  {
    name: 'Queimando',
    emoji: '🔥',
    description: 'Recebe X de dano de fogo por turno',
    color: '#ef4444',
    defaultDuration: 3,
    defaultValue: 3,
    damageType: 'fogo',
    perTurn: 'damage',
  },
  {
    name: 'Eletrocutado',
    emoji: '⚡',
    description: 'Recebe X de dano elétrico por turno',
    color: '#facc15',
    defaultDuration: 2,
    defaultValue: 3,
    damageType: 'raio',
    perTurn: 'damage',
  },
  {
    name: 'Molhado',
    emoji: '💧',
    description: 'Recebe +X de dano ao sofrer ataque elétrico',
    color: '#38bdf8',
    defaultDuration: 4,
    defaultValue: 5,
    damageType: 'água',
  },
  {
    name: 'Envenenado',
    emoji: '🧪',
    description: 'Recebe X de dano por turno',
    color: '#a3e635',
    defaultDuration: 4,
    defaultValue: 2,
    perTurn: 'damage',
  },
  {
    name: 'Paralisado',
    emoji: '🔒',
    description: 'Deve rolar 1dX e obter pelo menos Y, ou a ação falha',
    color: '#94a3b8',
    defaultDuration: 2,
    defaultValue: 10,
    defaultDice: '1d20',
    defaultMinRoll: 10,
  },
  {
    name: 'Desnorteado',
    emoji: '😵',
    description: 'Não consegue agir no turno',
    color: '#f97316',
    defaultDuration: 1,
  },
  {
    name: 'Dormindo',
    emoji: '💤',
    description: 'Não consegue agir no turno',
    color: '#818cf8',
    defaultDuration: 2,
  },
  {
    name: 'Sangrando',
    emoji: '🩸',
    description: 'Recebe X de dano de sangue por turno',
    color: '#dc2626',
    defaultDuration: 3,
    defaultValue: 2,
    damageType: 'sangue',
    perTurn: 'damage',
  },
  {
    name: 'Amaldiçoado',
    emoji: '💀',
    description: 'Penalidade de X nas rolagens',
    color: '#7c3aed',
    defaultDuration: 3,
    defaultValue: 2,
  },
  {
    name: 'Amedrontado',
    emoji: '😱',
    description: 'Não pode se aproximar da fonte do medo; penalidade nas ações',
    color: '#c084fc',
    defaultDuration: 2,
  },
  {
    name: 'Confuso',
    emoji: '🌀',
    description: 'Ações são determinadas aleatoriamente (atacar aliado, ficar parado etc.)',
    color: '#fb7185',
    defaultDuration: 2,
  },
  {
    name: 'Cego',
    emoji: '🌑',
    description: 'Não consegue ver; penalidade severa em ataques e esquivas',
    color: '#334155',
    defaultDuration: 2,
  },
  {
    name: 'Imobilizado',
    emoji: '🧲',
    description: 'Não pode se mover, mas pode agir normalmente',
    color: '#b45309',
    defaultDuration: 2,
  },
  {
    name: 'Regenerando',
    emoji: '💚',
    description: 'Recupera X de HP por turno',
    color: '#22c55e',
    defaultDuration: 3,
    defaultValue: 3,
    perTurn: 'heal',
  },
  {
    name: 'Protegido',
    emoji: '🛡',
    description: 'Reduz dano recebido por X',
    color: '#64748b',
    defaultDuration: 2,
    defaultValue: 3,
  },
];
