import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimFxStyles,
  deriveTier,
  getJuice,
  getPacing,
  prefersReducedMotion,
  useAnimSequence,
  useScramble,
} from './combat/animFx';

export type CardElement = string;

type TargetSnapshot = {
  name: string;
  icon?: string;
  combatId?: string;
};

type RollSnapshot = {
  total: number;
  notation?: string;
  individualRolls?: number[];
  numSides?: number;
  bonus?: number;
};

export interface CardAnimPayload {
  attackCard: {
    name: string;
    image?: string;
    type: string;
    auraCost: number;
    diceRoll?: string;
    damage?: number;
    conditionEffect?: string;
    element?: CardElement;
  };
  attacker: { name: string; icon?: string };
  target?: TargetSnapshot;
  areaTargets?: TargetSnapshot[];
  attackRoll: RollSnapshot;
  reactionCard?: {
    name: string;
    image?: string;
    type: string;
    auraCost: number;
    diceRoll?: string;
  };
  reactionRoll?: RollSnapshot;
  isSuccess: boolean;
  isCrit?: boolean;
  isFumble?: boolean;
  dramatic?: boolean;
}

interface Props {
  payload: CardAnimPayload | null;
  onComplete: () => void;
}

type Phase = 'card' | 'reaction' | 'rolls' | 'result' | 'resolve';
type ResultKind = 'action-win' | 'reaction-win' | 'hit' | 'crit' | 'miss' | 'fumble';

type TargetPoint = {
  x: number;
  y: number;
  name: string;
};

const REACTION_VARIANTS = [
  { key: 'break', label: 'REACAO QUEBRA O COMANDO' },
  { key: 'launch', label: 'REACAO ARREMESSA PARA LONGE' },
  { key: 'cover', label: 'REACAO ENCOBRE A ACAO' },
  { key: 'shatter', label: 'REACAO ESTILHACA A OFENSIVA' },
] as const;

const TYPE_COLORS: Record<string, string> = {
  ataque: '#f43f5e',
  acao: '#f59e0b',
  'ação': '#f59e0b',
  'aÃ§Ã£o': '#f59e0b',
  reforco: '#22c55e',
  'reforço': '#22c55e',
  'reforÃ§o': '#22c55e',
  reacao: '#38bdf8',
  'reação': '#38bdf8',
  'reaÃ§Ã£o': '#38bdf8',
  vinculo: '#e2e8f0',
  'vínculo': '#e2e8f0',
  'vÃ­nculo': '#e2e8f0',
  combinacao: '#c084fc',
  'combinação': '#c084fc',
  'combinaÃ§Ã£o': '#c084fc',
};

