import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ArsenalWorkspace from './ArsenalWorkspace';
import { useArsenal } from '../../hooks/useArsenal';
import { useAbilityGraphs } from '../../hooks/useAbilityGraphs';
import { createAbilityGraph } from '../../utils/abilityGraph';

vi.mock('../../hooks/useArsenal');
vi.mock('../../hooks/useAbilityGraphs');

const mockedUseArsenal = vi.mocked(useArsenal);
const mockedUseAbilityGraphs = vi.mocked(useAbilityGraphs);

beforeEach(() => {
  mockedUseArsenal.mockReturnValue({
    cards: [], loading: false, error: null,
    byCategory: { habilidade: [], selo: [], item: [], arma: [] },
    save: vi.fn(), remove: vi.fn(), find: vi.fn(),
  });
  mockedUseAbilityGraphs.mockReturnValue({
    graphs: [createAbilityGraph({ id: 'g1', name: 'Golpe Solar' })],
    loading: false, error: null, save: vi.fn(), remove: vi.fn(), find: vi.fn(),
  });
});

describe('ArsenalWorkspace — aba Habilidades', () => {
  it('lista habilidades-grafo existentes', () => {
    render(<ArsenalWorkspace characters={[]} onUpdateCharacter={vi.fn()} />);
    expect(screen.getByText('Golpe Solar')).toBeTruthy();
  });

  it('"Nova carta" abre o GraphEditor', async () => {
    render(<ArsenalWorkspace characters={[]} onUpdateCharacter={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Nova carta/ }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Editor de Habilidade' })).toBeTruthy());
  });

  it('"Editar" numa habilidade existente abre o GraphEditor com ela carregada', async () => {
    render(<ArsenalWorkspace characters={[]} onUpdateCharacter={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Editar Golpe Solar/ }));
    await waitFor(() => expect((screen.getByLabelText('Nome') as HTMLInputElement).value).toBe('Golpe Solar'));
  });

  it('"Atribuir" abre o diálogo de atribuição sem exigir personagem pré-selecionado', () => {
    const onUpdateCharacter = vi.fn();
    const character = { id: 'c1', name: 'Herói', icon: '', maxHp: 20, currentHp: 20, maxAura: 10, currentAura: 10, maxAmmo: 0, currentAmmo: 0, baseInitiative: 0, cardIds: [], conditions: [], items: [], role: 'cast' as const };
    render(<ArsenalWorkspace characters={[character]} onUpdateCharacter={onUpdateCharacter} />);
    fireEvent.click(screen.getByRole('button', { name: /Atribuir Golpe Solar/ }));
    expect(screen.getByRole('dialog', { name: 'Atribuir Golpe Solar' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Herói/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Atribuir' }));
    expect(onUpdateCharacter).toHaveBeenCalledWith('c1', { arsenal: [{ cardId: 'g1', quantity: 1, equipped: false, active: false }] });
  });
});

describe('ArsenalWorkspace — itens e selos', () => {
  it('mostra criação e edição de selos no Arsenal', () => {
    const onCreateSeal = vi.fn();
    const onEditSeal = vi.fn();
    mockedUseArsenal.mockReturnValue({
      cards: [{ ...createLegacyCard() }], loading: false, error: null,
      byCategory: { habilidade: [], selo: [createLegacyCard()], item: [], arma: [] },
      save: vi.fn(), remove: vi.fn(), find: vi.fn(),
    });
    render(<ArsenalWorkspace characters={[]} onUpdateCharacter={vi.fn()} onCreateSeal={onCreateSeal} onEditSeal={onEditSeal} />);
    fireEvent.click(screen.getByRole('tab', { name: /Selos/ }));
    fireEvent.click(screen.getByRole('button', { name: /Novo selo/ }));
    fireEvent.click(screen.getByRole('button', { name: /Editar Selo Antigo/ }));
    expect(onCreateSeal).toHaveBeenCalled();
    expect(onEditSeal).toHaveBeenCalledWith('legacy-1');
  });
});

function createLegacyCard() {
  return {
    schemaVersion: 1 as const, id: 'legacy-1', name: 'Selo Antigo', description: '', category: 'selo' as const,
    icon: '', tags: [], element: null, testDice: null, extraDamageDice: null, damage: null, healing: null,
    auraConsumed: null, auraRestored: null, ammoConsumed: null, ammoRestored: null,
    target: { type: 'um_alvo' as const }, area: null,
    preparation: { timing: { type: 'instantaneo' as const }, cancellable: false, interruptedByDamage: false, persistsAfterDamage: true, visibility: 'visivel' as const },
    conditions: [], triggers: [], effects: [], cooldown: { type: 'sem_cooldown' as const }, charges: null,
    visibility: 'publica' as const, weaponLinks: [], formLinks: [], levels: [],
  };
}
