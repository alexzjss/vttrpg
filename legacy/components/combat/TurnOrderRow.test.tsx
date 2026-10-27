import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TurnOrderRow from './TurnOrderRow';
import type { Combatant } from '../../types';

const combatant = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'p1',
  combatId: 'c1',
  name: 'Mikhail',
  icon: '',
  maxHp: 30,
  currentHp: 20,
  maxAura: 12,
  currentAura: 8,
  maxAmmo: 6,
  currentAmmo: 3,
  baseInitiative: 0,
  initiativeResult: 10,
  defense: 10,
  defenseMax: 20,
  defenseCurrent: 12,
  defenseReduction: 0.3,
  defenseRegeneration: 2,
  defenseActivationThreshold: 0.2,
  staggerMax: 100,
  staggerCurrent: 0,
  staggerRecovery: 15,
  staggerDamageMultiplier: 1.4,
  staggerDuration: 1,
  isDefenseBroken: false,
  isStaggered: false,
  staggerTurnsRemaining: 0,
  cardIds: [],
  weaponIds: [],
  sealIds: [],
  conditions: [],
  items: [],
  gridPos: { x: 0, y: 0 },
  pos: { x: 0, y: 0 },
  ...over,
});

describe('TurnOrderRow', () => {
  it('mostra Defesa, munição e Stagger no card da ordem de turnos', () => {
    render(
      <TurnOrderRow
        combatant={combatant({ defenseCurrent: 0, isDefenseBroken: true, staggerCurrent: 55 })}
        isActive={false}
        activeForms={[]}
        cards={[]}
        position={1}
        items={[]}
        selectedCategory={null}
        onSelectAction={vi.fn()}
      />,
    );

    expect(screen.getByText('DEF')).toBeTruthy();
    expect(screen.getByText('BREAK')).toBeTruthy();
    expect(screen.getByText('STG')).toBeTruthy();
    expect(screen.getByText('AM')).toBeTruthy();
  });
});
