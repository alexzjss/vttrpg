import React from 'react';
import { Condition } from '../../types';

export type FxPattern = 'rise' | 'fall' | 'orbit' | 'vignette' | 'jitter';

export interface ConditionFxDef {
  pattern: FxPattern;
  emoji: string;
  color: string;
}

export const CONDITION_FX: Record<string, ConditionFxDef> = {
  'Queimando':    { pattern: 'rise',     emoji: '🔥', color: '#ef4444' },
  'Eletrocutado': { pattern: 'jitter',   emoji: '⚡', color: '#facc15' },
  'Molhado':      { pattern: 'fall',     emoji: '💧', color: '#38bdf8' },
  'Envenenado':   { pattern: 'rise',     emoji: '🧪', color: '#a3e635' },
  'Paralisado':   { pattern: 'jitter',   emoji: '🔒', color: '#94a3b8' },
  'Desnorteado':  { pattern: 'orbit',    emoji: '😵', color: '#f97316' },
  'Dormindo':     { pattern: 'rise',     emoji: '💤', color: '#818cf8' },
  'Sangrando':    { pattern: 'fall',     emoji: '🩸', color: '#dc2626' },
  'Amaldiçoado':  { pattern: 'vignette', emoji: '💀', color: '#7c3aed' },
  'Amedrontado':  { pattern: 'vignette', emoji: '😱', color: '#c084fc' },
  'Confuso':      { pattern: 'orbit',    emoji: '🌀', color: '#fb7185' },
  'Cego':         { pattern: 'vignette', emoji: '🌑', color: '#334155' },
  'Imobilizado':  { pattern: 'jitter',   emoji: '🧲', color: '#b45309' },
  'Regenerando':  { pattern: 'rise',     emoji: '💚', color: '#22c55e' },
  'Protegido':    { pattern: 'orbit',    emoji: '🛡', color: '#64748b' },
};

export const DEFAULT_FX: ConditionFxDef = { pattern: 'rise', emoji: '✨', color: '#94a3b8' };

export function getConditionFx(name: string): ConditionFxDef {
  return CONDITION_FX[name] ?? DEFAULT_FX;
}

/** Dedupe by name, keeping the instance with the highest remaining duration. */
export function dedupeConditions(conditions: Condition[]): Condition[] {
  const map = new Map<string, Condition>();
  for (const c of conditions) {
    const existing = map.get(c.name);
    if (!existing || c.duration > existing.duration) map.set(c.name, c);
  }
  return Array.from(map.values());
}

const PARTICLE_COUNTS: Record<FxPattern, number> = {
  rise: 6, fall: 6, orbit: 5, vignette: 0, jitter: 4,
};

