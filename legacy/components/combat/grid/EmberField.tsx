import React from 'react';

/**
 * EmberField — camada atmosférica de brasas ardentes que sobem pela arena.
 * Puramente decorativa (pointer-events: none). As animações são gated por
 * `[data-reduced-motion='true']` no CSS (.mp-embers em index.html).
 *
 * Cada brasa recebe parâmetros pseudo-aleatórios estáveis (seed por índice)
 * para evitar "saltos" entre renders.
 */

interface EmberSpec {
  left: number;       // %
  size: number;       // px
  delay: number;      // s
  duration: number;   // s
  drift: number;      // px (deslocamento horizontal no topo)
  hue: 'gold' | 'ember' | 'spark';
  opacity: number;
}

// Seed determinístico simples (mulberry-ish) para posições estáveis.
function seeded(i: number): EmberSpec {
  const r = (n: number) => {
    const x = Math.sin(i * 99.13 + n * 27.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const hueRoll = r(5);
  return {
    left: 4 + r(1) * 92,
    size: 2 + r(2) * 5,
    delay: r(3) * 9,
    duration: 7 + r(4) * 7,
    drift: (r(6) - 0.5) * 60,
    hue: hueRoll < 0.5 ? 'ember' : hueRoll < 0.82 ? 'gold' : 'spark',
    opacity: 0.35 + r(7) * 0.5,
  };
}

const EMBERS = Array.from({ length: 16 }, (_, i) => seeded(i));

const EmberField: React.FC<{ count?: number }> = ({ count = 16 }) => {
  const embers = count === 16 ? EMBERS : EMBERS.slice(0, count);
  return (
    <div className="mp-embers" aria-hidden>
      {embers.map((e, i) => (
        <span
          key={i}
          className={`mp-ember mp-ember--${e.hue}`}
          style={{
            left: `${e.left}%`,
            width: e.size,
            height: e.size,
            opacity: e.opacity,
            // CSS custom props consumidos pela animação keyframe
            ['--ember-delay' as string]: `${e.delay}s`,
            ['--ember-dur' as string]: `${e.duration}s`,
            ['--ember-drift' as string]: `${e.drift}px`,
          }}
        />
      ))}
    </div>
  );
};

export default EmberField;
