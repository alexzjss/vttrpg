import type { DamageType } from '../types';

/** Cor de destaque por tipo de dano, usada nos efeitos visuais de alvo (partículas, número flutuante). */
export const DAMAGE_COLORS: Record<DamageType, string> = {
  fisico: '#cbd5e1',
  fogo: '#ff6a2b',
  raio: '#f5d90a',
  'água': '#38bdf8',
  terra: '#a9764a',
  vento: '#86efac',
  'escuridão': '#7c3aed',
  luminoso: '#fde68a',
  sangue: '#9f1239',
  aura: '#e879f9',
};

export const damageColorOf = (damageType?: DamageType): string => damageType ? DAMAGE_COLORS[damageType] : '#ff304f';
