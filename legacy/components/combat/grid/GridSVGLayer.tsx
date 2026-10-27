import React from 'react';
import { CombatState, AoETemplate } from '../../../types';
import { conePathD, linePathD, correctedDist } from './aoeHelpers';

interface DragState {
  combatId: string;
  startPos: { x: number; y: number };
  currentDelta: { x: number; y: number };
}

interface RulerLine {
  id: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
}

interface AoEPreview {
  shape: AoETemplate['shape'];
  color: string;
  x: number; y: number;
  radius?: number;
  angle?: number; arc?: number; length?: number; width?: number;
}

interface GridSVGLayerProps {
  combat: CombatState;
  arenaDims: { w: number; h: number };
  // Drag (movement range)
  dragState: DragState | null;
  // Rulers
  rulers: RulerLine[];
  rulerDraft: { start: { x: number; y: number }; end: { x: number; y: number } } | null;
  // AoE
  aoePreview: AoEPreview | null;
  // Fog (master sees grey overlay; players see opaque mask)
  showFog: boolean;         // false = master sees all (no mask, only overlay)
  fogMaskOpaque: boolean;   // true = player mode, full mask
  // Pointer events for interactive tools
  onSvgPointerDown?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onSvgPointerMove?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onSvgPointerUp?: (e: React.PointerEvent<SVGSVGElement>) => void;
  // AoE drag handles
  onAoEDrag?: (id: string, newX: number, newY: number) => void;
}

function svgPoint(e: React.PointerEvent<SVGSVGElement>, svg: SVGSVGElement) {
  const rect = svg.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * 100,
    y: ((e.clientY - rect.top) / rect.height) * 100,
  };
}

