import { describe, expect, it } from 'vitest';
import { diceBounds, doubleDice, formatDice, parseDice, physicalRoll, rollDice, seededRng } from './dice';
import type { DiceExpr } from './dice';

function parse(n: string): DiceExpr {
  const e = parseDice(n);
  if (!e) throw new Error('notação inválida: ' + n);
  return e;
}

describe('parseDice', () => {
  it('lê termos somados e formata de volta', () => {
    const e = parse('2d6+1d4+3');
    expect(e.terms).toHaveLength(3);
    expect(formatDice(e)).toBe('2d6+1d4+3');
  });
  it('lê kh/kl e d20 sem N', () => {
    expect(parse('2d20kh1').terms[0].term).toEqual({ count: 2, sides: 20, keep: { mode: 'kh', n: 1 } });
    expect(parse('d20').terms[0].term).toEqual({ count: 1, sides: 20 });
    expect(formatDice(parse('2d20kl1-2'))).toBe('2d20kl1-2');
  });
  it('ignora espaços', () => {
    expect(formatDice(parse(' 1d8 + 3 - 1d4 '))).toBe('1d8+3-1d4');
  });
  it.each(['0d6', '1d1', '101d6', '1d1001', '2d6kh3', '2d6kh0', 'abc', '', '1d6+', '+1d6', '1d6++2'])(
    'rejeita %j',
    (n) => {
      expect(parseDice(n)).toBeNull();
    },
  );
  it('aceita 10 termos e rejeita 11', () => {
    expect(parseDice(Array(10).fill('1d4').join('+'))).not.toBeNull();
    expect(parseDice(Array(11).fill('1d4').join('+'))).toBeNull();
  });
});

describe('diceBounds', () => {
  it('calcula mínimo e máximo', () => {
    expect(diceBounds(parse('2d6+3'))).toEqual({ min: 5, max: 15 });
    expect(diceBounds(parse('1d20-2'))).toEqual({ min: -1, max: 18 });
    expect(diceBounds(parse('2d20kh1'))).toEqual({ min: 1, max: 20 });
    expect(diceBounds(parse('4d6kh3'))).toEqual({ min: 3, max: 18 });
    expect(diceBounds(parse('5-1d4'))).toEqual({ min: 1, max: 4 });
  });
});

describe('rollDice', () => {
  it('2d20kh1 mantém o maior e preenche natural', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = rollDice(parse('2d20kh1'), seededRng(seed));
      expect(r.groups[0].rolled).toHaveLength(2);
      expect(r.groups[0].kept).toEqual([Math.max(...r.groups[0].rolled)]);
      expect(r.natural).toBe(r.groups[0].kept[0]);
      expect(r.total).toBe(r.natural);
    }
  });
  it('kl mantém o menor', () => {
    const r = rollDice(parse('2d20kl1'), seededRng(3));
    expect(r.groups[0].kept).toEqual([Math.min(...r.groups[0].rolled)]);
  });
  it('soma modificador e respeita sinal', () => {
    const r = rollDice(parse('1d20+5-1d4'), () => 0);
    expect(r.modifier).toBe(5);
    expect(r.total).toBe(1 + 5 - 1);
    expect(r.natural).toBeNull();
    expect(rollDice(parse('1d20+5'), () => 0).natural).toBe(1);
    expect(rollDice(parse('1d6'), () => 0.999999).total).toBe(6);
  });
  it('natural é null sem d20 único, com grupo negativo ou vários grupos', () => {
    expect(rollDice(parse('2d6'), seededRng(1)).natural).toBeNull();
    expect(rollDice(parse('2d20'), seededRng(1)).natural).toBeNull();
    expect(rollDice(parse('1d20+1d20'), seededRng(1)).natural).toBeNull();
    expect(rollDice(parse('1d4-1d20'), seededRng(1)).natural).toBeNull();
    expect(rollDice(parse('1d20+1d4'), seededRng(1)).natural).toBeNull();
  });
  it('guarda a notação formatada', () => {
    expect(rollDice(parse(' d20 + 2'), seededRng(1)).notation).toBe('1d20+2');
  });
});

describe('physicalRoll', () => {
  it('valida total dentro dos limites', () => {
    expect(physicalRoll(parse('1d20+2'), { total: 23 })).toBeNull();
    expect(physicalRoll(parse('1d20+2'), { total: 2 })).toBeNull();
    expect(physicalRoll(parse('1d20+2'), { total: 1.5 })).toBeNull();
    const r = physicalRoll(parse('1d20+2'), { total: 22 });
    expect(r?.total).toBe(22);
    expect(r?.natural).toBeNull();
  });
  it('valida dados individuais', () => {
    const r = physicalRoll(parse('1d20+2'), { dice: [7] });
    expect(r?.total).toBe(9);
    expect(r?.natural).toBe(7);
    expect(physicalRoll(parse('1d20+2'), { dice: [21] })).toBeNull();
    expect(physicalRoll(parse('1d20+2'), { dice: [0] })).toBeNull();
    expect(physicalRoll(parse('1d20+2'), { dice: [7, 3] })).toBeNull();
    expect(physicalRoll(parse('1d20+2'), { dice: [] })).toBeNull();
    expect(physicalRoll(parse('1d20+2'), { dice: [7.5] })).toBeNull();
  });
  it('distribui dados por grupo em ordem e calcula kept', () => {
    const r = physicalRoll(parse('2d20kh1+1d4'), { dice: [5, 17, 3] });
    expect(r?.groups[0].rolled).toEqual([5, 17]);
    expect(r?.groups[0].kept).toEqual([17]);
    expect(r?.groups[1].rolled).toEqual([3]);
    expect(r?.total).toBe(20);
    expect(r?.natural).toBeNull();
    expect(physicalRoll(parse('2d20kh1'), { dice: [5, 17] })?.natural).toBe(17);
  });
});

describe('doubleDice', () => {
  it('dobra dados mantidos sem dobrar o modificador', () => {
    const base = rollDice(parse('1d8+3'), () => 0.5); // dado 5
    expect(base.total).toBe(8);
    expect(doubleDice(base).total).toBe(13);
  });
  it('respeita o sinal do grupo', () => {
    const base = physicalRoll(parse('1d8-1d4'), { dice: [5, 2] });
    expect(base?.total).toBe(3);
    expect(base && doubleDice(base).total).toBe(6);
  });
});

describe('seededRng', () => {
  it('mesma semente, mesma sequência, valores em [0,1)', () => {
    const a = seededRng(42);
    const b = seededRng(42);
    const sa = Array.from({ length: 10 }, () => a());
    const sb = Array.from({ length: 10 }, () => b());
    expect(sa).toEqual(sb);
    expect(sa.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(seededRng(43)()).not.toBe(sa[0]);
  });
});
