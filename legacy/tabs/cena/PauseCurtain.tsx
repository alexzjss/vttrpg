import React from 'react';
import type { Character } from '../../types';
import type { PausedDisplayItemState, PausedDisplayState } from '../../utils/cena';

export interface PauseCurtainProps {
  isPaused: boolean;
  image?: string;
  imagePosition?: string;
  participants?: Character[];
  display?: PausedDisplayState | null;
  onChangeDisplay?: (display: PausedDisplayState | null) => void;
}

const CURTAIN_MS = 550;

const pct = (current: number | undefined, max: number | undefined) => {
  if (!max || max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((current ?? 0) / max) * 100)));
};

const initialOf = (name: string) => (name.trim()[0] || '?').toUpperCase();

/**
 * Cortina dramatica de tela cheia: fecha, troca o conteudo e reabre.
 * Quando pausada, vira um palco com o fundo da pausa, cartas do elenco em cena
 * e um destaque opcional disparado pelo Dashboard do Mestre.
 */
const normalizeDisplayItems = (display?: PausedDisplayState | null): PausedDisplayItemState[] => {
  if (!display) return [];
  return display.items?.length ? display.items : [display];
};

const toDisplayState = (current: PausedDisplayState | null | undefined, items: PausedDisplayItemState[]): PausedDisplayState | null => {
  if (!items.length) return null;
  return { ...(current ?? items[0]), ...items[0], items };
};

