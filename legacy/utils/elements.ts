import { PRESET_CONDITIONS } from '../types';
import type { Affinity, Condition, Element } from '../types';

/** fraco ×1.5, resistente ×0.5, imune ×0, sem afinidade ×1. */
export function affinityMultiplier(aff?: Affinity): number {
  if (aff === 'fraco') return 1.5;
  if (aff === 'resistente') return 0.5;
  if (aff === 'imune') return 0;
  return 1;
}

/** O que uma interação elemental faz com o dano e as condições do alvo. */
export interface InteractionResult {
  multiplier: number;
  flatBonus: number;
  removeConditions: string[];
  renewConditions: { name: string; duration: number }[];
  addConditions: { name: string; duration: number }[];
  /** Frases curtas para o log ("o alvo Molhado amplifica o raio (+5)"). */
  notes: string[];
}

const WET_BONUS = PRESET_CONDITIONS.find(p => p.name === 'Molhado')?.defaultValue ?? 0;
const BURN_DURATION = PRESET_CONDITIONS.find(p => p.name === 'Queimando')?.defaultDuration ?? 3;

/**
 * Tabela de interações elemento × condições do alvo (data-driven no futuro;
 * hoje as 5 regras do spec, num único lugar).
 */
export function elementInteraction(element: Element, targetConditions: Condition[]): InteractionResult {
  const has = (n: string) => targetConditions.some(c => c.name === n);
  const res: InteractionResult = {
    multiplier: 1, flatBonus: 0,
    removeConditions: [], renewConditions: [], addConditions: [], notes: [],
  };

  if (element === 'água') {
    // 2 rodadas de propósito (spec combate v2): mais curto que o defaultDuration do preset (4).
    res.addConditions.push({ name: 'Molhado', duration: 2 });
    res.notes.push('a água encharca o alvo (Molhado, 2 rodadas)');
    if (has('Queimando')) {
      res.removeConditions.push('Queimando');
      res.notes.push('as chamas se apagam (remove Queimando)');
    }
  }

  if (element === 'raio' && has('Molhado')) {
    res.flatBonus = WET_BONUS;
    res.removeConditions.push('Molhado');
    res.notes.push(`o alvo Molhado amplifica o raio (+${WET_BONUS})`);
  }

  if (element === 'fogo') {
    if (has('Molhado')) {
      res.multiplier = 0.5;
      res.removeConditions.push('Molhado');
      res.notes.push('a água reduz o fogo (dano ÷2, consome Molhado)');
    }
    if (has('Queimando')) {
      res.renewConditions.push({ name: 'Queimando', duration: BURN_DURATION });
      res.notes.push('as chamas se reavivam (renova Queimando)');
    }
  }

  return res;
}
