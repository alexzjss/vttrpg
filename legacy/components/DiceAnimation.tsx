import React, { useEffect, useMemo, useRef } from 'react';
import type { RollResult } from '../utils/dice';
import {
  AnimFxStyles,
  deriveTier,
  getJuice,
  getPacing,
  prefersReducedMotion,
  RESULT_TONES,
  useAnimSequence,
  useScramble,
} from './combat/animFx';

interface DiceAnimationProps {
  isVisible: boolean;
  result: number;
  finalTotal?: number;
  adjustments?: Array<{ label: string; value: number }>;
  defenderResult?: number;
  defenderRoll?: RollResult;
  defenderBase?: number;
  isSuccess: boolean;
  customLabel?: string;
  notation?: string;
  individualRolls?: number[];
  numSides?: number;
  bonus?: number;
  dramatic?: boolean;
  actorLabel?: string;
  defenderLabel?: string;
  onReveal?: () => void;
  onComplete: () => void;
}

type DicePhase = 'rolls' | 'result';

function rollBreakdown(individualRolls: number[], bonus: number): string {
  const body = individualRolls.join(' + ');
  if (bonus > 0) return `${body} + ${bonus}`;
  if (bonus < 0) return `${body} - ${Math.abs(bonus)}`;
  return body;
}

function signed(value: number): string {
  if (value > 0) return `+${value}`;
  if (value < 0) return `-${Math.abs(value)}`;
  return '0';
}

const DiceLiteDie: React.FC<{ value: number; sides: number; rolling: boolean; reduced: boolean }> = ({ value, sides, rolling, reduced }) => {
  const animatedRoll = rolling && !reduced;
  const shown = useScramble(value, sides, animatedRoll);
  return (
    <div className={`mp-dicelite__die ${animatedRoll ? 'mp-dicelite__die--rolling' : rolling ? 'mp-dicelite__die--waiting' : 'mp-dicelite__die--settled'}`}>
      <span className="mp-dicelite__die-edge" aria-hidden />
      <span className="mp-dicelite__die-face">{rolling ? (reduced ? '?' : shown) : value}</span>
    </div>
  );
};

/** Quando a notação envolve múltiplos dados (ex.: 2d8), cada um rola e assenta em sua própria vez —
 *  em vez de mostrar um único dado já com o total somado. */
const MultiDieRow: React.FC<{ individualRolls: number[]; sides: number; showResult: boolean; perDieMs: number; reduced: boolean; runKey: string }> = ({
  individualRolls, sides, showResult, perDieMs, reduced, runKey,
}) => {
  const [revealedCount, setRevealedCount] = React.useState(reduced ? individualRolls.length : 0);
  React.useEffect(() => {
    if (reduced) { setRevealedCount(individualRolls.length); return; }
    setRevealedCount(0);
    const timers = individualRolls.map((_, i) => setTimeout(() => setRevealedCount(count => Math.max(count, i + 1)), (i + 1) * perDieMs));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey, reduced]);
  return (
    <div className="mp-dicelite__multidie">
      {individualRolls.map((value, i) => (
        <DiceLiteDie key={i} value={value} sides={sides} rolling={!showResult && i >= revealedCount} reduced={reduced} />
      ))}
    </div>
  );
};

