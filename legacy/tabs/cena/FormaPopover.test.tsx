import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import FormaPopover from './FormaPopover';
import { createArsenalCard, type ArsenalCard } from '../../utils/arsenal';
import type { FormAvailability } from '../../utils/arsenalState';

afterEach(() => cleanup());

function forma(id: string, name: string): ArsenalCard {
  return createArsenalCard({ id, name, category: 'habilidade', abilityType: 'forma',
    form: { grantedAbilityIds: [], removedAbilityIds: [], hpBonus: 0, auraBonus: 0 } });
}

const items: FormAvailability[] = [
  { card: forma('ignea', 'Forma Ígnea'), ok: true, reason: null, isActive: false },
  { card: forma('lunar', 'Forma Lunar'), ok: false, reason: 'Vida acima do limite', isActive: false },
];

describe('FormaPopover', () => {
  it('lista formas disponíveis e bloqueadas com o motivo', () => {
    render(<FormaPopover forms={items} onActivate={() => {}} onRevert={() => {}} onClose={() => {}} />);
    expect(screen.getByText('Forma Ígnea')).toBeTruthy();
    expect(screen.getByText('Forma Lunar')).toBeTruthy();
    expect(screen.getByText(/vida acima do limite/i)).toBeTruthy();
  });

  it('ativa a forma ao clicar num item disponível', () => {
    const onActivate = vi.fn();
    render(<FormaPopover forms={items} onActivate={onActivate} onRevert={() => {}} onClose={() => {}} />);
    fireEvent.click(screen.getByText('Forma Ígnea'));
    expect(onActivate).toHaveBeenCalledWith('ignea');
  });

  it('não ativa ao clicar num item bloqueado', () => {
    const onActivate = vi.fn();
    render(<FormaPopover forms={items} onActivate={onActivate} onRevert={() => {}} onClose={() => {}} />);
    fireEvent.click(screen.getByText('Forma Lunar'));
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('oferece reverter quando há forma ativa', () => {
    const onRevert = vi.fn();
    const active: FormAvailability[] = [{ card: forma('ignea', 'Forma Ígnea'), ok: false, reason: null, isActive: true }];
    render(<FormaPopover forms={active} onActivate={() => {}} onRevert={onRevert} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /reverter/i }));
    expect(onRevert).toHaveBeenCalled();
  });
});
