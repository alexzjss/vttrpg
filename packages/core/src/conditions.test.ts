import { describe, expect, it } from 'vitest';
import { CONDITION_IDS, CONDITION_PRESETS, isConditionId } from './conditions';

describe('CONDITION_PRESETS', () => {
  it('tem os 15 presets do legado', () => {
    expect(CONDITION_IDS).toHaveLength(15);
    for (const id of CONDITION_IDS) {
      expect(CONDITION_PRESETS[id].id).toBe(id);
      expect(CONDITION_PRESETS[id].emoji).not.toBe('');
      expect(CONDITION_PRESETS[id].defaultDuration).toBeGreaterThan(0);
    }
  });
  it('queimando: 3 de dano de fogo por turno, 3 rodadas', () => {
    expect(CONDITION_PRESETS.queimando.perTurn).toEqual({ kind: 'damage', value: 3, element: 'fogo' });
    expect(CONDITION_PRESETS.queimando.defaultDuration).toBe(3);
  });
  it('valores do legado para os demais efeitos', () => {
    expect(CONDITION_PRESETS.envenenado.perTurn).toEqual({ kind: 'damage', value: 2 });
    expect(CONDITION_PRESETS.regenerando.perTurn).toEqual({ kind: 'heal', value: 3 });
    expect(CONDITION_PRESETS.desnorteado.skipsTurn).toBe(true);
    expect(CONDITION_PRESETS.dormindo.skipsTurn).toBe(true);
    expect(CONDITION_PRESETS.amaldicoado.attackPenalty).toBe(2);
    expect(CONDITION_PRESETS.protegido.damageReduction).toBe(3);
    expect(CONDITION_PRESETS.imobilizado.preventsMove).toBe(true);
    expect(CONDITION_PRESETS.amaldicoado.label).toBe('Amaldiçoado');
  });
  it('isConditionId recusa ids inexistentes e chaves herdadas', () => {
    expect(isConditionId('cego')).toBe(true);
    expect(isConditionId('toString')).toBe(false);
    expect(isConditionId('inexistente')).toBe(false);
  });
});
