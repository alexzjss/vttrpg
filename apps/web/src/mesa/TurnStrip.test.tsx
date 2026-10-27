import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ProjectedState } from '@vtt/core';
import { TurnStrip } from './TurnStrip';

const mk = (active: boolean): ProjectedState => {
  const names = ['Lia', 'Goblin', 'Orc'];
  const characters: Record<string, unknown> = {};
  const tokens: Record<string, unknown> = {};
  names.forEach((n, i) => {
    characters[`c${i}`] = { id: `c${i}`, name: n, portrait: '' };
    tokens[`t${i}`] = { id: `t${i}`, characterId: `c${i}`, hidden: false };
  });
  return {
    name: 'Campanha',
    characters,
    scene: { id: 's', name: 'Taverna', tokens },
    encounter: {
      active, round: 2, currentTokenId: 't1',
      order: [{ tokenId: 't0', initiative: 15 }, { tokenId: 't1', initiative: 12 }, { tokenId: 't2', initiative: 5 }],
    },
  } as unknown as ProjectedState;
};

describe('TurnStrip', () => {
  it('em combate mostra a rodada e marca o turno atual', () => {
    render(<TurnStrip state={mk(true)} />);
    expect(screen.getByText('Rodada 2')).toBeTruthy();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[1]!.getAttribute('aria-current')).toBe('true');
    expect(items[0]!.getAttribute('aria-current')).toBeNull();
  });

  it('fora de combate mostra o nome da cena', () => {
    render(<TurnStrip state={mk(false)} />);
    expect(screen.getByText('Taverna')).toBeTruthy();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});
