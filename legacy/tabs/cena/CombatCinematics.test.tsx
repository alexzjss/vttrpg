import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import CombatCinematics from './CombatCinematics';

afterEach(cleanup);

describe('CombatCinematics', () => {
  it('anuncia início do combate', () => {
    const view = render(<CombatCinematics combat={false} round={0} />);
    view.rerender(<CombatCinematics combat round={1} activeName="Shinkai" />);
    expect(screen.getByText('CONFRONTO')).toBeTruthy();
  });

  it('anuncia a troca de turno', () => {
    const view = render(<CombatCinematics combat round={1} activeName="Shinkai" />);
    view.rerender(<CombatCinematics combat round={1} activeName="Mikhail" />);
    expect(screen.getByText('Mikhail')).toBeTruthy();
  });

  it('anuncia nova rodada', () => {
    const view = render(<CombatCinematics combat round={1} activeName="Shinkai" />);
    view.rerender(<CombatCinematics combat round={2} activeName="Shinkai" />);
    expect(screen.getByText('RODADA 2')).toBeTruthy();
  });
});
