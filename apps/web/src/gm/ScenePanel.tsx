import type { Grid, ProjectedState } from '@vtt/core';
import { useState, type ChangeEvent } from 'react';
import { useImageSink } from '../net/ImageSinkContext';
import type { Send } from './types';

export function ScenePanel({ state, send }: { state: ProjectedState; send: Send }) {
  const { grid } = state.scene;
  const sink = useImageSink();
  const [cols, setCols] = useState(String(grid.cols));
  const [rows, setRows] = useState(String(grid.rows));
  const [cellSize, setCellSize] = useState(String(grid.cellSize));
  const [visible, setVisible] = useState(grid.visible);
  const [background, setBackground] = useState(state.scene.background);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setBackground(await sink(file, 2048));
      setError(null);
    } catch {
      setError('Não foi possível ler a imagem.');
    }
  };

  const apply = () => {
    const next: Grid = {
      cols: Math.trunc(Number(cols)),
      rows: Math.trunc(Number(rows)),
      cellSize: Math.trunc(Number(cellSize)),
      visible,
    };
    void send({ type: 'updateGrid', grid: next, background });
  };

  return (
    <section className="scene-panel">
      <h3>Cena</h3>
      <label>Colunas
        <input type="number" min={1} value={cols} onChange={(e) => setCols(e.target.value)} />
      </label>
      <label>Linhas
        <input type="number" min={1} value={rows} onChange={(e) => setRows(e.target.value)} />
      </label>
      <label>Tamanho da célula
        <input type="number" min={1} value={cellSize} onChange={(e) => setCellSize(e.target.value)} />
      </label>
      <label className="inline">
        <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
        Mostrar grid
      </label>
      <label>Imagem de fundo
        <input type="file" accept="image/*" onChange={(e) => void onFile(e)} />
      </label>
      {background && <button type="button" onClick={() => setBackground('')}>Remover fundo</button>}
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={apply}>Aplicar</button>
    </section>
  );
}
