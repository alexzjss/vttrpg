/** Elementos de dano, afinidades e interações elementais com as condições do alvo. Funções puras. */

export type Element = 'fisico' | 'fogo' | 'raio' | 'agua' | 'terra' | 'vento' | 'escuridao' | 'luminoso' | 'sangue' | 'aura';

export const ELEMENTS: readonly Element[] = ['fisico', 'fogo', 'raio', 'agua', 'terra', 'vento', 'escuridao', 'luminoso', 'sangue', 'aura'];

export type Affinity = 'fraco' | 'resistente' | 'imune';

/** fraco ×1.5, resistente ×0.5, imune ×0, sem afinidade ×1. */
export function affinityMultiplier(affinity?: Affinity): number {
  if (affinity === 'fraco') return 1.5;
  if (affinity === 'resistente') return 0.5;
  if (affinity === 'imune') return 0;
  return 1;
}

export interface ConditionApplication {
  id: string;
  duration: number;
}

/** O que uma interação elemental faz com o dano e as condições do alvo. */
export interface ElementInteraction {
  multiplier: number;
  flatBonus: number;
  remove: string[];
  renew: ConditionApplication[];
  add: ConditionApplication[];
}

/** Molhado: 2 rodadas (combate v2, mais curto que o defaultDuration do preset). */
const WET_DURATION = 2;
/** Bônus flat do raio em alvo Molhado (defaultValue do preset Molhado). */
const WET_FLAT_BONUS = 5;
/** Duração de Queimando ao ser reavivado (defaultDuration do preset Queimando). */
const BURN_DURATION = 3;

/** Tabela de interações elemento × condições do alvo (as 3 regras do legado). */
export function elementInteraction(element: Element, conditionIds: string[]): ElementInteraction {
  const has = (id: string): boolean => conditionIds.includes(id);
  const result: ElementInteraction = { multiplier: 1, flatBonus: 0, remove: [], renew: [], add: [] };

  if (element === 'agua') {
    result.add.push({ id: 'molhado', duration: WET_DURATION });
    if (has('queimando')) result.remove.push('queimando');
  }

  if (element === 'raio' && has('molhado')) {
    result.flatBonus = WET_FLAT_BONUS;
    result.remove.push('molhado');
  }

  if (element === 'fogo') {
    if (has('molhado')) {
      result.multiplier = 0.5;
      result.remove.push('molhado');
    }
    if (has('queimando')) result.renew.push({ id: 'queimando', duration: BURN_DURATION });
  }

  return result;
}
