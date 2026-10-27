import { describe, expect, it } from 'vitest';
import { clampCell, cellToPx, isInside, pxToCell } from './geometry';

const grid = { cols: 20, rows: 12, cellSize: 64, visible: true };

describe('geometry', () => {
  it('cellToPx devolve o centro da célula', () => {
    expect(cellToPx({ col: 2, row: 1 }, 64)).toEqual({ x: 160, y: 96 });
  });
  it('pxToCell usa floor', () => {
    expect(pxToCell({ x: 127, y: 64 }, 64)).toEqual({ col: 1, row: 1 });
  });
  it('clampCell limita ao grid', () => {
    expect(clampCell({ col: -1, row: 99 }, grid)).toEqual({ col: 0, row: 11 });
  });
  it('isInside', () => {
    expect(isInside({ col: 0, row: 11 }, grid)).toBe(true);
    expect(isInside({ col: 20, row: 0 }, grid)).toBe(false);
    expect(isInside({ col: 0, row: -1 }, grid)).toBe(false);
  });
});