const DiceAnimation: React.FC<DiceAnimationProps> = ({
  isVisible,
  result,
  finalTotal,
  adjustments = [],
  defenderResult,
  defenderRoll,
  defenderBase,
  isSuccess,
  customLabel,
  notation = '1d20',
  individualRolls = [result],
  numSides = 20,
  bonus = 0,
  dramatic = false,
  actorLabel,
  defenderLabel,
  onReveal,
  onComplete,
}) => {
  const reduced = prefersReducedMotion();
  const safeResult = Number.isFinite(result) ? result : 0;
  const safeFinalTotal = Number.isFinite(finalTotal) ? finalTotal : safeResult;
  const totalAdjustment = safeFinalTotal - safeResult;
  const shownAdjustments = adjustments.length
    ? adjustments.filter(adj => adj.value !== 0)
    : totalAdjustment !== 0
      ? [{ label: 'Efeitos externos', value: totalAdjustment }]
      : [];
  const hasFinalAdjustment = shownAdjustments.length > 0 && safeFinalTotal !== safeResult;
  const safeSides = Math.max(1, numSides || 20);

  const isCrit = individualRolls.length === 1 && safeSides >= 4 && individualRolls[0] >= safeSides;
  const isFumble = individualRolls.length === 1 && safeSides >= 4 && individualRolls[0] === 1;
  const hasDefender = defenderResult !== undefined;
  const hasReaction = hasDefender && !!defenderRoll;

  const tier = deriveTier({ dramatic, hasReaction: hasDefender, isCrit, isFumble });
  const pacing = getPacing(tier, reduced);

  const kind = isCrit ? 'crit' : isFumble ? 'fumble' : isSuccess ? 'hit' : 'miss';
  const juice = getJuice(kind, reduced);
  const toneKey = isCrit ? 'crit' : isFumble ? 'fumble' : isSuccess ? 'hit' : 'miss';
  const tone = RESULT_TONES[toneKey];

  const label = customLabel || (isCrit ? 'CRITICO' : isFumble ? 'FALHA' : isSuccess ? 'SUCESSO' : 'FALHOU');

  const isMultiDie = !hasDefender && individualRolls.length > 1;
  const perDieMs = reduced ? 60 : 340;
  const rollsShown = isMultiDie ? Math.max(pacing.rollsShown, individualRolls.length * perDieMs + 150) : pacing.rollsShown;

  const steps = useMemo(() => ([
    { phase: 'rolls' as DicePhase, delay: 0 },
    { phase: 'result' as DicePhase, delay: rollsShown },
  ]), [rollsShown]);

  const { phase, skip } = useAnimSequence<DicePhase>({
    steps,
    tailMs: pacing.resultShown,
    runKey: isVisible ? `${safeResult}|${defenderResult ?? ''}|${notation}` : null,
    onComplete,
    active: isVisible,
  });

  const showResult = phase === 'result';
  const flash = showResult && juice.flash;
  const revealedRef = useRef(false);
  useEffect(() => {
    if (!isVisible || !showResult || revealedRef.current) return;
    revealedRef.current = true;
    onReveal?.();
  }, [isVisible, showResult, onReveal]);

  if (!isVisible) return null;

  return (
    <div
      className={`mp-dicelite ${showResult ? 'mp-dicelite--revealed' : 'mp-dicelite--mystery'} ${showResult && juice.shakePx > 0 ? 'mp-fx-shake' : ''}`}
      style={{
        ['--fx-shake' as any]: `${juice.shakePx}px`,
        ['--dl-tone' as any]: tone,
      } as React.CSSProperties}
      onClick={skip}
    >
      <AnimFxStyles />
      {flash && <div className="mp-fx-flash" style={{ ['--fx-flash-color' as any]: tone } as React.CSSProperties} />}
      <style>{`
        .mp-dicelite {
          position: fixed;
          inset: 0;
          z-index: 99990;
          display: grid;
          place-items: center;
          gap: 18px;
          cursor: pointer;
          color: #fff7d6;
          font-family: "Inter", "Rajdhani", system-ui, sans-serif;
          background:
            radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--dl-tone) 24%, transparent), transparent 36%),
            radial-gradient(ellipse 60% 50% at 50% 10%, rgba(249,115,22,0.14), transparent 60%),
            linear-gradient(110deg, rgba(20,13,7,0.5), rgba(12,8,4,0.66));
          animation: mp-dicelite-in 160ms ease-out both;
          contain: layout paint style;
        }
        @keyframes mp-dicelite-in { from { opacity: 0; } to { opacity: 1; } }

        .mp-dicelite--mystery {
          background:
            radial-gradient(circle at 30% 36%, rgba(34,211,238,.22), transparent 31%),
            radial-gradient(circle at 68% 38%, rgba(244,63,94,.2), transparent 30%),
            radial-gradient(circle at 52% 68%, rgba(168,85,247,.24), transparent 34%),
            radial-gradient(circle at 48% 22%, rgba(250,204,21,.12), transparent 26%),
            linear-gradient(110deg, rgba(8,12,20,.72), rgba(15,8,22,.78));
          background-size: 125% 125%, 135% 135%, 130% 130%, 120% 120%, auto;
          animation: mp-dicelite-in 160ms ease-out both, mp-mystery-aura 3.6s ease-in-out infinite alternate;
        }
        @keyframes mp-mystery-aura {
          0% { background-position: 0% 0%, 100% 0%, 50% 100%, 20% 20%, 0 0; }
          100% { background-position: 14% 9%, 86% 12%, 44% 82%, 70% 28%, 0 0; }
        }

        .mp-dicelite__panel {
          position: relative;
          min-width: min(405px, 90vw);
          padding: 34px 46px 30px;
          display: grid;
          justify-items: center;
          gap: 8px;
          clip-path: polygon(8% 0, 100% 0, 92% 100%, 0 100%);
          border: 2px solid color-mix(in srgb, var(--dl-tone) 72%, rgba(255,255,255,0.12));
          background:
            linear-gradient(160deg, color-mix(in srgb, var(--dl-tone) 28%, transparent), transparent 42%),
            linear-gradient(180deg, rgba(24,15,8,0.94), rgba(15,10,6,0.95));
          box-shadow: 0 18px 54px rgba(0,0,0,0.6), inset 0 0 26px rgba(124,45,18,0.08);
          animation: mp-dicelite-pop 280ms cubic-bezier(0.2, 1, 0.24, 1) both;
          will-change: transform, opacity;
        }
        .mp-dicelite__panel--comparison { width: min(720px, 92vw); }
        .mp-dicelite--mystery .mp-dicelite__panel {
          border-color: rgba(255,255,255,.28);
          background:
            linear-gradient(160deg, rgba(34,211,238,.14), transparent 38%),
            linear-gradient(215deg, rgba(244,63,94,.12), transparent 42%),
            linear-gradient(20deg, rgba(168,85,247,.18), transparent 45%),
            linear-gradient(180deg, rgba(13,17,25,.95), rgba(12,8,19,.96));
          box-shadow:
            -12px 0 34px rgba(34,211,238,.12),
            12px 0 34px rgba(244,63,94,.11),
            0 18px 54px rgba(0,0,0,.62),
            0 0 26px rgba(168,85,247,.14);
        }
        @keyframes mp-dicelite-pop {
          0% { opacity: 0; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }

        .mp-dicelite__label {
          font-size: 14px; font-weight: 1000; letter-spacing: 0.22em;
          text-transform: uppercase; color: color-mix(in srgb, var(--dl-tone) 80%, #fff);
        }
        .mp-dicelite--mystery .mp-dicelite__label {
          color: transparent;
          background: linear-gradient(90deg, #22d3ee, #a855f7, #f43f5e, #facc15, #22d3ee);
          background-size: 240% 100%;
          background-clip: text;
          -webkit-background-clip: text;
          animation: mp-mystery-rainbow 2.4s linear infinite;
        }
        @keyframes mp-mystery-rainbow { to { background-position: 240% 0; } }
        .mp-dicelite__notation {
          font-size: 15px; font-weight: 900; letter-spacing: 0.12em;
          text-transform: uppercase; color: rgba(255,255,255,0.6);
        }
        .mp-dicelite__die {
          position: relative; width: clamp(148px, 21vw, 220px); height: clamp(148px, 21vw, 220px);
          display: grid; place-items: center; margin: 4px 0;
          contain: layout paint;
        }
        .mp-dicelite__multidie {
          display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px;
        }
        .mp-dicelite__multidie .mp-dicelite__die {
          width: clamp(96px, 14vw, 140px); height: clamp(96px, 14vw, 140px);
        }
        .mp-dicelite__multidie .mp-dicelite__die-face { font-size: clamp(42px, 6.5vw, 68px); }
        .mp-dicelite__die-edge {
          position: absolute; inset: 0;
          clip-path: polygon(50% 0, 100% 27%, 100% 73%, 50% 100%, 0 73%, 0 27%);
          background: linear-gradient(150deg, color-mix(in srgb, var(--dl-tone) 60%, #ffe7aa 20%), color-mix(in srgb, var(--dl-tone) 70%, #000 30%));
          border: 2.5px solid color-mix(in srgb, var(--dl-tone) 82%, #fff 14%);
          box-shadow: 0 0 24px color-mix(in srgb, var(--dl-tone) 45%, transparent), inset 0 0 22px rgba(0,0,0,0.45), inset 0 2px 8px rgba(255,255,255,0.28);
          z-index: 0;
          will-change: transform;
          backface-visibility: hidden;
        }
        .mp-dicelite__die-face {
          position: relative; z-index: 1;
          font-size: clamp(64px, 10vw, 108px); line-height: 1; font-weight: 1000;
          color: #fff7e2; text-shadow: 0 2px 5px rgba(0,0,0,0.72), 0 0 14px color-mix(in srgb, var(--dl-tone) 68%, transparent);
          will-change: transform, opacity;
        }
        .mp-dicelite__die--rolling .mp-dicelite__die-edge { animation: mp-dicelite-tumble 0.72s linear infinite; }
        .mp-dicelite__die--rolling .mp-dicelite__die-face { animation: mp-dicelite-flick 0.72s linear infinite; opacity: 0.92; }
        .mp-dicelite--mystery .mp-dicelite__die-edge {
          background: conic-gradient(from 20deg, #22d3ee, #3b82f6, #a855f7, #f43f5e, #facc15, #22d3ee);
          border-color: rgba(255,255,255,.58);
          box-shadow:
            0 0 22px rgba(34,211,238,.22),
            8px 4px 22px rgba(244,63,94,.16),
            -8px -3px 22px rgba(168,85,247,.18),
            inset 0 0 24px rgba(0,0,0,.4), inset 0 2px 8px rgba(255,255,255,.34);
        }
        .mp-dicelite--mystery .mp-dicelite__die-face {
          color: #fff;
          text-shadow: 0 2px 5px rgba(0,0,0,.82), -4px 0 14px rgba(34,211,238,.62), 4px 0 14px rgba(244,63,94,.54), 0 4px 14px rgba(168,85,247,.58);
        }
        .mp-dicelite__die--settled .mp-dicelite__die-edge { animation: mp-dicelite-land 360ms cubic-bezier(0.2, 1.45, 0.3, 1) both; }
        .mp-dicelite__die--settled .mp-dicelite__die-face { animation: mp-dicelite-num 380ms cubic-bezier(0.2, 1.45, 0.25, 1) both; }
        @keyframes mp-dicelite-tumble {
          0% { transform: rotate(0deg) scale(1); } 25% { transform: rotate(90deg) scale(0.9); }
          50% { transform: rotate(180deg) scale(1.05); } 75% { transform: rotate(270deg) scale(0.92); }
          100% { transform: rotate(360deg) scale(1); }
        }
        @keyframes mp-dicelite-flick { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-2px) rotate(-3deg); } }
        @keyframes mp-dicelite-land {
          0% { transform: scale(1.14) rotate(-7deg); }
          60% { transform: scale(0.97) rotate(2deg); } 100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes mp-dicelite-num {
          0% { transform: scale(0.4) rotate(-8deg); opacity: 0; }
          65% { transform: scale(1.16) rotate(2deg); opacity: 1; }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }
        .mp-dicelite__breakdown {
          font-size: 14px; font-weight: 800; letter-spacing: 0.1em;
          color: rgba(255,255,255,0.6); text-transform: uppercase;
          display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;
        }
        .mp-dicelite__formula {
          width: min(420px, 86vw);
          display: grid;
          gap: 6px;
          margin-top: 4px;
        }
        .mp-dicelite__formula-row {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 14px;
          padding: 7px 10px;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.045);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .mp-dicelite__formula-row b { color: rgba(255,255,255,.62); }
        .mp-dicelite__formula-row strong {
          color: #fff8df;
          font-size: 16px;
          text-shadow: 0 0 14px color-mix(in srgb, var(--dl-tone) 62%, transparent);
        }
        .mp-dicelite__formula-row--effect strong { color: color-mix(in srgb, var(--dl-tone) 86%, #fff); }
        .mp-dicelite__formula-row--final {
          border-color: color-mix(in srgb, var(--dl-tone) 56%, rgba(255,255,255,.18));
          background: linear-gradient(90deg, color-mix(in srgb, var(--dl-tone) 18%, transparent), rgba(255,255,255,.055));
        }
        .mp-dicelite__vs {
          margin-top: 9px; font-size: 16px; font-weight: 1000;
          letter-spacing: 0.12em; text-transform: uppercase;
        }
        .mp-dicelite__comparison {
          display: grid; grid-template-columns: minmax(172px,1fr) 60px minmax(172px,1fr);
          align-items: center; gap: 14px; margin: 12px 0 4px;
        }
        .mp-dicelite__side { display: grid; justify-items: center; gap: 7px; }
        .mp-dicelite__side-label {
          max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          font-size: 10px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase;
          color: rgba(255,255,255,.56);
        }
        .mp-dicelite__target {
          width: clamp(128px, 17vw, 178px); height: clamp(128px, 17vw, 178px);
          display: grid; place-items: center; position: relative;
          font-size: clamp(54px, 8vw, 84px); font-weight: 1000; color: #e7e7eb;
          background: radial-gradient(circle, rgba(255,255,255,.09), rgba(255,255,255,.02) 62%, transparent 64%);
          border: 2px solid rgba(255,255,255,.2); border-radius: 50%;
          box-shadow: inset 0 0 30px rgba(0,0,0,.5), 0 0 24px rgba(255,255,255,.05);
        }
        .mp-dicelite__defense-sum {
          min-height: 18px; font-size: 12px; font-weight: 900; letter-spacing: .08em;
          color: rgba(255,255,255,.7); text-transform: uppercase;
        }
        .mp-dicelite__versus { font-size: 22px; font-weight: 1000; color: rgba(255,255,255,.38); font-style: italic; }
        .mp-dicelite__comparison .mp-dicelite__die { width: clamp(128px, 17vw, 178px); height: clamp(128px, 17vw, 178px); }
        .mp-dicelite__comparison .mp-dicelite__die-face { font-size: clamp(54px, 8vw, 84px); }
        .mp-dicelite__mystery-copy {
          color: transparent;
          background: linear-gradient(90deg,#22d3ee,#a855f7,#f43f5e,#facc15,#22d3ee);
          background-size: 240% 100%; background-clip: text; -webkit-background-clip: text;
          animation: mp-mystery-rainbow 1.4s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .mp-dicelite, .mp-dicelite *, .mp-dicelite__panel, .mp-dicelite__number {
            animation-duration: 1ms !important;
          }
          .mp-dicelite--mystery, .mp-dicelite--mystery .mp-dicelite__label { animation: none !important; }
          .mp-dicelite--mystery .mp-dicelite__label { background-position: 50% 0; }
        }
      `}</style>

      <div className={`mp-dicelite__panel ${hasDefender ? 'mp-dicelite__panel--comparison' : ''}`}>
        <span className="mp-dicelite__label">{showResult ? label : 'Rolando'}</span>
        <span className="mp-dicelite__notation">{notation}</span>
        {hasDefender ? (
          <div className="mp-dicelite__comparison">
            <div className="mp-dicelite__side">
              <span className="mp-dicelite__side-label">{actorLabel || 'Rolagem'}</span>
              <DiceLiteDie value={safeResult} sides={safeSides} rolling={!showResult} reduced={reduced} />
            </div>
            <span className="mp-dicelite__versus">VS</span>
            <div className="mp-dicelite__side">
              <span className="mp-dicelite__side-label">{defenderLabel || 'Defesa'}</span>
              {hasReaction && defenderRoll ? (
                <>
                  <DiceLiteDie value={defenderRoll.total} sides={defenderRoll.numSides} rolling={!showResult} reduced={reduced} />
                  <span className="mp-dicelite__defense-sum">
                    {showResult ? `Reação ${defenderRoll.total} + defesa ${defenderBase ?? 0} = ${defenderResult}` : 'Reação + defesa'}
                  </span>
                </>
              ) : <div className="mp-dicelite__target">{defenderResult}</div>}
            </div>
          </div>
        ) : isMultiDie ? (
          <MultiDieRow individualRolls={individualRolls} sides={safeSides} showResult={showResult} perDieMs={perDieMs} reduced={reduced} runKey={`${notation}|${individualRolls.join(',')}`} />
        ) : <DiceLiteDie value={safeResult} sides={safeSides} rolling={!showResult} reduced={reduced} />}
        <div className="mp-dicelite__breakdown">
          <span>{showResult ? (isMultiDie ? `${rollBreakdown(individualRolls, bonus)} = ${safeResult}` : rollBreakdown(individualRolls, bonus)) : '· rolando ·'}</span>
          {hasDefender && showResult && <span>{hasReaction ? `DEFESA TOTAL ${defenderResult}` : `ALVO ${defenderResult}`}</span>}
        </div>
        {showResult && hasFinalAdjustment && (
          <div className="mp-dicelite__formula" aria-label="Modificadores da rolagem">
            <div className="mp-dicelite__formula-row">
              <b>Rolagem</b>
              <strong>{safeResult}</strong>
            </div>
            {shownAdjustments.map((adjustment, index) => (
              <div className="mp-dicelite__formula-row mp-dicelite__formula-row--effect" key={`${adjustment.label}-${index}`}>
                <b>{adjustment.label}</b>
                <strong>{signed(adjustment.value)}</strong>
              </div>
            ))}
            <div className="mp-dicelite__formula-row mp-dicelite__formula-row--final">
              <b>Final</b>
              <strong>{safeFinalTotal}</strong>
            </div>
          </div>
        )}
        {hasDefender && (
          <div className={`mp-dicelite__vs ${showResult ? '' : 'mp-dicelite__mystery-copy'}`} style={showResult ? { color: tone } : undefined}>
            {showResult ? (isSuccess ? 'ATAQUE VENCE' : hasReaction ? 'REAÇÃO VENCE' : 'DEFESA SEGURA') : 'O DESTINO AINDA ESTÁ EM MOVIMENTO'}
          </div>
        )}
      </div>
    </div>
  );
};

export default DiceAnimation;
