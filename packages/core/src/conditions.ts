import type { Element } from './rules/elements';

/** Condições predefinidas (os 15 presets do legado), com ids ASCII. Os rótulos em PT ficam em `label`. */
export type ConditionId =
  | 'queimando' | 'eletrocutado' | 'molhado' | 'envenenado' | 'paralisado'
  | 'desnorteado' | 'dormindo' | 'sangrando' | 'amaldicoado' | 'amedrontado'
  | 'confuso' | 'cego' | 'imobilizado' | 'regenerando' | 'protegido';

export interface ConditionDef {
  id: ConditionId;
  label: string;
  emoji: string;
  /** Efeito aplicado no início do turno do alvo. */
  perTurn?: { kind: 'damage' | 'heal'; value: number; element?: Element };
  skipsTurn?: boolean;
  attackPenalty?: number;
  damageReduction?: number;
  preventsMove?: boolean;
  /** Rodadas que faltam ao aplicar sem duração explícita. */
  defaultDuration: number;
}

export const CONDITION_PRESETS: Record<ConditionId, ConditionDef> = {
  queimando: { id: 'queimando', label: 'Queimando', emoji: '🔥', perTurn: { kind: 'damage', value: 3, element: 'fogo' }, defaultDuration: 3 },
  eletrocutado: { id: 'eletrocutado', label: 'Eletrocutado', emoji: '⚡', perTurn: { kind: 'damage', value: 3, element: 'raio' }, defaultDuration: 2 },
  molhado: { id: 'molhado', label: 'Molhado', emoji: '💧', defaultDuration: 4 },
  envenenado: { id: 'envenenado', label: 'Envenenado', emoji: '🧪', perTurn: { kind: 'damage', value: 2 }, defaultDuration: 4 },
  paralisado: { id: 'paralisado', label: 'Paralisado', emoji: '🔒', defaultDuration: 2 },
  desnorteado: { id: 'desnorteado', label: 'Desnorteado', emoji: '😵', skipsTurn: true, defaultDuration: 1 },
  dormindo: { id: 'dormindo', label: 'Dormindo', emoji: '💤', skipsTurn: true, defaultDuration: 2 },
  sangrando: { id: 'sangrando', label: 'Sangrando', emoji: '🩸', perTurn: { kind: 'damage', value: 2, element: 'sangue' }, defaultDuration: 3 },
  amaldicoado: { id: 'amaldicoado', label: 'Amaldiçoado', emoji: '💀', attackPenalty: 2, defaultDuration: 3 },
  amedrontado: { id: 'amedrontado', label: 'Amedrontado', emoji: '😱', defaultDuration: 2 },
  confuso: { id: 'confuso', label: 'Confuso', emoji: '🌀', defaultDuration: 2 },
  cego: { id: 'cego', label: 'Cego', emoji: '🌑', defaultDuration: 2 },
  imobilizado: { id: 'imobilizado', label: 'Imobilizado', emoji: '🧲', preventsMove: true, defaultDuration: 2 },
  regenerando: { id: 'regenerando', label: 'Regenerando', emoji: '💚', perTurn: { kind: 'heal', value: 3 }, defaultDuration: 3 },
  protegido: { id: 'protegido', label: 'Protegido', emoji: '🛡', damageReduction: 3, defaultDuration: 2 },
};

export const CONDITION_IDS = Object.keys(CONDITION_PRESETS) as ConditionId[];

export const isConditionId = (v: unknown): v is ConditionId =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(CONDITION_PRESETS, v);
