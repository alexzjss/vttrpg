import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SealsPanel, ActionsPanel } from './ActivePanels';
import type { Card, Seal, Weapon } from '../../types';
import type { ResolvedItem } from '../../utils/items';

afterEach(() => cleanup());

const card: Card = { id: 'c1', name: 'Bola de Fogo', image: '', auraCost: 2, type: 'ataque', description: '' };
const seal: Seal = { id: 's1', name: 'Selo do Vínculo', code: '', image: '', description: '' };
const weapon: Weapon = { id: 'w1', name: 'Machado', description: '', image: '' };
const item: ResolvedItem = { id: 'i1', name: 'Poção', description: '', image: '', quantity: 3 };

describe('SealsPanel', () => {
  it('lista os selos do ativo', () => {
    render(<SealsPanel seals={[seal]} />);
    expect(screen.getByText('Selo do Vínculo')).toBeTruthy();
  });
  it('estado vazio sem ativo', () => {
    render(<SealsPanel seals={[]} />);
    expect(screen.getByText(/nenhum selo/i)).toBeTruthy();
  });
});

describe('ActionsPanel', () => {
  it('lista cartas, itens e armas', () => {
    render(<ActionsPanel cards={[card]} items={[item]} weapons={[weapon]} />);
    expect(screen.getByText('Bola de Fogo')).toBeTruthy();
    expect(screen.getByText('Poção')).toBeTruthy();
    expect(screen.getByText('Machado')).toBeTruthy();
  });
});
