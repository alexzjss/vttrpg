import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGmDashboardData } from './useGmDashboardData';
import { createDefaultCena, createDefaultEncounter, addNpcFromCharacter, type CenaState } from '../utils/cena';
import type { Character } from '../types';

const mocks = vi.hoisted(() => ({
  charactersCb: null as any,
  cenaCb: null as any,
  saveCharacter: vi.fn(),
  deleteCharacter: vi.fn(),
  updateCena: vi.fn(),
}));

vi.mock('../utils/database', () => ({
  DatabaseService: {
    syncCharacters: (cb: any) => { mocks.charactersCb = cb; return () => {}; },
    syncCenaState: (cb: any) => { mocks.cenaCb = cb; return () => {}; },
    syncCards: (cb: any) => { cb([]); return () => {}; },
    syncSeals: (cb: any) => { cb([]); return () => {}; },
    syncWeapons: (cb: any) => { cb([]); return () => {}; },
    saveCharacter: mocks.saveCharacter,
    deleteCharacter: mocks.deleteCharacter,
    updateCena: mocks.updateCena,
  },
}));

function cast(id: string, name: string, over: Partial<Character> = {}): Character {
  return {
    id, name, icon: '', maxHp: 20, currentHp: 20, maxAura: 10, currentAura: 10,
    maxAmmo: 0, currentAmmo: 0, baseInitiative: 0, cardIds: [], conditions: [], items: [], role: 'cast', ...over,
  };
}

const combatCena = (): CenaState => ({
  ...createDefaultCena(),
  encounter: {
    ...createDefaultEncounter(), isActive: true, round: 2, turnIndex: 0,
    order: [{ refId: 'p1', side: 'party' as const, initiative: 20 }, { refId: 'p2', side: 'party' as const, initiative: 10 }],
  },
});

function seed(cena: CenaState = combatCena(), characters: Character[] = [cast('p1', 'Shinkai'), cast('p2', 'Mikhail')]) {
  const view = renderHook(() => useGmDashboardData());
  act(() => { mocks.charactersCb(characters); mocks.cenaCb(cena); });
  return view;
}

describe('useGmDashboardData', () => {
  beforeEach(() => {
    mocks.saveCharacter.mockClear();
    mocks.deleteCharacter.mockClear();
    mocks.updateCena.mockClear();
    vi.restoreAllMocks();
  });

  it('carrega personagens e cena via DatabaseService', () => {
    const { result } = seed();
    expect(result.current.characters.map(c => c.name)).toEqual(['Shinkai', 'Mikhail']);
    expect(result.current.cena.encounter.round).toBe(2);
  });

  it('onToggleBench bane e desbane, persistindo via DatabaseService.updateCena', () => {
    const { result } = seed();
    act(() => result.current.onToggleBench('p1'));
    expect(mocks.updateCena).toHaveBeenCalledWith(expect.objectContaining({ benchedCastIds: ['p1'] }));
    act(() => result.current.onToggleBench('p1'));
    expect(mocks.updateCena).toHaveBeenLastCalledWith(expect.objectContaining({ benchedCastIds: [] }));
  });

  it('onSpawnNpc clona o personagem no npcRoster da cena', () => {
    const { result } = seed();
    act(() => result.current.onSpawnNpc(cast('p1', 'Shinkai')));
    expect(mocks.updateCena).toHaveBeenCalledWith(expect.objectContaining({
      npcRoster: expect.arrayContaining([expect.objectContaining({ id: 'p1', isNpc: true })]),
    }));
  });

  it('onRemoveNpc tira o NPC do roster', () => {
    const withNpc = addNpcFromCharacter(combatCena(), cast('n1', 'Bandido'));
    const { result } = seed(withNpc);
    act(() => result.current.onRemoveNpc('n1'));
    expect(mocks.updateCena).toHaveBeenCalledWith(expect.objectContaining({ npcRoster: [] }));
  });

  it('onTogglePause alterna isPaused', () => {
    const { result } = seed();
    act(() => result.current.onTogglePause());
    expect(mocks.updateCena.mock.calls[0][0].encounter.isPaused).toBe(true);
  });

  it('onResetAllStatus só age após confirmar, curando todos', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const wounded = cast('p1', 'Shinkai', { currentHp: 3 });
    const { result } = seed(combatCena(), [wounded, cast('p2', 'Mikhail')]);
    act(() => result.current.onResetAllStatus());
    expect(mocks.saveCharacter).not.toHaveBeenCalled();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    act(() => result.current.onResetAllStatus());
    expect(mocks.saveCharacter).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', currentHp: 20 }));
  });

  it('onClearLog esvazia o log após confirmar', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const cena = { ...combatCena(), log: [{ id: 'l1', kind: 'system' as const, text: 'x', timestamp: 1 }] };
    const { result } = seed(cena);
    act(() => result.current.onClearLog());
    expect(mocks.updateCena).toHaveBeenCalledWith(expect.objectContaining({ log: [] }));
  });

  it('onRerollInitiative reordena e zera o turnIndex', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { result } = seed();
    act(() => result.current.onRerollInitiative());
    const next = mocks.updateCena.mock.calls[0][0].encounter;
    expect(next.turnIndex).toBe(0);
    expect(next.order.map((e: any) => e.refId).sort()).toEqual(['p1', 'p2']);
  });

  it('onEndCombat reinicia rodada e log', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const cena = { ...combatCena(), log: [{ id: 'l1', kind: 'system' as const, text: 'x', timestamp: 1 }] };
    const { result } = seed(cena);
    act(() => result.current.onEndCombat());
    const next = mocks.updateCena.mock.calls[0][0];
    expect(next.encounter.round).toBe(1);
    expect(next.encounter.isActive).toBe(true);
  });

  it('deleteCharacter só chama DatabaseService após confirmar', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { result } = seed();
    act(() => result.current.deleteCharacter('p1'));
    expect(mocks.deleteCharacter).not.toHaveBeenCalled();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    act(() => result.current.deleteCharacter('p1'));
    expect(mocks.deleteCharacter).toHaveBeenCalledWith('p1');
  });
});
