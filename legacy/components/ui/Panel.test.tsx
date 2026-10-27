import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Panel } from './Panel';
import { Frame } from './Frame';

describe('Panel', () => {
  it('renderiza filhos e a classe da variante', () => {
    const { getByText, container } = render(<Panel variant="raised">Olá</Panel>);
    expect(getByText('Olá')).toBeTruthy();
    const el = container.querySelector('.mp-panel');
    expect(el?.className).toContain('mp-panel--raised');
    expect(container.querySelector('.mp-panel__canvas')).toBeTruthy();
  });
});

describe('Frame', () => {
  it('renderiza a arte quando há src', () => {
    const { container } = render(<Frame src="/x.png" alt="retrato" />);
    const img = container.querySelector('img.mp-frame__art') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute('alt')).toBe('retrato');
  });
});
