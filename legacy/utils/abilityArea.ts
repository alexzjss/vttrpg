import { mergeLevel, type AbilityGraph } from './abilityGraph';
import { reachableNodeIds } from './abilityGraphAction';
import { MOVE_UNIT_PCT } from './movementResolver';

export type AreaShape = 'linha' | 'raio' | 'cone' | 'quadrado';

export interface AreaShapeConfig {
  shape: AreaShape;
  distance: number;
  width: number;
  radius: number;
  range: number;
  angle: number;
  size: number;
}

const AREA_SHAPES = new Set(['linha', 'raio', 'cone', 'quadrado']);

/** Acha o nó 'alvo' geométrico alcançável no grafo mesclado (linha/raio/cone/quadrado) e devolve sua
 *  config, sem rodar o interpretador — usado pela Cena pra pré-visualizar a área no grid antes de resolver
 *  a habilidade de fato. Não roda o interpretador porque a Cena precisa disso já ao armar a habilidade,
 *  antes de qualquer alvo ser escolhido. */
export function graphAreaConfig(graph: AbilityGraph, level: number): AreaShapeConfig | null {
  const merged = mergeLevel(graph, level);
  const reachable = reachableNodeIds(merged);
  const node = merged.nodes.find(n => reachable.has(n.id) && n.type === 'alvo' && AREA_SHAPES.has((n.props as { scope?: string }).scope ?? ''));
  if (!node) return null;
  const props = node.props as Partial<AreaShapeConfig> & { scope: AreaShape };
  return {
    shape: props.scope,
    distance: props.distance ?? 0, width: props.width ?? 0, radius: props.radius ?? 0,
    range: props.range ?? 0, angle: props.angle ?? 0, size: props.size ?? 0,
  };
}

type Pos = { x: number; y: number };

/** Resolve quem é atingido por uma área geométrica, dadas as posições atuais do mapa (`cena.tokens`).
 *  Função pura — mesmo espírito de `movementResolver.ts`: recebe tudo por parâmetro, sem estado da Cena.
 *  `aimAtId` é o alvo clicado pra definir direção (linha/cone); ausente = sem mira ainda, não atinge
 *  ninguém nesses dois formatos (raio/quadrado não precisam de mira, são centrados no próprio ator). */
export function resolveAreaTargets(
  config: AreaShapeConfig,
  originId: string,
  aimAtId: string | null,
  tokens: Record<string, Pos>,
  candidateIds: string[],
): string[] {
  const origin = tokens[originId];
  if (!origin) return [];

  if (config.shape === 'raio') {
    const radiusPct = config.radius * MOVE_UNIT_PCT;
    return candidateIds.filter(id => {
      const pos = tokens[id];
      return !!pos && Math.hypot(pos.x - origin.x, pos.y - origin.y) <= radiusPct;
    });
  }

  if (config.shape === 'quadrado') {
    const halfSidePct = (config.size * MOVE_UNIT_PCT) / 2;
    return candidateIds.filter(id => {
      const pos = tokens[id];
      return !!pos && Math.abs(pos.x - origin.x) <= halfSidePct && Math.abs(pos.y - origin.y) <= halfSidePct;
    });
  }

  // linha/cone precisam de uma direção definida por um alvo mirado.
  const aimAt = aimAtId ? tokens[aimAtId] : null;
  if (!aimAt) return [];
  const dx = aimAt.x - origin.x;
  const dy = aimAt.y - origin.y;
  const aimLength = Math.hypot(dx, dy);
  if (aimLength === 0) return [];
  const dirX = dx / aimLength;
  const dirY = dy / aimLength;

  if (config.shape === 'linha') {
    const lengthPct = config.distance * MOVE_UNIT_PCT;
    const widthPct = (config.width * MOVE_UNIT_PCT) / 2;
    return candidateIds.filter(id => {
      const pos = tokens[id];
      if (!pos) return false;
      const relX = pos.x - origin.x;
      const relY = pos.y - origin.y;
      const along = relX * dirX + relY * dirY; // projeção na direção da mira
      const perp = Math.abs(relX * -dirY + relY * dirX); // distância perpendicular à linha
      return along >= 0 && along <= lengthPct && perp <= widthPct;
    });
  }

  // cone
  const rangePct = config.range * MOVE_UNIT_PCT;
  const halfAngleRad = (config.angle / 2) * (Math.PI / 180);
  return candidateIds.filter(id => {
    const pos = tokens[id];
    if (!pos) return false;
    const relX = pos.x - origin.x;
    const relY = pos.y - origin.y;
    const dist = Math.hypot(relX, relY);
    if (dist === 0 || dist > rangePct) return false;
    const cosAngle = (relX * dirX + relY * dirY) / dist;
    const angleBetween = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    return angleBetween <= halfAngleRad;
  });
}