const PauseCurtain: React.FC<PauseCurtainProps> = ({ isPaused, image, imagePosition, participants = [], display, onChangeDisplay }) => {
  const [phase, setPhase] = React.useState<'hidden' | 'closing' | 'opening' | 'settled'>('hidden');
  const [showingImage, setShowingImage] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>();
  const dragRef = React.useRef<{ id: string; startX: number; startY: number; x: number; y: number } | null>(null);

  React.useEffect(() => {
    if (!image) { setPhase('hidden'); setShowingImage(false); return; }
    clearTimeout(timerRef.current);
    setPhase('closing');
    timerRef.current = setTimeout(() => {
      setShowingImage(isPaused);
      setPhase('opening');
      timerRef.current = setTimeout(() => setPhase(isPaused ? 'settled' : 'hidden'), CURTAIN_MS);
    }, CURTAIN_MS);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaused, image]);

  if (phase === 'hidden' && !showingImage) return null;
  const closed = phase === 'closing';
  const shownParticipants = participants.slice(0, 12);
  const displayItems = normalizeDisplayItems(display);
  const updateDisplayItem = (id: string, patch: Partial<PausedDisplayItemState>) => {
    if (!display || !onChangeDisplay) return;
    const nextItems = normalizeDisplayItems(display).map(item => item.id === id ? { ...item, ...patch } : item);
    onChangeDisplay(toDisplayState(display, nextItems));
  };
  const startDrag = (event: React.PointerEvent, item: PausedDisplayItemState) => {
    if (!onChangeDisplay) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id: item.id, startX: event.clientX, startY: event.clientY, x: item.x ?? 50, y: item.y ?? 46 };
  };
  const moveDrag = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const width = window.innerWidth || 1;
    const height = window.innerHeight || 1;
    updateDisplayItem(drag.id, {
      x: Math.max(3, Math.min(97, drag.x + ((event.clientX - drag.startX) / width) * 100)),
      y: Math.max(3, Math.min(97, drag.y + ((event.clientY - drag.startY) / height) * 100)),
    });
  };

  return (
    <div className="pause-curtain" aria-hidden={phase !== 'settled'} role={phase === 'settled' ? 'status' : undefined} aria-label={phase === 'settled' ? 'Combate pausado' : undefined}>
      <style>{`
        .pause-curtain{position:fixed;inset:0;z-index:400;pointer-events:${phase === 'settled' ? 'auto' : 'none'};overflow:hidden}
        .pause-curtain__scrim{position:absolute;inset:0;background:${showingImage ? `#0c0a10 url(${image}) ${imagePosition || '50% 50%'}/cover no-repeat` : 'transparent'};opacity:${showingImage ? 1 : 0};transition:opacity ${CURTAIN_MS}ms ease}
        .pause-curtain__scrim:after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 42%,rgba(4,3,6,.72) 100%),linear-gradient(180deg,rgba(4,3,6,.14),rgba(4,3,6,.46) 70%,rgba(4,3,6,.78))}
        .pause-curtain__panel{position:absolute;top:0;bottom:0;width:52%;background:linear-gradient(180deg,#2a2130,#150f1c 55%,#1e1424);box-shadow:0 0 60px rgba(0,0,0,.6) inset;transition:transform ${CURTAIN_MS}ms cubic-bezier(.65,0,.35,1);border-top:2px solid rgba(217,183,110,.3);border-bottom:2px solid rgba(217,183,110,.3)}
        .pause-curtain__panel--left{left:0;clip-path:polygon(0 0,100% 0,92% 100%,0 100%);transform:translateX(${closed ? '0%' : '-100%'})}
        .pause-curtain__panel--right{right:0;clip-path:polygon(8% 0,100% 0,100% 100%,0 100%);transform:translateX(${closed ? '0%' : '100%'})}
        .pause-curtain__cast{position:absolute;left:50%;bottom:clamp(14px,2.8vh,30px);z-index:3;width:min(94vw,1120px);height:clamp(132px,23vh,230px);transform:translateX(-50%);display:flex;align-items:flex-end;justify-content:center;gap:clamp(4px,.85vw,14px);pointer-events:auto;opacity:${phase === 'settled' && showingImage ? 1 : 0};transition:opacity 360ms ease 160ms}
        .pause-card{--tilt:0deg;--lift:0px;--float-delay:0ms;position:relative;width:clamp(76px,8.2vw,132px);aspect-ratio:3/4;flex:none;transform:translateY(var(--lift)) rotate(var(--tilt));border:1px solid rgba(241,199,125,.58);background:linear-gradient(160deg,#2f2634,#090b10 72%);box-shadow:0 16px 34px rgba(0,0,0,.65),inset 0 0 0 1px rgba(255,255,255,.08);overflow:hidden;clip-path:polygon(7px 0,100% 0,100% calc(100% - 10px),calc(100% - 7px) 100%,0 100%,0 7px);animation:pause-card-float 4.8s ease-in-out infinite;animation-delay:var(--float-delay);transition:filter .2s ease,box-shadow .2s ease}
        .pause-card:hover{filter:brightness(1.12) saturate(1.08);box-shadow:0 22px 40px rgba(0,0,0,.72),0 0 22px rgba(241,199,125,.36),inset 0 0 0 1px rgba(255,255,255,.16);animation-play-state:paused;transform:translateY(calc(var(--lift) - 12px)) rotate(calc(var(--tilt) * .55)) scale(1.045)}
        .pause-card__portrait{position:absolute;inset:7px 7px 33px;background:linear-gradient(#21182088,#07080bcc),var(--portrait) var(--portrait-pos,50% 50%)/cover no-repeat,#161820;display:grid;place-items:center;color:#eadfc8;font:700 28px Georgia,serif;text-shadow:0 2px 10px #000;border:1px solid rgba(255,255,255,.12)}
        .pause-card__bars{position:absolute;left:8px;right:8px;bottom:8px;display:grid;gap:4px}.pause-card__bar{height:8px;border:1px solid rgba(255,255,255,.14);background:#090a0f;overflow:hidden}.pause-card__bar i{display:block;height:100%;width:var(--value);transition:width .25s}.pause-card__bar--hp i{background:linear-gradient(90deg,#7f1022,#dc2626 70%,#fb7185);box-shadow:0 0 8px #ef444488}.pause-card__bar--aura i{background:linear-gradient(90deg,#075985,#06b6d4 60%,#67e8f9);box-shadow:0 0 8px #22d3ee88}
        .pause-display{position:absolute;z-index:4;left:var(--display-x,50%);top:var(--display-y,46%);width:var(--display-w);height:var(--display-h);max-width:92vw;max-height:88vh;transform:translate(-50%,-50%);pointer-events:auto;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;filter:drop-shadow(0 28px 42px rgba(0,0,0,.72));animation:pause-card-throw .82s cubic-bezier(.15,.85,.2,1.04) both,pause-display-float 5.4s ease-in-out .9s infinite;transition:filter .2s ease}
        .pause-display:active{cursor:grabbing}
        .pause-display:hover{filter:drop-shadow(0 34px 48px rgba(0,0,0,.78)) drop-shadow(0 0 18px rgba(241,199,125,.38));animation-play-state:paused;transform:translate(-50%,-52%) scale(1.025)}
        .pause-display.is-left{--display-x:25%;--display-y:45%}.pause-display.is-right{--display-x:75%;--display-y:45%}.pause-display.is-full{--display-x:50%;--display-y:48%}.pause-display.is-corner{--display-x:84%;--display-y:22%}
        .pause-display__frame{position:relative;width:100%;height:100%;border:1px solid rgba(244,216,151,.8);background:linear-gradient(160deg,#2b2030,#0b0d12 72%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.12),0 0 34px rgba(217,183,110,.22);overflow:hidden;clip-path:polygon(12px 0,100% 0,100% calc(100% - 14px),calc(100% - 12px) 100%,0 100%,0 12px)}
        .pause-display__image{position:absolute;inset:10px 10px 62px;background:linear-gradient(#17101955,#03040755),var(--display-image) var(--display-pos,50% 50%)/cover no-repeat,#101218;display:grid;place-items:center;color:#f4ead8;font:700 clamp(34px,10vmin,82px) Georgia,serif;text-shadow:0 2px 18px #000}
        .pause-display__meta{position:absolute;left:12px;right:12px;bottom:12px;min-height:42px;display:flex;flex-direction:column;justify-content:center;color:#f7ead0}.pause-display__meta small{color:#caa96a;font:900 clamp(7px,1.2vmin,10px) 'Barlow Semi Condensed',sans-serif;letter-spacing:.18em;text-transform:uppercase}.pause-display__meta strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:800 clamp(13px,2.2vmin,22px) 'Barlow Semi Condensed',sans-serif;letter-spacing:.04em}
        @keyframes pause-card-throw{0%{opacity:0;transform:translate(-118%,-18%) rotate(-18deg) scale(.58);filter:blur(5px)}58%{opacity:1;transform:translate(-48%,-52%) rotate(4deg) scale(1.06);filter:blur(0)}100%{opacity:1;transform:translate(-50%,-50%) rotate(0) scale(1)}}
        @keyframes pause-card-float{0%,100%{transform:translateY(var(--lift)) rotate(var(--tilt))}50%{transform:translateY(calc(var(--lift) - 7px)) rotate(calc(var(--tilt) + .8deg))}}
        @keyframes pause-display-float{0%,100%{margin-top:0}50%{margin-top:-8px}}
        @media(max-width:720px){.pause-curtain__cast{width:100vw;overflow:hidden;justify-content:flex-start;padding-left:10px}.pause-card{width:72px}.pause-display{width:min(var(--display-w),86vw);height:min(var(--display-h),74vh)}.pause-display.is-left,.pause-display.is-right{left:50%;top:43%}.pause-display.is-corner{right:5vw;top:8vh}}
        @media(prefers-reduced-motion:reduce){.pause-display,.pause-card{animation:none!important}.pause-card,.pause-card:hover,.pause-display,.pause-display:hover{transition:none}}
      `}</style>
      <div className="pause-curtain__scrim" />
      {phase === 'settled' && showingImage && displayItems.map(item => {
        const itemSize = Math.max(22, Math.min(90, item.size ?? 42));
        const itemWidth = Math.max(8, Math.min(120, item.width ?? itemSize));
        const itemHeight = Math.max(8, Math.min(120, item.height ?? Math.round(itemSize * 4 / 3)));
        return (
          <div
            key={item.id}
            className={`pause-display is-${item.preset ?? 'center'}`}
            onPointerDown={event => startDrag(event, item)}
            onPointerMove={moveDrag}
            onPointerUp={() => { dragRef.current = null; }}
            onPointerCancel={() => { dragRef.current = null; }}
            style={{
              ['--display-image' as string]: item.image ? `url(${item.image})` : 'none',
              ['--display-pos' as string]: item.imagePosition || '50% 50%',
              ['--display-w' as string]: `${itemWidth}vmin`,
              ['--display-h' as string]: `${itemHeight}vmin`,
              ['--display-x' as string]: `${item.x ?? 50}%`,
              ['--display-y' as string]: `${item.y ?? 46}%`,
            }}
          >
            <div className="pause-display__frame">
              <div className="pause-display__image">{!item.image && initialOf(item.title)}</div>
              <div className="pause-display__meta"><small>{item.subtitle || item.kind}</small><strong>{item.title}</strong></div>
            </div>
          </div>
        );
      })}
      {phase === 'settled' && showingImage && shownParticipants.length > 0 && (
        <div className="pause-curtain__cast" aria-hidden="true">
          {shownParticipants.map((participant, index) => {
            const middle = (shownParticipants.length - 1) / 2;
            const offset = index - middle;
            return (
              <div
                key={participant.id}
                className="pause-card"
                style={{
                  ['--tilt' as string]: `${Math.max(-14, Math.min(14, offset * 4.2))}deg`,
                  ['--lift' as string]: `${Math.abs(offset) % 2 ? -10 : 0}px`,
                  ['--float-delay' as string]: `${index * 130}ms`,
                }}
              >
                <div className="pause-card__portrait" style={{ ['--portrait' as string]: participant.icon ? `url(${participant.icon})` : 'none', ['--portrait-pos' as string]: participant.iconPosition || '50% 50%' }}>{!participant.icon && initialOf(participant.name)}</div>
                <div className="pause-card__bars">
                  <span className="pause-card__bar pause-card__bar--hp" style={{ ['--value' as string]: `${pct(participant.currentHp, participant.maxHp)}%` }}><i /></span>
                  <span className="pause-card__bar pause-card__bar--aura" style={{ ['--value' as string]: `${pct(participant.currentAura, participant.maxAura)}%` }}><i /></span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="pause-curtain__panel pause-curtain__panel--left" />
      <div className="pause-curtain__panel pause-curtain__panel--right" />
    </div>
  );
};

export default PauseCurtain;
