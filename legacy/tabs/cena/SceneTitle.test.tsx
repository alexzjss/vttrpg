import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import SceneTitle from './SceneTitle';
import { createDefaultCena } from '../../utils/cena';

afterEach(() => cleanup());

describe('SceneTitle', () => {
  it('mostra nome e subtítulo editáveis', () => {
    const scene = { ...createDefaultCena().scene, locationName: 'A FORTALEZA', subtitle: 'Soterrada' };
    render(<SceneTitle scene={scene} onSceneChange={() => {}} />);
    expect(screen.getByDisplayValue('A FORTALEZA')).toBeTruthy();
    expect(screen.getByDisplayValue('Soterrada')).toBeTruthy();
  });
  it('não exibe mais controles de clima', () => {
    render(<SceneTitle scene={createDefaultCena().scene} onSceneChange={vi.fn()} />);
    expect(screen.queryByLabelText(/clima/i)).toBeNull();
  });
  it('usa uma única imagem para cenário e mapa', () => {
    render(<SceneTitle scene={createDefaultCena().scene} onSceneChange={() => {}} />);
    expect(screen.getByTitle('Cenário e mapa')).toBeTruthy();
    expect(screen.queryByTitle('Fundo separado (opcional)')).toBeNull();
  });
});
