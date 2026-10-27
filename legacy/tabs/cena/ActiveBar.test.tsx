import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ActiveBar from './ActiveBar';
import type { Character } from '../../types';

afterEach(() => cleanup());

const char: Character = { id: 'a', name: 'Shinkai Black', icon: '', maxHp: 60, currentHp: 45, maxAura: 20, currentAura: 19,
  maxAmmo: 0, currentAmmo: 0, baseInitiative: 0, cardIds: [], conditions: [], items: [] };

describe('ActiveBar', () => {
  it('mostra nome e HP/Aura do ativo', () => {
    render(<ActiveBar active={char} />);
    expect(screen.getByText('Shinkai Black')).toBeTruthy();
    expect(screen.getByText('45/60')).toBeTruthy();
    expect(screen.getByText('19/20')).toBeTruthy();
  });
  it('não renderiza nada sem ativo', () => {
    const { container } = render(<ActiveBar active={null} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('ActiveBar combate', () => {
  it('mostra o badge SEU TURNO em combate', () => {
    render(<ActiveBar active={char} combat />);
    expect(screen.getByText(/seu turno/i)).toBeTruthy();
  });
  it('não mostra o badge fora de combate', () => {
    render(<ActiveBar active={char} />);
    expect(screen.queryByText(/seu turno/i)).toBeNull();
  });
});