export const ConditionEffectOverlay: React.FC<{ conditions: Condition[]; maxLayers?: number }> = ({
  conditions, maxLayers = 3,
}) => {
  const unique = dedupeConditions(conditions).slice(0, maxLayers);
  if (unique.length === 0) return null;
  return (
    <div className="mp-cond-overlay" data-testid="condition-overlay">
      {unique.map(cond => {
        const fx = getConditionFx(cond.name);
        const count = PARTICLE_COUNTS[fx.pattern];
        return (
          <div
            key={cond.name}
            className={`mp-cond-fx mp-cond-fx--${fx.pattern}`}
            style={{ ['--cond-color' as string]: fx.color } as React.CSSProperties}
            data-testid={`condition-fx-${cond.name}`}
          >
            {Array.from({ length: count }).map((_, i) => (
              <span
                key={i}
                className="mp-cond-particle"
                style={{
                  ['--i' as string]: i,
                  left: `${8 + i * (84 / Math.max(1, count - 1 || 1))}%`,
                  animationDelay: `${i * 0.22}s`,
                } as React.CSSProperties}
              >
                {fx.emoji}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
};

export const ConditionBadgeRow: React.FC<{
  conditions: Condition[];
  maxVisible: number;
  className?: string;
}> = ({ conditions, maxVisible, className }) => {
  const unique = dedupeConditions(conditions);
  if (unique.length === 0) return null;
  const visible = unique.slice(0, maxVisible);
  const overflow = unique.slice(maxVisible);
  return (
    <div className={`mp-cond-badges ${className ?? ''}`.trim()} data-testid="condition-badges">
      {visible.map(cond => {
        const fx = getConditionFx(cond.name);
        return (
          <span
            key={cond.name}
            className="mp-cond-badge"
            style={{ ['--cond-color' as string]: fx.color } as React.CSSProperties}
            title={`${cond.name} (${cond.duration} rodada${cond.duration === 1 ? '' : 's'})`}
          >
            {fx.emoji}
          </span>
        );
      })}
      {overflow.length > 0 && (
        <span
          className="mp-cond-badge mp-cond-badge--overflow"
          title={overflow.map(c => c.name).join(', ')}
        >
          +{overflow.length}
        </span>
      )}
    </div>
  );
};

export const ConditionEffectStyles: React.FC = () => (
  <style>{`
    .mp-cond-overlay {
      position: absolute; inset: 0; overflow: hidden;
      pointer-events: none; border-radius: inherit; z-index: 2;
    }
    .mp-cond-fx { position: absolute; inset: 0; }
    .mp-cond-particle {
      position: absolute; bottom: -10%; font-size: 14px;
      color: var(--cond-color); text-shadow: 0 0 6px var(--cond-color);
      opacity: 0;
    }
    .mp-cond-fx--rise .mp-cond-particle { animation: mp-cond-rise 2.2s ease-in infinite; }
    @keyframes mp-cond-rise {
      0% { transform: translateY(0) scale(0.8); opacity: 0; }
      15% { opacity: 0.9; }
      100% { transform: translateY(-140%) scale(1.1); opacity: 0; }
    }
    .mp-cond-fx--fall .mp-cond-particle { top: -10%; bottom: auto; animation: mp-cond-fall 1.8s ease-in infinite; }
    @keyframes mp-cond-fall {
      0% { transform: translateY(0) scale(0.9); opacity: 0; }
      15% { opacity: 0.9; }
      100% { transform: translateY(220%) scale(1); opacity: 0; }
    }
    .mp-cond-fx--orbit .mp-cond-particle {
      top: 50%; bottom: auto;
      animation: mp-cond-orbit 3.5s linear infinite;
      opacity: 0.85;
    }
    @keyframes mp-cond-orbit {
      0% { transform: rotate(calc(var(--i) * 72deg)) translateX(46%) rotate(0deg); }
      100% { transform: rotate(calc(var(--i) * 72deg + 360deg)) translateX(46%) rotate(-360deg); }
    }
    .mp-cond-fx--jitter {
      animation: mp-cond-jitter 0.3s steps(2) infinite;
      background: radial-gradient(circle, var(--cond-color, #fff) 0%, transparent 70%);
      opacity: 0.18;
    }
    @keyframes mp-cond-jitter {
      0% { transform: translate(0,0); }
      50% { transform: translate(1px,-1px); }
      100% { transform: translate(-1px,1px); }
    }
    .mp-cond-fx--vignette {
      background: radial-gradient(circle at 50% 50%, transparent 40%, var(--cond-color, #000) 130%);
      opacity: 0.35;
      animation: mp-cond-pulse 2.6s ease-in-out infinite;
    }
    @keyframes mp-cond-pulse {
      0%, 100% { opacity: 0.25; }
      50% { opacity: 0.5; }
    }

    .mp-cond-badges {
      display: flex; align-items: center; gap: 3px; flex-wrap: wrap;
    }
    .mp-cond-badge {
      display: inline-flex; align-items: center; justify-content: center;
      width: 18px; height: 18px; border-radius: 50%;
      font-size: 11px; line-height: 1;
      background: rgba(8,10,16,0.75);
      border: 1.5px solid var(--cond-color, rgba(255,255,255,0.3));
      box-shadow: 0 0 6px var(--cond-color, transparent);
    }
    .mp-cond-badge--overflow {
      color: rgba(255,255,255,0.8); font-size: 9px; font-weight: 700;
      border-color: rgba(255,255,255,0.3);
    }
    .mp-token-conditions {
      position: absolute; top: -14px; left: 50%;
      transform: translateX(-50%);
      z-index: 25;
    }
  `}</style>
);
