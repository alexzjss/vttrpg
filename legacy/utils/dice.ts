export interface RollResult {
  total: number;
  dieRoll: number;
  bonus: number;
  notation: string;
  /** Resultado de cada dado individual */
  individualRolls: number[];
  numSides: number;
  numDice: number;
}

import { consumeForcedNext, readDiceControl } from './diceControl';

export const rollDice = (notation: string = "1d20", globalBonus: number = 0): RollResult => {
  const match = notation.match(/(\d+)d(\d+)([+-]\d+)?/);
  if (!match) return { total: 0, dieRoll: 0, bonus: 0, notation: "invalid", individualRolls: [], numSides: 20, numDice: 1 };

  const numDice = parseInt(match[1]);
  const numSides = parseInt(match[2]);
  const notationBonus = match[3] ? parseInt(match[3]) : 0;

  const control = readDiceControl();
  const forced = consumeForcedNext();
  const naturalMin = numDice;
  const naturalMax = numDice * numSides;
  const configured = control.allowedValues.filter(v => v >= naturalMin && v <= naturalMax);
  const lower = Math.max(naturalMin, control.min ?? naturalMin);
  const upper = Math.min(naturalMax, control.max ?? naturalMax);
  const pool = configured.length ? configured.filter(v => v >= lower && v <= upper) : [];
  let desired: number | null = null;
  if (control.enabled) {
    if (forced != null) desired = Math.max(naturalMin, Math.min(naturalMax, forced));
    else if (pool.length) desired = pool[Math.floor(Math.random() * pool.length)];
    else if (lower <= upper) desired = lower + Math.floor(Math.random() * (upper - lower + 1));
  }

  const individualRolls: number[] = [];
  if (desired != null) {
    let remaining = desired;
    for (let i = 0; i < numDice; i++) {
      const diceLeft = numDice - i - 1;
      const value = Math.max(1, Math.min(numSides, remaining - diceLeft));
      individualRolls.push(value); remaining -= value;
    }
    // Embaralha a composição sem alterar o total, evitando padrões visíveis.
    individualRolls.sort(() => Math.random() - .5);
  } else {
    for (let i = 0; i < numDice; i++) individualRolls.push(Math.floor(Math.random() * numSides) + 1);
  }

  const dieRoll = individualRolls.reduce((a, b) => a + b, 0);
  const totalBonus = notationBonus + globalBonus + (control.enabled ? control.defaultAdjustment : 0);

  return {
    dieRoll,
    bonus: totalBonus,
    total: dieRoll + totalBonus,
    notation: `${numDice}d${numSides}${totalBonus !== 0 ? (totalBonus >= 0 ? '+' : '') + totalBonus : ''}`,
    individualRolls,
    numSides,
    numDice,
  };
};
