import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import InitiativeTracker from './InitiativeTracker';
import type { Character } from '../../types';

afterEach(() => cleanup());

function ch(id: string, name: string): Character {
  return { id, name, icon: '', maxHp: 10, currentHp: 10, maxAura: 5, currentAura: 5, maxAmmo: 0, currentAmmo: 0,
    baseInitiative: 0, cardIds: [], conditions: [], items: [] };
}

describe('InitiativeTracker', () => {
  it('mostra a rodada e os participantes', () => {
    render(<InitiativeTracker round={3} participants={[ch('p1', 'Shinkai'), ch('p2', 'Mikhail')]} activeId="p1" />);
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText(/rodada/i)).toBeTruthy();
    expect(screen.getByText('SHINKAI')).toBeTruthy();
    expect(screen.getByText('MIKHAIL')).toBeTruthy();
  });
});

describe('InitiativeTracker — turnos e caídos', () => {
  it('chama onNext/onPrev nos botões', () => {
    const onNext = vi.fn(); const onPrev = vi.fn();
    render(<InitiativeTracker round={1} participants={[ch('p1', 'Shinkai')]} activeId="p1" onPrev={onPrev} onNext={onNext} />);
    fireEvent.click(screen.getByRole('button', { name: /próximo turno/i }));
    fireEvent.click(screen.getByRole('button', { name: /turno anterior/i }));
    expect(onNext).toHaveBeenCalled();
    expect(onPrev).toHaveBeenCalled();
  });
  it('abre a edição rápida com duplo clique no participante', () => {
    const onEditParticipant = vi.fn();
    render(<InitiativeTracker round={1} participants={[ch('p1', 'Shinkai')]} activeId="p1" onEditParticipant={onEditParticipant} />);
    fireEvent.doubleClick(screen.getByTitle(/shinkai.*duplo clique/i));
    expect(onEditParticipant).toHaveBeenCalledWith('p1');
  });
});
