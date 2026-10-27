import type { MovementIntent } from './abilityInterpreter';

/** % da arena deslocada por unidade de `distance` do nó `mover`. */
export const MOVE_UNIT_PCT = 8;

type Pos = { x: number; y: number };

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** Resolve intenções de movimento em posições finais no mapa da Cena.
 *  Função pura: recebe as posições atuais e devolve só as entradas que mudaram. */
export function resolveMovementIntents(
  intents: MovementIntent[],
  tokens: Record<string, Pos>,
  actorId: string,
): Record<string, Pos> {
  const actorPos = tokens[actorId];
  const next: Record<string, Pos> = {};

  for (const intent of intents) {
    const targetPos = tokens[intent.targetId];
    if (!actorPos || !targetPos) continue;

    if (intent.kind === 'trocar_lugar') {
      next[actorId] = targetPos;
      next[intent.targetId] = actorPos;
      continue;
    }

    if (intent.kind !== 'empurrar' && intent.kind !== 'puxar') continue; // teleportar: fora de escopo

    const dx = targetPos.x - actorPos.x;
    const dy = targetPos.y - actorPos.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) continue; // direção indefinida — não move

    const sign = intent.kind === 'empurrar' ? 1 : -1;
    const amount = intent.distance * MOVE_UNIT_PCT * sign;
    next[intent.targetId] = {
      x: clamp(targetPos.x + (dx / length) * amount),
      y: clamp(targetPos.y + (dy / length) * amount),
    };
  }

  return next;
}
