import type { Id, Pool, ResourceKey } from '@vtt/core';
import { useEffect, useState, type KeyboardEvent } from 'react';
import type { Send } from './types';

const LABELS: Record<ResourceKey, string> = { hp: 'HP', aura: 'Aura', ammo: 'Munição' };
const STEPS = [
  { label: '−5', delta: -5 },
  { label: '−1', delta: -1 },
  { label: '+1', delta: 1 },
  { label: '+5', delta: 5 },
];

interface Props {
  characterId: Id;
  resource: ResourceKey;
  pool: Pool;
  send: Send;
}

export function ResourceEditor({ characterId, resource, pool, send }: Props) {
  const name = LABELS[resource];
  const [cur, setCur] = useState(String(pool.current));
  const [max, setMax] = useState(String(pool.max));
  useEffect(() => setCur(String(pool.current)), [pool.current]);
  useEffect(() => setMax(String(pool.max)), [pool.max]);

  const step = (delta: number) => {
    const current = Math.min(pool.max, Math.max(0, pool.current + delta));
    void send({ type: 'setResource', characterId, resource, current });
  };

  const commit = (field: 'current' | 'max', raw: string) => {
    const value = Math.trunc(Number(raw));
    if (raw.trim() === '' || !Number.isFinite(value) || value === pool[field]) {
      setCur(String(pool.current));
      setMax(String(pool.max));
      return;
    }
    void send({ type: 'setResource', characterId, resource, [field]: value });
  };
  const onKey = (field: 'current' | 'max', raw: string) => (e: KeyboardEvent) => {
    if (e.key === 'Enter') commit(field, raw);
  };

  return (
    <div className="resource-editor">
      <strong>{name}</strong>
      <div className="resource-row">
        {STEPS.map((s) => (
          <button key={s.label} type="button" aria-label={`${name} ${s.label}`} onClick={() => step(s.delta)}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="resource-row">
        <input type="number" aria-label={`${name} atual`} value={cur}
          onChange={(e) => setCur(e.target.value)} onBlur={() => commit('current', cur)}
          onKeyDown={onKey('current', cur)} />
        <span>/</span>
        <input type="number" aria-label={`${name} máx`} value={max}
          onChange={(e) => setMax(e.target.value)} onBlur={() => commit('max', max)}
          onKeyDown={onKey('max', max)} />
      </div>
    </div>
  );
}
