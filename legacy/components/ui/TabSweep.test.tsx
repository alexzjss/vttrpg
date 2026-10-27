import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TabSweep } from './TabSweep';

describe('TabSweep', () => {
  it('mostra a palavra da aba', () => {
    const { container } = render(<TabSweep tabKey="combat" label="Combate" />);
    expect(container.querySelector('.mp-tab-sweep__word')?.textContent).toBe('Combate');
  });
});
