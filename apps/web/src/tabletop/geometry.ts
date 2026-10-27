import type { Cell, Grid } from '@vtt/core';

type GridSize = Pick<Grid, 'cols' | 'rows'>;

/** Centro da célula em coordenadas de mundo. */
export function cellToPx(cell: Cell, cellSize: number): { x: number; y: number } {
  return { x: (cell.col + 0.5) * cellSize, y: (cell.row + 0.5) * cellSize };
}

export function pxToCell(p: { x: number; y: number }, cellSize: number): Cell {
  return { col: Math.floor(p.x / cellSize), row: Math.floor(p.y / cellSize) };
}

export function clampCell(cell: Cell, grid: GridSize): Cell {
  return {
    col: Math.min(Math.max(cell.col, 0), grid.cols - 1),
    row: Math.min(Math.max(cell.row, 0), grid.rows - 1),
  };
}

export function isInside(cell: Cell, grid: GridSize): boolean {
  return cell.col >= 0 && cell.row >= 0 && cell.col < grid.cols && cell.row < grid.rows;
}