const GridSVGLayer: React.FC<GridSVGLayerProps> = ({
  combat, arenaDims,
  dragState, rulers, rulerDraft,
  aoePreview, showFog, fogMaskOpaque,
  onSvgPointerDown, onSvgPointerMove, onSvgPointerUp,
}) => {
  const ar = arenaDims.h > 0 ? arenaDims.w / arenaDims.h : 1; // aspect ratio w/h

  // ── Movement range ──────────────────────────────────────────

  // ── Grid lines ───────────────────────────────────────────────
  const gridEl = (() => {
    if (!combat.gridVisible) return null;
    const n = combat.gridDensity || 10;
    const lines: React.ReactNode[] = [];
    for (let i = 1; i < n; i++) {
      const v = (i / n) * 100;
      // Linhas-mestras (a cada 2) recebem mais brilho dourado — filigrana
      const major = i % 2 === 0;
      const stroke = major ? 'rgba(240,192,96,0.16)' : 'rgba(212,168,83,0.085)';
      const w = major ? 0.22 : 0.14;
      lines.push(
        <line key={`v${i}`} x1={v} y1={0} x2={v} y2={100}
          stroke={stroke} strokeWidth={w} />,
        <line key={`h${i}`} x1={0} y1={v} x2={100} y2={v}
          stroke={stroke} strokeWidth={w} />,
      );
    }
    return <g>{lines}</g>;
  })();

  // ── AoE templates (persisted) ────────────────────────────────
  const aoeEl = (
    <g>
      {(combat.aoeTemplates || []).map(t => {
        const fill = t.color;
        const stroke = t.color.replace(/[0-9a-f]{2}$/i, 'cc');
        if (t.shape === 'circle' && t.radius != null) {
          return (
            <ellipse key={t.id} cx={t.x} cy={t.y}
              rx={t.radius} ry={t.radius * ar}
              fill={fill} stroke={stroke} strokeWidth={0.4} />
          );
        }
        if (t.shape === 'cone' && t.angle != null && t.arc != null && t.length != null) {
          return (
            <path key={t.id}
              d={conePathD(t.x, t.y, t.angle, t.arc, t.length)}
              fill={fill} stroke={stroke} strokeWidth={0.4} />
          );
        }
        if (t.shape === 'line' && t.angle != null && t.length != null && t.width != null) {
          return (
            <path key={t.id}
              d={linePathD(t.x, t.y, t.angle, t.length, t.width)}
              fill={fill} stroke={stroke} strokeWidth={0.4} />
          );
        }
        return null;
      })}
      {/* AoE preview while placing */}
      {aoePreview && (() => {
        const t = aoePreview;
        const fill = t.color;
        if (t.shape === 'circle' && t.radius != null) {
          return <ellipse cx={t.x} cy={t.y} rx={t.radius} ry={t.radius * ar}
            fill={fill} stroke="white" strokeWidth={0.3} strokeDasharray="1.5 1" />;
        }
        if (t.shape === 'cone' && t.angle != null && t.arc != null && t.length != null) {
          return <path d={conePathD(t.x, t.y, t.angle, t.arc, t.length)}
            fill={fill} stroke="white" strokeWidth={0.3} strokeDasharray="1.5 1" />;
        }
        if (t.shape === 'line' && t.angle != null && t.length != null && t.width != null) {
          return <path d={linePathD(t.x, t.y, t.angle, t.length, t.width)}
            fill={fill} stroke="white" strokeWidth={0.3} strokeDasharray="1.5 1" />;
        }
        return null;
      })()}
    </g>
  );

  // ── Rulers ───────────────────────────────────────────────────
  const rulersEl = (
    <g>
      {rulers.map(r => {
        const dist = correctedDist(r.start, r.end, ar);
        const mx = (r.start.x + r.end.x) / 2;
        const my = (r.start.y + r.end.y) / 2;
        return (
          <g key={r.id}>
            <line x1={r.start.x} y1={r.start.y} x2={r.end.x} y2={r.end.y}
              stroke="#67e8f9" strokeWidth={0.5} strokeDasharray="1.5 0.8" />
            <circle cx={r.start.x} cy={r.start.y} r={0.8} fill="#67e8f9" />
            <circle cx={r.end.x} cy={r.end.y} r={0.8} fill="#67e8f9" />
            <text x={mx} y={my - 2} textAnchor="middle" fontSize={2.5}
              fill="#67e8f9" fontWeight="bold"
              style={{ fontFamily: 'monospace', filter: 'drop-shadow(0 0 2px rgba(0,0,0,1))' }}>
              {dist.toFixed(1)}u
            </text>
          </g>
        );
      })}
      {rulerDraft && (() => {
        const dist = correctedDist(rulerDraft.start, rulerDraft.end, ar);
        const mx = (rulerDraft.start.x + rulerDraft.end.x) / 2;
        const my = (rulerDraft.start.y + rulerDraft.end.y) / 2;
        return (
          <g>
            <line x1={rulerDraft.start.x} y1={rulerDraft.start.y}
              x2={rulerDraft.end.x} y2={rulerDraft.end.y}
              stroke="#67e8f9" strokeWidth={0.5} strokeDasharray="1 0.5" opacity={0.7} />
            <circle cx={rulerDraft.start.x} cy={rulerDraft.start.y} r={0.8} fill="#67e8f9" />
            <text x={mx} y={my - 2} textAnchor="middle" fontSize={2.5}
              fill="#67e8f9" fontWeight="bold"
              style={{ fontFamily: 'monospace', filter: 'drop-shadow(0 0 2px rgba(0,0,0,1))' }}>
              {dist.toFixed(1)}u
            </text>
          </g>
        );
      })()}
    </g>
  );

  // ── Fog mask ─────────────────────────────────────────────────
  const fogEl = (() => {
    const fog = combat.fog;
    if (!fog || !showFog) return null;
    const n = fog.density;
    const cw = 100 / n;
    const ch = 100 / n;

    if (fogMaskOpaque) {
      // Player mode: SVG mask blocks unrevealed areas
      return (
        <g>
          <defs>
            <mask id="fog-mask">
              <rect width="100" height="100" fill="white" />
              {fog.revealed.map((row, r) =>
                row.map((rev, c) =>
                  rev ? (
                    <rect key={`${r}-${c}`}
                      x={c * cw} y={r * ch} width={cw} height={ch}
                      fill="black" />
                  ) : null,
                ),
              )}
            </mask>
          </defs>
          <rect width="100" height="100" fill="rgba(0,0,0,0.92)" mask="url(#fog-mask)" />
        </g>
      );
    }

    // Master mode: semi-transparent overlay on unrevealed cells
    return (
      <g opacity={0.55}>
        {fog.revealed.map((row, r) =>
          row.map((rev, c) =>
            !rev ? (
              <rect key={`${r}-${c}`}
                x={c * cw} y={r * ch} width={cw} height={ch}
                fill="rgba(0,0,20,0.7)" />
            ) : null,
          ),
        )}
      </g>
    );
  })();

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: onSvgPointerDown ? 'auto' : 'none',
        zIndex: 10,
        overflow: 'visible',
      }}
      onPointerDown={onSvgPointerDown}
      onPointerMove={onSvgPointerMove}
      onPointerUp={onSvgPointerUp}
    >
      {gridEl}
      {aoeEl}
      {fogEl}
      {rulersEl}
    </svg>
  );
};

export { svgPoint };
export default GridSVGLayer;
