import type { Grid } from '@vtt/core';

/** screen = world * zoom + (x, y) */
export interface Camera { x: number; y: number; zoom: number }

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;

const clampZoom = (z: number) => Math.min(Math.max(z, MIN_ZOOM), MAX_ZOOM);

export function screenToWorld(cam: Camera, p: { x: number; y: number }): { x: number; y: number } {
  return { x: (p.x - cam.x) / cam.zoom, y: (p.y - cam.y) / cam.zoom };
}

export function worldToScreen(cam: Camera, p: { x: number; y: number }): { x: number; y: number } {
  return { x: p.x * cam.zoom + cam.x, y: p.y * cam.zoom + cam.y };
}

/** Zoom mantendo fixo o ponto mundial sob `screenPoint`. */
export function zoomAt(cam: Camera, factor: number, screenPoint: { x: number; y: number }): Camera {
  const zoom = clampZoom(cam.zoom * factor);
  const world = screenToWorld(cam, screenPoint);
  return { zoom, x: screenPoint.x - world.x * zoom, y: screenPoint.y - world.y * zoom };
}

export function pan(cam: Camera, dx: number, dy: number): Camera {
  return { ...cam, x: cam.x + dx, y: cam.y + dy };
}

/** Enquadra o grid inteiro, centralizado, com uma pequena margem. */
export function fitGrid(
  grid: Pick<Grid, 'cols' | 'rows' | 'cellSize'>,
  viewport: { w: number; h: number },
): Camera {
  const gw = grid.cols * grid.cellSize;
  const gh = grid.rows * grid.cellSize;
  const zoom = clampZoom(Math.min(viewport.w / gw, viewport.h / gh) * 0.95);
  return { zoom, x: (viewport.w - gw * zoom) / 2, y: (viewport.h - gh * zoom) / 2 };
}