function normalizeKey(value?: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function cardAccent(card: CardAnimPayload['attackCard'] | CardAnimPayload['reactionCard']): string {
  const key = normalizeKey(card?.type);
  return TYPE_COLORS[key] || TYPE_COLORS[card?.type || ''] || '#d4a853';
}

function elementClass(element?: string, type?: string): string {
  const key = normalizeKey(element || type);
  if (key.includes('fogo')) return 'fire';
  if (key.includes('agua') || key.includes('aqua')) return 'water';
  if (key.includes('terra')) return 'earth';
  if (key.includes('vento') || key.includes('ar')) return 'wind';
  if (key.includes('raio') || key.includes('trovao') || key.includes('eletric')) return 'lightning';
  if (key.includes('refor')) return 'support';
  if (key.includes('vinc')) return 'bond';
  return 'neutral';
}

function rollBreakdown(roll: RollSnapshot): string {
  const parts = roll.individualRolls && roll.individualRolls.length > 0 ? roll.individualRolls : [roll.total];
  const bonus = roll.bonus || 0;
  const body = parts.join(' + ');
  if (bonus > 0) return `${body} + ${bonus}`;
  if (bonus < 0) return `${body} - ${Math.abs(bonus)}`;
  return body;
}

function resultInfo(payload: CardAnimPayload): {
  kind: ResultKind;
  title: string;
  subtitle: string;
  accent: string;
  secondary: string;
} {
  const hasReaction = !!payload.reactionCard && !!payload.reactionRoll;
  const attackTotal = payload.attackRoll.total;
  const reactionTotal = payload.reactionRoll?.total;

  if (hasReaction) {
    if (payload.isSuccess) {
      return {
        kind: 'action-win',
        title: 'ACAO VENCE',
        subtitle: `${attackTotal} supera ${reactionTotal}`,
        accent: '#55efc4',
        secondary: '#f59e0b',
      };
    }
    return {
      kind: 'reaction-win',
      title: 'REACAO VENCE',
      subtitle: `${reactionTotal} segura ${attackTotal}`,
      accent: '#38bdf8',
      secondary: '#c084fc',
    };
  }

  if (payload.isFumble) {
    return {
      kind: 'fumble',
      title: 'FALHA CRITICA',
      subtitle: `${attackTotal} derruba a acao`,
      accent: '#ef4444',
      secondary: '#7f1d1d',
    };
  }

  if (payload.isCrit) {
    return {
      kind: 'crit',
      title: 'ACERTO CRITICO',
      subtitle: `${attackTotal} rompe o limite`,
      accent: '#22d3ee',
      secondary: '#67e8f9',
    };
  }

  if (payload.isSuccess) {
    return {
      kind: 'hit',
      title: 'ACERTO',
      subtitle: `${attackTotal} confirma a acao`,
      accent: '#22c55e',
      secondary: '#86efac',
    };
  }

  return {
    kind: 'miss',
    title: 'FALHA',
    subtitle: `${attackTotal} nao alcanca o alvo`,
    accent: '#f59e0b',
    secondary: '#facc15',
  };
}

function findTargetPoint(target: TargetSnapshot, fallbackIndex: number, total: number): TargetPoint {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 720;
  const safeId = target.combatId ? target.combatId.replace(/["\\]/g, '\\$&') : '';
  const el = safeId && typeof document !== 'undefined'
    ? document.querySelector<HTMLElement>(`[data-combat-token="${safeId}"]`)
    : null;

  if (el) {
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      name: target.name,
    };
  }

  const spread = Math.min(220, vw * 0.22);
  const offset = total <= 1 ? 0 : fallbackIndex - (total - 1) / 2;
  return {
    x: vw / 2 + offset * spread,
    y: vh * 0.58 + Math.sin(fallbackIndex) * 40,
    name: target.name,
  };
}

function getTargets(payload: CardAnimPayload): TargetSnapshot[] {
  if (payload.areaTargets && payload.areaTargets.length > 0) return payload.areaTargets;
  if (payload.target) return [payload.target];
  return [];
}

const BattleCard: React.FC<{
  card: CardAnimPayload['attackCard'] | NonNullable<CardAnimPayload['reactionCard']>;
  owner: string;
  role: 'attack' | 'reaction';
}> = ({ card, owner, role }) => {
  const accent = cardAccent(card);
  const initials = card.name.trim().slice(0, 2).toUpperCase();

  return (
    <div
      className={`mp-card-seq-card mp-card-seq-card--${role}`}
      style={{ ['--seq-card-accent' as any]: accent } as React.CSSProperties}
    >
      <div className="mp-card-seq-card__cut" />
      <div className="mp-card-seq-card__media">
        {card.image ? (
          <img src={card.image} alt="" />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      <div className="mp-card-seq-card__body">
        <span className="mp-card-seq-card__role">{role === 'reaction' ? 'REACAO' : 'COMANDO'}</span>
        <strong>{card.name}</strong>
        <small>{owner}</small>
      </div>
      <div className="mp-card-seq-card__stats">
        <span>{card.diceRoll || 'sem roll'}</span>
        <span>{card.auraCost} AP</span>
      </div>
    </div>
  );
};

const SeqDie: React.FC<{ value: number; sides: number; rolling: boolean }> = ({ value, sides, rolling }) => {
  const shown = useScramble(value, sides, rolling);
  return (
    <div className={`mp-card-seq-die ${rolling ? 'mp-card-seq-die--rolling' : 'mp-card-seq-die--settled'}`}>
      <span className="mp-card-seq-die__face">{rolling ? shown : value}</span>
      <span className="mp-card-seq-die__edge" aria-hidden />
    </div>
  );
};

const RollPanel: React.FC<{
  label: string;
  roll: RollSnapshot;
  active: boolean;
  tone: string;
  rolling: boolean;
}> = ({ label, roll, active, tone, rolling }) => (
  <div
    className={`mp-card-seq-roll-panel ${active ? 'mp-card-seq-roll-panel--active' : ''} ${rolling ? 'mp-card-seq-roll-panel--rolling' : ''}`}
    style={{ ['--seq-roll-tone' as any]: tone } as React.CSSProperties}
  >
    <span className="mp-card-seq-roll-panel__label">{label}</span>
    <span className="mp-card-seq-roll-panel__notation">{roll.notation || '1d20'}</span>
    <SeqDie value={roll.total} sides={roll.numSides ?? 20} rolling={rolling} />
    <span className="mp-card-seq-roll-panel__breakdown">{rolling ? '· rolando ·' : rollBreakdown(roll)}</span>
  </div>
);

const CardRevealAnimation: React.FC<Props> = ({ payload, onComplete }) => {
  const [targetPoints, setTargetPoints] = useState<TargetPoint[]>([]);
  useEffect(() => {
    setTargetPoints([]);
  }, [payload]);
  const variantRef = useRef(REACTION_VARIANTS[0]);

  const reduced = prefersReducedMotion();
  const info = useMemo(() => payload ? resultInfo(payload) : null, [payload]);
  const hasReaction = !!payload?.reactionCard && !!payload?.reactionRoll;
  const attackAccent = payload ? cardAccent(payload.attackCard) : '#d4a853';
  const reactionAccent = payload?.reactionCard ? cardAccent(payload.reactionCard) : '#38bdf8';
  const actionWins = !!payload && payload.isSuccess;
  const reactionWins = !!payload && hasReaction && !payload.isSuccess;
  const targets = useMemo(() => payload ? getTargets(payload) : [], [payload]);
  const actionElementClass = payload ? elementClass(payload.attackCard.element, payload.attackCard.type) : 'neutral';

  const tier = payload
    ? deriveTier({ dramatic: payload.dramatic, hasReaction, isCrit: payload.isCrit, isFumble: payload.isFumble })
    : 'trivial';
  const pacing = getPacing(tier, reduced);
  const juice = info ? getJuice(info.kind, reduced) : { shakePx: 0, flash: false };

  useMemo(() => {
    variantRef.current = REACTION_VARIANTS[Math.floor(Math.random() * REACTION_VARIANTS.length)];
    return null;
  }, [payload]);

  const steps = useMemo(() => {
    const s: { phase: Phase; delay: number }[] = [{ phase: 'card', delay: 0 }];
    if (hasReaction) s.push({ phase: 'reaction', delay: pacing.cardShown });
    s.push({ phase: 'rolls', delay: hasReaction ? pacing.reactionShown : pacing.cardShown });
    s.push({ phase: 'result', delay: pacing.rollsShown });
    s.push({ phase: 'resolve', delay: pacing.resultShown });
    return s;
  }, [hasReaction, pacing.cardShown, pacing.reactionShown, pacing.rollsShown, pacing.resultShown]);

  const { phase, skip } = useAnimSequence<Phase>({
    steps,
    tailMs: pacing.resolveShown,
    runKey: payload,
    onComplete,
    active: !!payload,
  });

  useEffect(() => {
    if (phase === 'resolve' && payload) {
      setTargetPoints(targets.map((target, index) => findTargetPoint(target, index, targets.length)));
    }
  }, [phase, payload, targets]);

  if (!payload || !info) return null;

  const showReactionCard = hasReaction && phase !== 'card';
  const showRolls = phase === 'rolls' || phase === 'result' || phase === 'resolve';
  const showResult = phase === 'result' || phase === 'resolve';
  const centerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 640;
  const centerY = typeof window !== 'undefined' ? window.innerHeight * 0.56 : 400;
  const resolvedTargets = targetPoints.length > 0 ? targetPoints : targets.map((target, index) => findTargetPoint(target, index, targets.length));

  return (
    <div
      className={`mp-card-seq mp-card-seq--${phase} mp-card-seq--${info.kind} mp-card-seq-element--${actionElementClass} ${(phase === 'result' || phase === 'resolve') && juice.shakePx > 0 ? 'mp-fx-shake' : ''}`}
      style={{
        ['--seq-accent' as any]: info.accent,
        ['--seq-secondary' as any]: info.secondary,
        ['--seq-attack-accent' as any]: attackAccent,
        ['--seq-reaction-accent' as any]: reactionAccent,
        ['--fx-shake' as any]: `${juice.shakePx}px`,
      } as React.CSSProperties}
      onClick={skip}
      aria-hidden="true"
    >
      <AnimFxStyles />
      {(phase === 'result' || phase === 'resolve') && juice.flash && (
        <div className="mp-fx-flash" style={{ ['--fx-flash-color' as any]: info.accent } as React.CSSProperties} />
      )}
      <style>{`
        .mp-card-seq {
          position: fixed;
          inset: 0;
          z-index: 99990;
          pointer-events: auto;
          cursor: pointer;
          overflow: hidden;
          color: #fff7d6;
          font-family: "Inter", "Rajdhani", system-ui, sans-serif;
          background:
            radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--seq-accent) 26%, transparent), transparent 34%),
            radial-gradient(ellipse 60% 50% at 50% 8%, rgba(249,115,22,0.14), transparent 60%),
            linear-gradient(110deg, rgba(20,13,7,0.34), rgba(12,8,4,0.62));
          animation: mp-card-seq-enter 180ms ease-out both;
        }

        .mp-card-seq::before,
        .mp-card-seq::after {
          content: "";
          position: absolute;
          inset: -20%;
          background:
            repeating-linear-gradient(116deg, transparent 0 34px, rgba(255,255,255,0.07) 35px 37px, transparent 38px 76px);
          transform: translateX(-12%) skewX(-12deg);
          opacity: 0.46;
          mix-blend-mode: screen;
          animation: mp-card-seq-stripes 1.35s linear infinite;
        }

        .mp-card-seq::after {
          background:
            linear-gradient(105deg, transparent 10%, color-mix(in srgb, var(--seq-accent) 54%, transparent) 46%, transparent 55%);
          opacity: 0;
          animation: mp-card-seq-sweep 760ms ease-out 180ms both;
        }

        .mp-card-seq-stage {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
        }

        .mp-card-seq-card {
          position: absolute;
          width: min(270px, 34vw);
          min-width: 190px;
          aspect-ratio: 0.72;
          top: 50%;
          left: 50%;
          border: 2px solid var(--seq-card-accent);
          clip-path: polygon(10% 0, 100% 0, 90% 100%, 0 100%);
          background:
            linear-gradient(160deg, rgba(255,231,170,0.16), transparent 22%),
            linear-gradient(180deg, rgba(30,19,11,0.97), rgba(38,23,13,0.95));
          box-shadow:
            0 0 0 1px rgba(255,221,150,0.12) inset,
            0 22px 70px rgba(0,0,0,0.66),
            0 0 46px color-mix(in srgb, var(--seq-card-accent) 58%, transparent);
          overflow: hidden;
          transform: translate(-50%, -50%) rotate(-7deg) scale(0.9);
        }

        .mp-card-seq-card--attack {
          animation: mp-card-seq-card-in 520ms cubic-bezier(0.2, 1, 0.24, 1) both;
        }

        .mp-card-seq-card--reaction {
          left: calc(50% + min(190px, 20vw));
          transform: translate(-50%, -50%) rotate(7deg) scale(0.9);
          animation: mp-card-seq-reaction-in 520ms cubic-bezier(0.2, 1, 0.24, 1) both;
        }

        .mp-card-seq--rolls .mp-card-seq-card--attack,
        .mp-card-seq--result .mp-card-seq-card--attack,
        .mp-card-seq--resolve .mp-card-seq-card--attack {
          animation: mp-card-seq-card-park-left 520ms cubic-bezier(0.2, 1, 0.24, 1) both;
        }

        .mp-card-seq--rolls .mp-card-seq-card--reaction,
        .mp-card-seq--result .mp-card-seq-card--reaction,
        .mp-card-seq--resolve .mp-card-seq-card--reaction {
          animation: mp-card-seq-card-park-right 520ms cubic-bezier(0.2, 1, 0.24, 1) both;
        }

        .mp-card-seq-card__cut {
          position: absolute;
          inset: 10px;
          border: 1px solid color-mix(in srgb, var(--seq-card-accent) 78%, transparent);
          clip-path: polygon(10% 0, 100% 0, 90% 100%, 0 100%);
          opacity: 0.72;
        }

        .mp-card-seq-card__media {
          position: absolute;
          inset: 14px 18px auto 18px;
          height: 56%;
          clip-path: polygon(9% 0, 100% 0, 91% 100%, 0 100%);
          background:
            radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--seq-card-accent) 50%, transparent), transparent 62%),
            rgba(255,255,255,0.05);
          display: grid;
          place-items: center;
          overflow: hidden;
        }

        .mp-card-seq-card__media img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: saturate(1.25) contrast(1.05);
        }

        .mp-card-seq-card__media span {
          font-size: clamp(38px, 6vw, 74px);
          font-weight: 1000;
          color: var(--seq-card-accent);
          text-shadow: 0 0 22px var(--seq-card-accent);
        }

        .mp-card-seq-card__body {
          position: absolute;
          left: 26px;
          right: 26px;
          bottom: 56px;
          display: grid;
          gap: 6px;
        }

        .mp-card-seq-card__role,
        .mp-card-seq-card__stats span,
        .mp-card-seq-roll-panel__label,
        .mp-card-seq-result__eyebrow {
          font-size: 10px;
          font-weight: 1000;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }

        .mp-card-seq-card__role {
          color: var(--seq-card-accent);
        }

        .mp-card-seq-card__body strong {
          font-size: clamp(20px, 2.5vw, 30px);
          line-height: 0.95;
          font-weight: 1000;
          text-transform: uppercase;
          font-style: italic;
          color: white;
          text-shadow: 0 0 20px rgba(0,0,0,0.8);
        }

        .mp-card-seq-card__body small {
          color: rgba(255,255,255,0.68);
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .mp-card-seq-card__stats {
          position: absolute;
          left: 24px;
          right: 24px;
          bottom: 22px;
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }

        .mp-card-seq-card__stats span {
          color: rgba(255,255,255,0.82);
          background: rgba(0,0,0,0.36);
          border: 1px solid rgba(255,255,255,0.14);
          padding: 6px 9px;
          clip-path: polygon(10% 0, 100% 0, 90% 100%, 0 100%);
        }

        .mp-card-seq-rolls {
          position: absolute;
          left: 50%;
          top: 50%;
          display: grid;
          grid-template-columns: minmax(190px, 250px) minmax(190px, 250px);
          gap: 22px;
          transform: translate(-50%, -50%);
          opacity: 0;
          animation: mp-card-seq-rolls-in 520ms cubic-bezier(0.2, 1, 0.24, 1) both;
        }

        .mp-card-seq-rolls--solo {
          grid-template-columns: minmax(210px, 280px);
        }

        .mp-card-seq-roll-panel {
          position: relative;
          min-height: 190px;
          padding: 24px 24px 20px;
          display: grid;
          align-content: center;
          justify-items: center;
          gap: 8px;
          clip-path: polygon(10% 0, 100% 0, 90% 100%, 0 100%);
          border: 2px solid color-mix(in srgb, var(--seq-roll-tone) 72%, rgba(255,255,255,0.12));
          background:
            linear-gradient(160deg, color-mix(in srgb, var(--seq-roll-tone) 30%, transparent), transparent 42%),
            linear-gradient(180deg, rgba(24,15,8,0.93), rgba(16,10,6,0.94));
          box-shadow: 0 18px 55px rgba(0,0,0,0.6), inset 0 0 36px rgba(124,45,18,0.1);
          overflow: hidden;
        }

        .mp-card-seq-roll-panel::before {
          content: "";
          position: absolute;
          inset: -35%;
          background: conic-gradient(from 90deg, transparent, color-mix(in srgb, var(--seq-roll-tone) 48%, transparent), transparent);
          opacity: 0.46;
          animation: mp-card-seq-roll-scan 820ms linear infinite;
        }

        .mp-card-seq-roll-panel--active {
          box-shadow:
            0 0 0 2px color-mix(in srgb, var(--seq-roll-tone) 72%, transparent),
            0 22px 80px color-mix(in srgb, var(--seq-roll-tone) 42%, transparent),
            inset 0 0 38px color-mix(in srgb, var(--seq-roll-tone) 18%, transparent);
          animation: mp-card-seq-winner-pulse 950ms ease-in-out infinite;
        }

        .mp-card-seq-roll-panel > * {
          position: relative;
          z-index: 1;
        }

        .mp-card-seq-roll-panel__label {
          color: var(--seq-roll-tone);
        }

        .mp-card-seq-roll-panel__notation,
        .mp-card-seq-roll-panel__breakdown {
          font-size: 12px;
          font-weight: 900;
          color: rgba(255,255,255,0.68);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        /* Dado tumbando */
        .mp-card-seq-die {
          position: relative;
          width: clamp(96px, 12vw, 150px);
          height: clamp(96px, 12vw, 150px);
          display: grid;
          place-items: center;
          margin: 2px 0;
        }
        .mp-card-seq-die__edge {
          position: absolute;
          inset: 0;
          clip-path: polygon(50% 0, 100% 27%, 100% 73%, 50% 100%, 0 73%, 0 27%);
          background:
            linear-gradient(150deg, color-mix(in srgb, var(--seq-roll-tone) 60%, #ffe7aa 20%), color-mix(in srgb, var(--seq-roll-tone) 70%, #000 30%));
          border: 2px solid color-mix(in srgb, var(--seq-roll-tone) 80%, #fff 12%);
          box-shadow:
            0 0 28px color-mix(in srgb, var(--seq-roll-tone) 55%, transparent),
            inset 0 0 22px rgba(0,0,0,0.45),
            inset 0 2px 6px rgba(255,255,255,0.3);
          z-index: 0;
        }
        .mp-card-seq-die__face {
          position: relative;
          z-index: 1;
          font-size: clamp(40px, 6vw, 66px);
          line-height: 1;
          font-weight: 1000;
          color: #fff7e2;
          font-family: 'JetBrains Mono', monospace;
          text-shadow: 0 2px 4px rgba(0,0,0,0.7), 0 0 18px color-mix(in srgb, var(--seq-roll-tone) 80%, transparent);
        }
        .mp-card-seq-die--rolling .mp-card-seq-die__edge {
          animation: mp-card-seq-die-tumble 0.5s linear infinite;
        }
        .mp-card-seq-die--rolling .mp-card-seq-die__face {
          animation: mp-card-seq-die-flick 0.5s linear infinite;
          opacity: 0.92;
        }
        .mp-card-seq-die--settled .mp-card-seq-die__edge {
          animation: mp-card-seq-die-land 480ms cubic-bezier(0.2, 1.6, 0.3, 1) both;
        }
        .mp-card-seq-die--settled .mp-card-seq-die__face {
          animation: mp-card-seq-number-pop 560ms cubic-bezier(0.2, 1.7, 0.25, 1) both;
        }
        @keyframes mp-card-seq-die-tumble {
          0%   { transform: rotate(0deg) scale(1); }
          25%  { transform: rotate(90deg) scale(0.9); }
          50%  { transform: rotate(180deg) scale(1.05); }
          75%  { transform: rotate(270deg) scale(0.92); }
          100% { transform: rotate(360deg) scale(1); }
        }
        @keyframes mp-card-seq-die-flick {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50%      { transform: translateY(-2px) rotate(-3deg); }
        }
        @keyframes mp-card-seq-die-land {
          0%   { transform: scale(1.18) rotate(-8deg); filter: brightness(1.5); }
          60%  { transform: scale(0.96) rotate(2deg); }
          100% { transform: scale(1) rotate(0deg); filter: brightness(1); }
        }

        .mp-card-seq-result {
          position: absolute;
          left: 50%;
          top: min(72vh, 650px);
          width: min(720px, calc(100vw - 34px));
          transform: translate(-50%, -50%);
          display: grid;
          justify-items: center;
          gap: 8px;
          padding: 22px 34px;
          clip-path: polygon(5% 0, 100% 0, 95% 100%, 0 100%);
          border: 2px solid var(--seq-accent);
          background:
            linear-gradient(100deg, color-mix(in srgb, var(--seq-accent) 28%, transparent), transparent 32%, color-mix(in srgb, var(--seq-secondary) 22%, transparent)),
            linear-gradient(180deg, rgba(22,14,7,0.94), rgba(14,9,5,0.95));
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.12) inset,
            0 26px 90px rgba(0,0,0,0.6),
            0 0 70px color-mix(in srgb, var(--seq-accent) 42%, transparent);
          animation: mp-card-seq-result-in 420ms cubic-bezier(0.2, 1, 0.24, 1) both;
        }

        .mp-card-seq-result__eyebrow {
          color: var(--seq-accent);
        }

        .mp-card-seq-result strong {
          font-size: clamp(30px, 7vw, 78px);
          line-height: 0.9;
          font-weight: 1000;
          text-transform: uppercase;
          font-style: italic;
          color: white;
          text-shadow: 0 0 30px var(--seq-accent);
          text-align: center;
        }

        .mp-card-seq-result span {
          font-size: 13px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: rgba(255,255,255,0.74);
          text-align: center;
        }

        .mp-card-seq-impact {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 260px;
          height: 260px;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          opacity: 0;
          pointer-events: none;
          background: radial-gradient(circle, color-mix(in srgb, var(--seq-accent) 62%, transparent), transparent 66%);
          animation: mp-card-seq-impact 850ms ease-out both;
        }

        .mp-card-seq-fly-card {
          position: absolute;
          left: 50%;
          top: 56%;
          width: 120px;
          aspect-ratio: 0.72;
          clip-path: polygon(10% 0, 100% 0, 90% 100%, 0 100%);
          border: 2px solid var(--seq-accent);
          background:
            linear-gradient(160deg, rgba(255,255,255,0.24), transparent 34%),
            linear-gradient(180deg, color-mix(in srgb, var(--seq-accent) 26%, #160d06), #160d06);
          box-shadow: 0 0 44px color-mix(in srgb, var(--seq-accent) 58%, transparent);
          display: grid;
          place-items: center;
          text-align: center;
          color: white;
          font-size: 12px;
          font-weight: 1000;
          text-transform: uppercase;
          line-height: 1;
          padding: 12px;
          animation: mp-card-seq-fly 920ms cubic-bezier(0.15, 0.8, 0.18, 1) both;
          animation-delay: var(--fly-delay);
        }

        .mp-card-seq-fly-card::before,
        .mp-card-seq-fly-card::after {
          content: "";
          position: absolute;
          inset: -18px;
          background: radial-gradient(circle, color-mix(in srgb, var(--seq-accent) 42%, transparent), transparent 62%);
          opacity: 0.72;
          z-index: -1;
        }

        .mp-card-seq-element--fire .mp-card-seq-fly-card::after {
          background: repeating-conic-gradient(from 20deg, rgba(255,126,31,0.7) 0 9deg, transparent 10deg 22deg);
        }

        .mp-card-seq-element--water .mp-card-seq-fly-card::after {
          background: repeating-radial-gradient(circle, rgba(34,211,238,0.48) 0 4px, transparent 5px 13px);
        }

        .mp-card-seq-element--earth .mp-card-seq-fly-card::after {
          background: repeating-linear-gradient(130deg, rgba(161,98,7,0.55) 0 7px, transparent 8px 17px);
        }

        .mp-card-seq-element--wind .mp-card-seq-fly-card::after {
          background: repeating-linear-gradient(105deg, transparent 0 16px, rgba(134,239,172,0.5) 17px 20px);
        }

        .mp-card-seq-element--lightning .mp-card-seq-fly-card::after {
          clip-path: polygon(45% 0, 68% 0, 54% 38%, 78% 38%, 32% 100%, 43% 55%, 23% 55%);
          background: #fde047;
          filter: drop-shadow(0 0 18px #fde047);
        }

        .mp-card-seq-clash {
          position: absolute;
          left: 50%;
          top: 48%;
          width: min(560px, 82vw);
          height: min(330px, 44vh);
          transform: translate(-50%, -50%);
        }

        .mp-card-seq-clash__action,
        .mp-card-seq-clash__reaction {
          position: absolute;
          top: 50%;
          width: min(190px, 28vw);
          aspect-ratio: 0.72;
          clip-path: polygon(10% 0, 100% 0, 90% 100%, 0 100%);
          display: grid;
          place-items: center;
          text-align: center;
          padding: 14px;
          font-size: 13px;
          font-weight: 1000;
          line-height: 1;
          text-transform: uppercase;
          color: white;
        }

        .mp-card-seq-clash__action {
          left: 18%;
          border: 2px solid var(--seq-attack-accent);
          background: color-mix(in srgb, var(--seq-attack-accent) 30%, #140d07);
          animation: mp-card-seq-action-defeated 950ms ease-in both;
        }

        .mp-card-seq-clash__reaction {
          right: 10%;
          border: 2px solid var(--seq-reaction-accent);
          background: color-mix(in srgb, var(--seq-reaction-accent) 34%, #140d07);
          box-shadow: 0 0 64px color-mix(in srgb, var(--seq-reaction-accent) 60%, transparent);
          animation: mp-card-seq-reaction-cover 950ms cubic-bezier(0.16, 1, 0.25, 1) both;
        }

        .mp-card-seq-clash--launch .mp-card-seq-clash__action {
          animation-name: mp-card-seq-action-launched;
        }

        .mp-card-seq-clash--shatter .mp-card-seq-clash__action {
          animation-name: mp-card-seq-action-shatter;
        }

        .mp-card-seq-clash__label {
          position: absolute;
          left: 50%;
          bottom: 0;
          transform: translateX(-50%);
          width: min(520px, 86vw);
          padding: 13px 24px;
          text-align: center;
          clip-path: polygon(6% 0, 100% 0, 94% 100%, 0 100%);
          background: rgba(16,10,6,0.92);
          border: 1px solid var(--seq-reaction-accent);
          color: #e0f2fe;
          font-size: 12px;
          font-weight: 1000;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        @keyframes mp-card-seq-enter {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes mp-card-seq-stripes {
          from { transform: translateX(-16%) skewX(-12deg); }
          to { transform: translateX(0%) skewX(-12deg); }
        }

        @keyframes mp-card-seq-sweep {
          0% { opacity: 0; transform: translateX(-62%) skewX(-14deg); }
          42% { opacity: 0.95; }
          100% { opacity: 0; transform: translateX(62%) skewX(-14deg); }
        }

        @keyframes mp-card-seq-card-in {
          0% { opacity: 0; transform: translate(-50%, -50%) rotate(-22deg) scale(0.35); filter: blur(12px); }
          62% { opacity: 1; transform: translate(-50%, -50%) rotate(-5deg) scale(1.12); filter: blur(0); }
          100% { opacity: 1; transform: translate(-50%, -50%) rotate(-7deg) scale(1); }
        }

        @keyframes mp-card-seq-reaction-in {
          0% { opacity: 0; transform: translate(42%, -50%) rotate(28deg) scale(0.4); filter: blur(10px); }
          68% { opacity: 1; transform: translate(-50%, -50%) rotate(3deg) scale(1.08); filter: blur(0); }
          100% { opacity: 1; transform: translate(-50%, -50%) rotate(7deg) scale(1); }
        }

        @keyframes mp-card-seq-card-park-left {
          to { left: calc(50% - min(260px, 27vw)); top: 43%; transform: translate(-50%, -50%) rotate(-10deg) scale(0.72); opacity: 0.72; }
        }

        @keyframes mp-card-seq-card-park-right {
          to { left: calc(50% + min(260px, 27vw)); top: 43%; transform: translate(-50%, -50%) rotate(10deg) scale(0.72); opacity: 0.72; }
        }

        @keyframes mp-card-seq-rolls-in {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.74); filter: blur(8px); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); filter: blur(0); }
        }

        @keyframes mp-card-seq-roll-scan {
          to { transform: rotate(360deg); }
        }

        @keyframes mp-card-seq-number-pop {
          0% { transform: scale(0.3) rotate(-8deg); opacity: 0; }
          65% { transform: scale(1.18) rotate(2deg); opacity: 1; }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }

        @keyframes mp-card-seq-winner-pulse {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-3px) scale(1.035); }
        }

        @keyframes mp-card-seq-result-in {
          0% { opacity: 0; transform: translate(-50%, -30%) scale(0.88); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }

        @keyframes mp-card-seq-impact {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.2); }
          35% { opacity: 0.82; }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(2.35); }
        }

        @keyframes mp-card-seq-fly {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.55) rotate(-12deg);
            filter: blur(6px);
          }
          18% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.05) rotate(-8deg);
            filter: blur(0);
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% + var(--fly-x)), calc(-50% + var(--fly-y))) scale(0.16) rotate(18deg);
            filter: blur(2px);
          }
        }

        @keyframes mp-card-seq-action-defeated {
          0% { transform: translateY(-50%) rotate(-8deg) scale(1); opacity: 1; }
          100% { transform: translate(-16%, -58%) rotate(-28deg) scale(0.76); opacity: 0.28; filter: blur(2px); }
        }

        @keyframes mp-card-seq-action-launched {
          0% { transform: translateY(-50%) rotate(-8deg) scale(1); opacity: 1; }
          100% { transform: translate(-70%, -120%) rotate(-52deg) scale(0.5); opacity: 0; filter: blur(4px); }
        }

        @keyframes mp-card-seq-action-shatter {
          0% { transform: translateY(-50%) rotate(-8deg) scale(1); opacity: 1; clip-path: polygon(10% 0, 100% 0, 90% 100%, 0 100%); }
          100% { transform: translate(-20%, -52%) rotate(18deg) scale(0.82); opacity: 0.16; clip-path: polygon(8% 0, 48% 12%, 65% 0, 100% 18%, 86% 100%, 52% 84%, 35% 100%, 0 76%); }
        }

        @keyframes mp-card-seq-reaction-cover {
          0% { transform: translate(62%, -50%) rotate(18deg) scale(0.72); opacity: 0; }
          54% { transform: translate(-28%, -50%) rotate(-4deg) scale(1.12); opacity: 1; }
          100% { transform: translate(-38%, -50%) rotate(-8deg) scale(1); opacity: 1; }
        }

        @media (max-width: 760px) {
          .mp-card-seq-card {
            width: min(220px, 56vw);
          }

          .mp-card-seq--rolls .mp-card-seq-card--attack,
          .mp-card-seq--result .mp-card-seq-card--attack,
          .mp-card-seq--resolve .mp-card-seq-card--attack {
            animation: none;
            opacity: 0;
          }

          .mp-card-seq--rolls .mp-card-seq-card--reaction,
          .mp-card-seq--result .mp-card-seq-card--reaction,
          .mp-card-seq--resolve .mp-card-seq-card--reaction {
            animation: none;
            opacity: 0;
          }

          .mp-card-seq-rolls {
            grid-template-columns: 1fr;
            width: min(360px, calc(100vw - 28px));
            gap: 12px;
          }

          .mp-card-seq-roll-panel {
            min-height: 136px;
            padding: 16px 18px;
          }

          .mp-card-seq-die {
            width: 92px;
            height: 92px;
          }
          .mp-card-seq-die__face {
            font-size: 42px;
          }

          .mp-card-seq-result {
            top: 74vh;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .mp-card-seq,
          .mp-card-seq *,
          .mp-card-seq::before,
          .mp-card-seq::after {
            animation-duration: 1ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 1ms !important;
          }
        }
      `}</style>

      <div className="mp-card-seq-stage">
        <BattleCard card={payload.attackCard} owner={payload.attacker.name} role="attack" />

        {showReactionCard && payload.reactionCard && (
          <BattleCard card={payload.reactionCard} owner={payload.target?.name || 'Alvo'} role="reaction" />
        )}

        {showRolls && (
          <div className={`mp-card-seq-rolls ${!hasReaction ? 'mp-card-seq-rolls--solo' : ''}`}>
            <RollPanel
              label={hasReaction ? 'ACAO' : 'ROLL'}
              roll={payload.attackRoll}
              active={hasReaction ? actionWins : info.kind === 'hit' || info.kind === 'crit'}
              tone={hasReaction ? attackAccent : info.accent}
              rolling={phase === 'rolls' && !reduced}
            />
            {hasReaction && payload.reactionRoll && (
              <RollPanel
                label="REACAO"
                roll={payload.reactionRoll}
                active={reactionWins}
                tone={reactionAccent}
                rolling={phase === 'rolls' && !reduced}
              />
            )}
          </div>
        )}

        {showResult && (
          <div className="mp-card-seq-result">
            <span className="mp-card-seq-result__eyebrow">
              {hasReaction ? 'COMPARACAO FINAL' : 'RESULTADO FINAL'}
            </span>
            <strong>{info.title}</strong>
            <span>{info.subtitle}</span>
          </div>
        )}

        {phase === 'resolve' && actionWins && (
          <>
            <div className="mp-card-seq-impact" />
            {(resolvedTargets.length > 0 ? resolvedTargets : [{ x: centerX, y: centerY, name: payload.target?.name || 'Alvo' }]).map((point, index) => (
              <div
                key={`${point.name}-${index}`}
                className="mp-card-seq-fly-card"
                style={{
                  ['--fly-x' as any]: `${point.x - centerX}px`,
                  ['--fly-y' as any]: `${point.y - centerY}px`,
                  ['--fly-delay' as any]: `${index * 70}ms`,
                } as React.CSSProperties}
              >
                {payload.attackCard.name}
              </div>
            ))}
          </>
        )}

        {phase === 'resolve' && reactionWins && payload.reactionCard && (
          <div className={`mp-card-seq-clash mp-card-seq-clash--${variantRef.current.key}`}>
            <div className="mp-card-seq-clash__action">{payload.attackCard.name}</div>
            <div className="mp-card-seq-clash__reaction">{payload.reactionCard.name}</div>
            <div className="mp-card-seq-clash__label">{variantRef.current.label}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CardRevealAnimation;
