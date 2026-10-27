import React, { useCallback } from 'react';
import { FogState, ToolbarMode } from '../../../types';

interface FogRevealOverlayProps {
  fog: FogState;
  toolbarMode: ToolbarMode;
  onFogChange: (fog: FogState) => void;
}

function toggleCell(fog: FogState, row: number, col: number, reveal: boolean): FogState {
  const next = fog.revealed.map(r => [...r]);
  if (next[row]?.[col] !== undefined) next[row][col] = reveal;
  return { ...fog, revealed: next };
}

const FogRevealOverlay: React.FC<FogRevealOverlayProps> = ({
  fog, toolbarMode, onFogChange,
}) => {
  const isActive = toolbarMode === 'fog-reveal' || toolbarMode === 'fog-hide';
  if (!isActive) return null;

  const reveal = toolbarMode === 'fog-reveal';
  const n = fog.density;

  const handleCell = useCallback((r: number, c: number) => {
    onFogChange(toggleCell(fog, r, c, reveal));
  }, [fog, reveal, onFogChange]);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      display: 'grid',
      gridTemplateColumns: `repeat(${n}, 1fr)`,
      gridTemplateRows: `repeat(${n}, 1fr)`,
      cursor: reveal ? 'cell' : 'not-allowed',
    }}>
      {Array.from({ length: n * n }).map((_, i) => {
        const row = Math.floor(i / n);
        const col = i % n;
        return (
          <div
            key={i}
            onPointerEnter={(e) => { if (e.buttons === 1) handleCell(row, col); }}
            onPointerDown={() => handleCell(row, col)}
            style={{
              border: '0.5px solid rgba(255,255,255,0.04)',
              background: fog.revealed[row]?.[col]
                ? (reveal ? 'rgba(52,211,153,0.08)' : 'rgba(52,211,153,0.04)')
                : (reveal ? 'transparent' : 'rgba(239,68,68,0.06)'),
            }}
          />
        );
      })}
    </div>
  );
};

export default FogRevealOverlay;
