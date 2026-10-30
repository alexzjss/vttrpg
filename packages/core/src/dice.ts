export type Rng = () => number;

export interface DiceTerm {
  count: number;
  sides: number;
  keep?: { mode: 'kh' | 'kl'; n: number };
}

export interface DiceExpr {
  terms: Array<{ sign: 1 | -1; term: DiceTerm | number }>;
}

export interface DiceGroup {
  sides: number;
  rolled: number[];
  kept: number[];
  sign: 1 | -1;
}

export interface DiceRoll {
  notation: string;
  groups: DiceGroup[];
  modifier: number;
  total: number;
  natural: number | null;
}

export type PhysicalRoll = { total: number } | { dice: number[] };

const MAX_TERMS = 10;
const DICE_RE = /^(\d*)d(\d+)(?:(kh|kl)(\d+))?$/;

function parseTerm(text: string): DiceTerm | number | null {
  if (/^\d{1,9}$/.test(text)) return Number(text);
  const m = DICE_RE.exec(text);
  if (!m) return null;
  const count = m[1] === '' ? 1 : Number(m[1]);
  const sides = Number(m[2]);
  if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null;
  if (!m[3]) return { count, sides };
  const n = Number(m[4]);
  if (n < 1 || n > count) return null;
  return { count, sides, keep: { mode: m[3] as 'kh' | 'kl', n } };
}

export function parseDice(notation: string): DiceExpr | null {
  const text = notation.replace(/\s+/g, '').toLowerCase();
  if (!text) return null;
  // partes alternam termo, operador, termo...
  const parts = text.split(/([+-])/);
  if ((parts.length + 1) / 2 > MAX_TERMS) return null;
  const terms: DiceExpr['terms'] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const term = parseTerm(parts[i]);
    if (term === null) return null;
    terms.push({ sign: i === 0 || parts[i - 1] === '+' ? 1 : -1, term });
  }
  return { terms };
}

export function formatDice(expr: DiceExpr): string {
  return expr.terms
    .map(({ sign, term }, i) => {
      const body =
        typeof term === 'number'
          ? String(term)
          : `${term.count}d${term.sides}${term.keep ? term.keep.mode + term.keep.n : ''}`;
      return (sign === -1 ? '-' : i === 0 ? '' : '+') + body;
    })
    .join('');
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function diceBounds(expr: DiceExpr): { min: number; max: number } {
  let min = 0;
  let max = 0;
  for (const { sign, term } of expr.terms) {
    const n = typeof term === 'number' ? 1 : (term.keep?.n ?? term.count);
    const lo = typeof term === 'number' ? term : n;
    const hi = typeof term === 'number' ? term : n * term.sides;
    if (sign === 1) {
      min += lo;
      max += hi;
    } else {
      min -= hi;
      max -= lo;
    }
  }
  return { min, max };
}

function keepDice(rolled: number[], keep: DiceTerm['keep']): number[] {
  if (!keep) return [...rolled];
  const order = rolled
    .map((v, i) => ({ v, i }))
    .sort((a, b) => (keep.mode === 'kh' ? b.v - a.v : a.v - b.v) || a.i - b.i);
  const chosen = new Set(order.slice(0, keep.n).map((o) => o.i));
  return rolled.filter((_, i) => chosen.has(i));
}

function assemble(expr: DiceExpr, rolledByGroup: number[][]): DiceRoll {
  const groups: DiceGroup[] = [];
  let modifier = 0;
  let g = 0;
  for (const { sign, term } of expr.terms) {
    if (typeof term === 'number') {
      modifier += sign * term;
      continue;
    }
    const rolled = rolledByGroup[g++];
    groups.push({ sides: term.sides, rolled, kept: keepDice(rolled, term.keep), sign });
  }
  const total = modifier + sum(groups.map((x) => x.sign * sum(x.kept)));
  const d20s = groups.filter((x) => x.sides === 20);
  const natural = d20s.length === 1 && d20s[0].sign === 1 && d20s[0].kept.length === 1 ? d20s[0].kept[0] : null;
  return { notation: formatDice(expr), groups, modifier, total, natural };
}

export function rollDice(expr: DiceExpr, rng: Rng): DiceRoll {
  const rolledByGroup: number[][] = [];
  for (const { term } of expr.terms) {
    if (typeof term === 'number') continue;
    rolledByGroup.push(Array.from({ length: term.count }, () => 1 + Math.floor(rng() * term.sides)));
  }
  return assemble(expr, rolledByGroup);
}

/** Valida uma rolagem física; com `{ total }` não há como saber o natural (fica null). */
export function physicalRoll(expr: DiceExpr, input: PhysicalRoll): DiceRoll | null {
  if (typeof input !== 'object' || input === null) return null;
  if ('total' in input) {
    const { min, max } = diceBounds(expr);
    if (typeof input.total !== 'number' || !Number.isInteger(input.total) || input.total < min || input.total > max) return null;
    const modifier = sum(expr.terms.map((t) => (typeof t.term === 'number' ? t.sign * t.term : 0)));
    return { notation: formatDice(expr), groups: [], modifier, total: input.total, natural: null };
  }
  if (!Array.isArray(input.dice)) return null;
  const diceTerms = expr.terms.flatMap(({ term }) => (typeof term === 'number' ? [] : [term]));
  if (input.dice.length !== sum(diceTerms.map((t) => t.count))) return null;
  const rolledByGroup: number[][] = [];
  let at = 0;
  for (const t of diceTerms) {
    const rolled = input.dice.slice(at, at + t.count);
    at += t.count;
    if (!rolled.every((d) => Number.isInteger(d) && d >= 1 && d <= t.sides)) return null;
    rolledByGroup.push(rolled);
  }
  return assemble(expr, rolledByGroup);
}

/**
 * Crítico: dobra a soma dos dados, sem dobrar o modificador. Só `total` é atualizado:
 * `groups` continua com os dados originais, então não recalcule o total a partir deles.
 * Em rolagem só com total (`groups` vazio), a parte dos dados é `total - modifier`.
 */
export function doubleDice(roll: DiceRoll): DiceRoll {
  const diceSum = roll.groups.length
    ? sum(roll.groups.map((g) => g.sign * sum(g.kept)))
    : roll.total - roll.modifier;
  return { ...roll, total: roll.total + diceSum };
}

/** mulberry32: gerador determinístico para os testes. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
