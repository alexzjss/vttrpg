import { describe, expect, it } from 'vitest';
import { fitGrid, pan, screenToWorld, worldToScreen, zoomAt } from './camera';

describe('camera', () => {
  it('zoomAt mantém o ponto mundial sob o cursor', () => {
    const cam = { x: 30, y: -20, zoom: 1.3 };
    const pt = { x: 400, y: 250 };
    const before = screenToWorld(cam, pt);
    const next = zoomAt(cam, 1.7, pt);
    const after = screenToWorld(next, pt);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });
  it('zoomAt respeita os limites', () => {
    const pt = { x: 10, y: 10 };
    expect(zoomAt({ x: 0, y: 0, zoom: 3.9 }, 10, pt).zoom).toBe(4);
    expect(zoomAt({ x: 0, y: 0, zoom: 0.3 }, 0.01, pt).zoom).toBe(0.25);
  });
  it('pan desloca a câmera', () => {
    expect(pan({ x: 1, y: 2, zoom: 1 }, 5, -3)).toEqual({ x: 6, y: -1, zoom: 1 });
  });
  it('worldToScreen é inverso de screenToWorld', () => {
    const cam = { x: 12, y: 7, zoom: 2 };
    const w = screenToWorld(cam, { x: 100, y: 80 });
    expect(worldToScreen(cam, w)).toEqual({ x: 100, y: 80 });
  });
  it('fitGrid centraliza o grid no viewport', () => {
    const cam = fitGrid({ cols: 20, rows: 12, cellSize: 64 }, { w: 1280, h: 720 });
    const c = worldToScreen(cam, { x: 640, y: 384 });
    expect(c.x).toBeCloseTo(640, 6);
    expect(c.y).toBeCloseTo(360, 6);
    expect(cam.zoom).toBeLessThanOrEqual(720 / 768);
  });
});
