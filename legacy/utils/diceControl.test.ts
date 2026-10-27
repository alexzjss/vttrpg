import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rollDice } from './dice';
import { DEFAULT_DICE_CONTROL, readDiceControl, writeDiceControl } from './diceControl';

describe('controle secreto dos dados', () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it('mantém a rolagem normal quando desativado', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(rollDice('1d20+2').total).toBe(3);
  });

  it('sorteia somente entre os valores permitidos e aplica redução padrão', () => {
    writeDiceControl({ ...DEFAULT_DICE_CONTROL, enabled: true, allowedValues: [7, 12], defaultAdjustment: -2 });
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const result = rollDice('1d20');
    expect(result.dieRoll).toBe(7);
    expect(result.total).toBe(5);
  });

  it('respeita a faixa em dados múltiplos e preserva faces válidas', () => {
    writeDiceControl({ ...DEFAULT_DICE_CONTROL, enabled: true, min: 9, max: 9 });
    const result = rollDice('2d6');
    expect(result.dieRoll).toBe(9);
    expect(result.individualRolls).toHaveLength(2);
    expect(result.individualRolls.every(n => n >= 1 && n <= 6)).toBe(true);
  });

  it('consome o próximo resultado forçado apenas uma vez', () => {
    writeDiceControl({ ...DEFAULT_DICE_CONTROL, enabled: true, min: 1, max: 1, forcedNext: 20 });
    expect(rollDice('1d20').dieRoll).toBe(20);
    expect(readDiceControl().forcedNext).toBeNull();
    expect(rollDice('1d20').dieRoll).toBe(1);
  });
});
