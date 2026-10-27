function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function lerpColor(c1: [number, number, number], c2: [number, number, number], t: number): string {
  const r = Math.round(lerp(c1[0], c2[0], t));
  const g = Math.round(lerp(c1[1], c2[1], t));
  const b = Math.round(lerp(c1[2], c2[2], t));
  return `rgb(${r},${g},${b})`;
}

const HP_GOLD: [number, number, number] = [255, 246, 216];
const HP_AMBER: [number, number, number] = [232, 162, 60];
const HP_RED: [number, number, number] = [255, 47, 61];

export function getHpGlowColor(pct: number): string {
  if (pct >= 50) return lerpColor(HP_AMBER, HP_GOLD, (pct - 50) / 50);
  return lerpColor(HP_RED, HP_AMBER, pct / 50);
}

export function getHpGlowStrength(pct: number): string {
  return `${Math.round(lerp(6, 16, 1 - pct / 100))}px`;
}

export function isHpCritical(pct: number): boolean {
  return pct <= 20;
}
