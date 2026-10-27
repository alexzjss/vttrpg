/** Cor de um gomo aceso (turno já passado ou atual) e de um gomo apagado (turno futuro na rodada). */
const LIT_COLOR = '#d9b56f';
const UNLIT_COLOR = '#3a3f47';

/**
 * Monta um conic-gradient com `total` gomos fixos (1 por combatente vivo na ordem de turno).
 * Os primeiros `litSegments` gomos ficam acesos; o resto fica apagado. Um pequeno gap separa os gomos.
 */
export function buildClockGradient(total: number, litSegments: number): string {
  if (total <= 0) return `conic-gradient(${UNLIT_COLOR} 0deg 360deg)`;
  const segDeg = 360 / total;
  const gapDeg = Math.min(6, segDeg / 4);
  const stops: string[] = [];
  for (let i = 0; i < total; i++) {
    const start = i * segDeg;
    const end = start + segDeg - gapDeg;
    const color = i < litSegments ? LIT_COLOR : UNLIT_COLOR;
    stops.push(`${color} ${start}deg ${end}deg`, `transparent ${end}deg ${start + segDeg}deg`);
  }
  return `conic-gradient(${stops.join(',')})`;
}
