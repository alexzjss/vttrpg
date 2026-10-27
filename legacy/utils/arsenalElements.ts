import type { Element } from '../types';
import type { ArsenalCard } from './arsenal';

export interface ElementalConditionConfig {
  damageType: Element;
  /** Nome (ou id) do preset em getPredefinedEffect a aplicar. */
  conditionName: string;
  chance: number; // 0..1
}

/** Cada elemento pode ter uma chance de aplicar automaticamente uma das 15 condições base ao acertar. */
export const ELEMENTAL_CONDITION_TABLE: ElementalConditionConfig[] = [
  { damageType: 'fogo', conditionName: 'Queimando', chance: 0.20 },
  { damageType: 'água', conditionName: 'Molhado', chance: 0.20 },
  { damageType: 'raio', conditionName: 'Eletrizado', chance: 0.15 },
  { damageType: 'terra', conditionName: 'Enraizado', chance: 0.15 },
  { damageType: 'fisico', conditionName: 'Frágil', chance: 0.10 },
  { damageType: 'sangue', conditionName: 'Sangrando', chance: 0.20 },
];

/** Rola (1-100 via roller) se a carta deve aplicar a condição elemental padrão do seu dano. Retorna o nome do preset ou null. */
export function rollElementalConditionChance(card: ArsenalCard, roller: (notation: string) => number): string | null {
  if (card.applyElementalCondition === false) return null;
  if (!card.element) return null;
  const entry = ELEMENTAL_CONDITION_TABLE.find(item => item.damageType === card.element);
  if (!entry) return null;
  const chance = card.elementalConditionChance ?? entry.chance;
  const roll = roller('1d100');
  return roll <= chance * 100 ? entry.conditionName : null;
}
