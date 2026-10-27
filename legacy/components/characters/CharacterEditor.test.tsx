import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../../types';
import CharacterEditor from './CharacterEditor';

afterEach(() => cleanup());

const baseChar = (arsenal: Character['arsenal'] = []): Character => ({
  id: 'c1', name: 'Heroína Teste', icon: '', maxHp: 10, currentHp: 10, maxAura: 10, currentAura: 10,
  maxAmmo: 0, currentAmmo: 0, baseInitiative: 0, cardIds: [], weaponIds: [], sealIds: [], conditions: [], items: [], arsenal,
});

describe('CharacterEditor', () => {
  it('não descarta cartas atribuídas por fora do editor enquanto ele está aberto', () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <CharacterEditor initialData={baseChar([])} cards={[]} weapons={[]} seals={[]} arsenalCards={[]} onSubmit={onSubmit} onDelete={() => {}} />
    );

    // Uma carta é atribuída a este personagem por outro fluxo (ex.: aba Arsenal) enquanto o modal segue aberto;
    // o App re-renderiza o editor com o personagem atualizado vindo do estado vivo.
    rerender(
      <CharacterEditor initialData={baseChar([{ cardId: 'card-a', quantity: 1, equipped: false, active: false }])} cards={[]} weapons={[]} seals={[]} arsenalCards={[]} onSubmit={onSubmit} onDelete={() => {}} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Salvar personagem' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const saved = onSubmit.mock.calls[0][0] as Character;
    expect(saved.arsenal).toEqual([{ cardId: 'card-a', quantity: 1, equipped: false, active: false }]);
  });
});
