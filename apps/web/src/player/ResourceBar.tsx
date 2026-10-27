import type { Pool } from '@vtt/core';

interface Props {
  label: string;
  pool: Pool;
}

/** Barra de um recurso: "atual / máx" com preenchimento proporcional. */
export function ResourceBar({ label, pool }: Props) {
  const pct = pool.max > 0 ? Math.min(100, Math.max(0, (pool.current / pool.max) * 100)) : 0;
  return (
    <div className="resource-bar">
      <div className="resource-bar-head">
        <span>{label}</span>
        <span>{`${pool.current} / ${pool.max}`}</span>
      </div>
      <div
        className="resource-bar-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={pool.max}
        aria-valuenow={pool.current}
      >
        <div className="resource-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
