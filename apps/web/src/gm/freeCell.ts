import type { Cell, Scene } from '@vtt/core';

/** Primeira célula livre varrendo linha a linha a partir de (0,0); null se a cena estiver cheia. */
export function firstFreeCell(scene: Scene): Cell | null {
  const taken = new Set(Object.values(scene.tokens).map((t) => `${t.cell.col},${t.cell.row}`));
  for (let row = 0; row < scene.grid.rows; row++) {
    for (let col = 0; col < scene.grid.cols; col++) {
      if (!taken.has(`${col},${row}`)) return { col, row };
    }
  }
  return null;
}
