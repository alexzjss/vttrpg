import React, { useEffect, useState } from 'react';
import { DatabaseService } from '../utils/database';
import { CombatState } from '../types';
import { migrateCombatState } from '../utils/combatMigration';
import CombatArena from './combat/grid/CombatArena';

function visibleCombatState(combat: CombatState): CombatState {
  const fog = combat.fog;

  const combatants = combat.combatants.filter(c => {
    if (c.isHidden) return false;
    // Hide tokens in unrevealed fog cells
    if (fog) {
      const n = fog.density;
      const col = Math.floor((c.pos.x / 100) * n);
      const row = Math.floor((c.pos.y / 100) * n);
      const safeRow = Math.max(0, Math.min(n - 1, row));
      const safeCol = Math.max(0, Math.min(n - 1, col));
      if (!fog.revealed[safeRow]?.[safeCol]) return false;
    }
    return true;
  });

  const aoeTemplates = (combat.aoeTemplates || []).filter(t => t.visibleToPlayers);

  return { ...combat, combatants, aoeTemplates };
}

const PlayerMirror: React.FC = () => {
  const [combat, setCombat] = useState<CombatState | null>(null);

  useEffect(() => {
    const unsub = DatabaseService.subscribeRemoteCombat((raw) => {
      setCombat(migrateCombatState(raw));
    });
    DatabaseService.requestCombat();
    return unsub;
  }, []);

  if (!combat?.isActive) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-base)',
        color: 'var(--text-secondary)',
        fontWeight: 700, letterSpacing: '0.2em',
        textTransform: 'uppercase', fontSize: 14,
      }}>
        Aguardando o início do combate…
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <CombatArena
        combat={visibleCombatState(combat)}
        activeForms={combat.activeForms || []}
        mode="readOnly"
        selectedCombatantId={null}
        statPopups={[]}
      />
    </div>
  );
};

export default PlayerMirror;
