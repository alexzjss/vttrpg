import { describe, expect, it } from 'vitest';
import type { Character } from '../types';
import { createArsenalCard } from './arsenal';
import { buildArsenalExport, buildCharacterExport } from './characterExport';

describe('characterExport', () => {
  it('exporta o catálogo completo quando todo o arsenal está em exibição', () => {
    const cards = [
      createArsenalCard({ id: 'habilidade', name: 'Golpe', category: 'habilidade' }),
      createArsenalCard({ id: 'item', name: 'Poção', category: 'item' }),
    ];
    expect(buildArsenalExport(cards)).toMatchObject({ format: 'rpg-codex-arsenal', version: 1, cards });
  });

  it('mantém a exportação de personagem restrita às cartas atribuídas', () => {
    const assigned = createArsenalCard({ id: 'atribuida', name: 'Golpe' });
    const other = createArsenalCard({ id: 'outra', name: 'Poção' });
    const character = { name: 'Lia', arsenal: [{ cardId: assigned.id }] } as Character;
    expect(buildCharacterExport(character, [assigned, other]).cards).toEqual([assigned]);
  });
});
