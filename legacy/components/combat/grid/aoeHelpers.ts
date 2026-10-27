export function conePathD(
  cx: number, cy: number,
  angleDeg: number, arcDeg: number, length: number,
): string {
  const half = arcDeg / 2;
  const a1 = (angleDeg - half) * (Math.PI / 180);
  const a2 = (angleDeg + half) * (Math.PI / 180);
  const x1 = cx + length * Math.cos(a1);
  const y1 = cy + length * Math.sin(a1);
  const x2 = cx + length * Math.cos(a2);
  const y2 = cy + length * Math.sin(a2);
  const large = arcDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${length} ${length} 0 ${large} 1 ${x2} ${y2} Z`;
}

export function linePathD(
  cx: number, cy: number,
  angleDeg: number, length: number, width: number,
): string {
  const a = angleDeg * (Math.PI / 180);
  const perp = a + Math.PI / 2;
  const hw = width / 2;
  const ex = cx + length * Math.cos(a);
  const ey = cy + length * Math.sin(a);
  const p1x = cx + hw * Math.cos(perp); const p1y = cy + hw * Math.sin(perp);
  const p2x = cx - hw * Math.cos(perp); const p2y = cy - hw * Math.sin(perp);
  const p3x = ex - hw * Math.cos(perp); const p3y = ey - hw * Math.sin(perp);
  const p4x = ex + hw * Math.cos(perp); const p4y = ey + hw * Math.sin(perp);
  return `M ${p1x} ${p1y} L ${p4x} ${p4y} L ${p3x} ${p3y} L ${p2x} ${p2y} Z`;
}

/** Distância entre dois pontos em % de largura de arena, corrigida pelo aspect ratio. */
export function correctedDist(
  a: { x: number; y: number },
  b: { x: number; y: number },
  aspectRatio: number, // w / h
): number {
  const dx = b.x - a.x;
  const dy = (b.y - a.y) / aspectRatio;
  return Math.sqrt(dx * dx + dy * dy);
}
