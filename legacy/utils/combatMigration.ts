import { CombatState } from '../types';
import { migrateCharacterDefense } from './defense';

function migrateOneCombatState(data: Record<string, unknown>): CombatState {
  const gw = (data.gridWidth as number) || 10;
  const gh = (data.gridHeight as number) || 10;

  const combatants = ((data.combatants as any[]) || []).map((c: any) => migrateCharacterDefense({
    ...c,
    pos: c.pos ?? {
      x: ((c.gridPos?.x ?? 0) / gw) * 100,
      y: ((c.gridPos?.y ?? 0) / gh) * 100,
    },
  }));

  const savedState = data.savedState
    ? migrateOneCombatState(data.savedState as Record<string, unknown>)
    : null;

  return {
    ...data,
    combatants,
    savedState,
    gridVisible: (data.gridVisible as boolean) ?? true,
    gridDensity: (data.gridDensity as number) ?? gw,
  } as CombatState;
}

export function migrateCombatState(raw: unknown): CombatState {
  return migrateOneCombatState(raw as Record<string, unknown>);
}
