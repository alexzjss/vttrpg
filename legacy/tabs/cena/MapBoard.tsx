import React from 'react';
import { Skull } from 'lucide-react';
import type { Character, DamageType } from '../../types';
import { damageColorOf } from '../../utils/damageVisuals';
import { useGhostPct, useTransientOnChange } from '../../utils/animHooks';
import { fallbackTokenPosition } from '../../utils/mapPositions';

export type TargetEffectKind = 'heal' | 'damage' | 'condition' | 'evade';

export interface TargetEffect {
  id: string;
  targetId: string;
  kinds: TargetEffectKind[];
  hpDelta?: number;
  result?: 'success' | 'failure';
  conditionName?: string;
  conditionColor?: string;
  damageType?: DamageType;
}

export interface MapTargetImpact {
  hpDelta?: number;
  defenseDelta?: number;
  staggerDelta?: number;
  note?: string;
  accuracyLabel?: string;
  comparison?: string;
  intent?: 'attack' | 'heal' | 'buff' | 'debuff';
}

export interface MapBoardProps {
  image: string;
  imagePosition?: string;
  participants: Character[];
  tokens: Record<string, { x: number; y: number }>;
  activeId: string | null;
  onMoveToken: (id: string, pos: { x: number; y: number }) => void;
  onSelect: (id: string) => void;
  combat?: boolean;
  enemyIds?: string[];
  targetEffect?: TargetEffect | null;
  targetableIds?: string[];
  targetImpacts?: Record<string, MapTargetImpact>;
  selectedTargetId?: string | null;
  /** Ids destacados como "dentro da área" da habilidade armada (linha/raio/cone/quadrado) — separado de
   *  `targetableIds` (quem pode ser clicado pra mirar) e `selectedTargetId` (quem já foi clicado). */
  areaPreviewIds?: string[];
  iconOverrides?: Record<string, string | undefined>;
  auraColors?: Record<string, string | undefined>;
  formaAvailableColors?: Record<string, string | undefined>;
  /** Quando informado, somente estes tokens podem ser arrastados. */
  movableIds?: string[];
  /** Oculta a barra de vida dos inimigos sem precisar enviar seus recursos reais. */
  maskEnemyResources?: boolean;
}

interface TokenProps {
  participant: Character;
  position: { x: number; y: number };
  active: boolean;
  enemy: boolean;
  dragging: boolean;
  tokenIcon?: string;
  auraColor?: string;
  formaAvailColor?: string;
  effect?: TargetEffect | null;
  targetable?: boolean;
  impact?: MapTargetImpact;
  selectedTarget?: boolean;
  inArea?: boolean;
  movable?: boolean;
  maskResources?: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>, id: string) => void;
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
}

const Token: React.FC<TokenProps> = ({ participant, position, active, enemy, dragging, tokenIcon, auraColor, formaAvailColor, effect, targetable, impact, selectedTarget, inArea, movable = true, maskResources, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }) => {
  const hp = participant.maxHp > 0 ? Math.max(0, Math.min(100, participant.currentHp / participant.maxHp * 100)) : 0;
  const ghostHp = useGhostPct(hp);
  const isDefeated = participant.currentHp <= 0;
  const justDowned = useTransientOnChange(isDefeated, 650);
  const dmgColor = effect?.damageType ? damageColorOf(effect.damageType) : undefined;
  const elementClass = effect?.damageType ? `is-element-${String(effect.damageType).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : '';
  return <div data-token-id={participant.id} title={participant.name}
    onPointerDown={event => onPointerDown(event, participant.id)} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}
    className={`cena-token ${enemy ? 'is-enemy' : 'is-ally'} ${active ? 'is-active' : ''} ${movable ? 'is-movable' : 'is-locked'} ${auraColor ? 'has-forma' : ''} ${formaAvailColor ? 'is-forma-available' : ''} ${targetable ? 'is-targetable' : ''} ${selectedTarget ? 'is-target-selected' : ''} ${inArea ? 'is-in-area' : ''} ${impact ? 'has-impact-preview' : ''} ${impact?.intent ? `intent-${impact.intent}` : ''} ${!maskResources && hp <= 25 && !isDefeated ? 'is-low' : ''} ${!maskResources && isDefeated ? 'is-defeated' : ''} ${justDowned ? 'is-downing' : ''} ${dragging ? 'is-dragging' : ''}`}
    style={{ left: `${position.x}%`, top: `${position.y}%`, '--token-hp': `${hp * 3.6}deg`, '--token-image': tokenIcon ? `url(${tokenIcon})` : 'none', '--token-image-position': participant.iconPosition || '50% 50%', '--ring': auraColor || undefined, '--forma-avail-color': formaAvailColor || undefined } as React.CSSProperties}>
    <div className="cena-token__runes">âœ¦</div>
    {formaAvailColor && <span className="cena-token__forma-glow" aria-hidden />}
    <div className="cena-token__portrait">
      {!tokenIcon && <span>{participant.name.charAt(0).toUpperCase()}</span>}
      {isDefeated && <span className="cena-token__downed" aria-label={`${participant.name} derrotado`}><Skull size={14} /></span>}
    </div>
    <div className="cena-token__label"><strong>{participant.name}</strong>{!maskResources && <i><i className="cena-token__label-ghost" style={{ width: `${ghostHp}%` }} /><b style={{ width: `${hp}%` }} /></i>}</div>
    {impact && <div className={`cena-token__impact ${impact.intent ? `intent-${impact.intent}` : ''} ${impact.hpDelta && impact.hpDelta > 0 ? 'is-heal' : 'is-damage'}`}>
      <strong>{impact.accuracyLabel ?? (impact.hpDelta ? `${impact.hpDelta > 0 ? '+' : '-'}${Math.abs(impact.hpDelta)}` : impact.defenseDelta ? `DEF ${impact.defenseDelta}` : impact.note)}</strong>
      {impact.comparison && <small>{impact.comparison}</small>}
      {(impact.hpDelta || impact.defenseDelta || impact.staggerDelta || impact.note) && <em>{impact.note ?? [impact.hpDelta ? `${impact.hpDelta > 0 ? '+' : '-'}${Math.abs(impact.hpDelta)} HP` : null, impact.defenseDelta ? `${impact.defenseDelta} DEF` : null, impact.staggerDelta ? `+${impact.staggerDelta} ST` : null].filter(Boolean).join(' / ')}</em>}
    </div>}
    {effect && <div key={effect.id} className={`cena-target-fx ${elementClass}`} aria-label={`Efeito em ${participant.name}`} style={dmgColor ? { '--fx-color': dmgColor } as React.CSSProperties : undefined}>
      {!!effect.hpDelta && <div className={`cena-target-fx__number ${effect.hpDelta > 0 ? 'is-heal' : 'is-damage'}`}>
        {effect.hpDelta > 0 ? '+' : 'âˆ’'}{Math.abs(effect.hpDelta)}
      </div>}
      {effect.kinds.includes('heal') && <div className="cena-target-fx__aura is-heal">
        {Array.from({ length: 9 }, (_, i) => <i key={i} style={{ '--fx-i': i } as React.CSSProperties} />)}
      </div>}
      {effect.kinds.includes('damage') && <div className="cena-target-fx__aura is-damage">
        {Array.from({ length: 10 }, (_, i) => <i key={i} style={{ '--fx-i': i } as React.CSSProperties} />)}
      </div>}
      {effect.kinds.includes('evade') && <div className="cena-target-fx__aura is-evade"><b /><b /><b /></div>}
      {effect.kinds.includes('condition') && <div className="cena-target-fx__condition" style={{ '--condition-color': effect.conditionColor ?? '#a78bfa' } as React.CSSProperties}>
        <span>âœ¦</span><strong>{effect.conditionName ?? 'CondiÃ§Ã£o'}</strong>
      </div>}
    </div>}
  </div>;
};

interface DragSession {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  position: { x: number; y: number };
  frame: number | null;
}

const MapBoard: React.FC<MapBoardProps> = ({ image, imagePosition, participants, tokens, activeId, onMoveToken, onSelect, combat = false, enemyIds = [], targetEffect, targetableIds = [], targetImpacts = {}, selectedTargetId = null, areaPreviewIds = [], iconOverrides = {}, auraColors = {}, formaAvailableColors = {}, movableIds, maskEnemyResources = false }) => {
  const boardRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<DragSession | null>(null);
  const [transient, setTransient] = React.useState<Record<string, { x: number; y: number }>>({});
  const moveRef = React.useRef(onMoveToken);
  const selectRef = React.useRef(onSelect);
  React.useEffect(() => { moveRef.current = onMoveToken; }, [onMoveToken]);
  React.useEffect(() => { selectRef.current = onSelect; }, [onSelect]);

  const posOf = (id: string, index: number) => transient[id] ?? tokens[id] ?? fallbackTokenPosition(index);
  const clientToPct = (clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return null;
    const marginX = Math.min(4, 34 / rect.width * 100);
    const marginY = Math.min(5, 34 / rect.height * 100);
    return {
      x: Math.max(marginX, Math.min(100 - marginX, (clientX - rect.left) / rect.width * 100)),
      y: Math.max(marginY, Math.min(100 - marginY, (clientY - rect.top) / rect.height * 100)),
    };
  };
  const flushPosition = () => {
    const drag = dragRef.current;
    if (!drag) return;
    drag.frame = null;
    setTransient(current => ({ ...current, [drag.id]: drag.position }));
  };
  const beginDrag = (event: React.PointerEvent<HTMLDivElement>, id: string) => {
    if ((event.button ?? 0) !== 0) return;
    if (movableIds && !movableIds.includes(id)) { selectRef.current(id); return; }
    const position = clientToPct(event.clientX, event.clientY);
    if (!position) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, position, frame: null };
  };
  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const position = clientToPct(event.clientX, event.clientY);
    if (!position) return;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) drag.moved = true;
    drag.position = position;
    if (drag.frame === null) drag.frame = requestAnimationFrame(flushPosition);
  };
  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.frame !== null) cancelAnimationFrame(drag.frame);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
    setTransient(current => { const next = { ...current }; delete next[drag.id]; return next; });
    if (drag.moved) moveRef.current(drag.id, drag.position);
    else selectRef.current(drag.id);
  };
  const cancelDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.frame !== null) cancelAnimationFrame(drag.frame);
    dragRef.current = null;
    setTransient(current => { const next = { ...current }; delete next[drag.id]; return next; });
  };
  React.useEffect(() => () => {
    if (dragRef.current?.frame !== null && dragRef.current?.frame !== undefined) cancelAnimationFrame(dragRef.current.frame);
  }, []);

  const intenseFx = Math.abs(targetEffect?.hpDelta ?? 0) >= 12 ? 'is-impact-heavy' : '';
  const boardFx = targetEffect?.kinds.includes('damage') ? 'is-impact-damage' : targetEffect?.kinds.includes('heal') ? 'is-impact-heal' : targetEffect?.kinds.includes('evade') ? 'is-impact-evade' : '';
  return <div ref={boardRef} className={`cena-map-board ${combat ? 'is-combat' : ''} ${boardFx} ${intenseFx}`}>
    {image ? <div className="cena-map-board__image" style={{ backgroundImage: `url(${image})`, backgroundPosition: imagePosition || '50% 50%' }} /> : <div className="cena-map-board__empty">ADICIONE UMA IMAGEM AO CENÃRIO</div>}
    <div className="cena-map-board__shade" /><div className="cena-map-board__grid" /><div className="cena-map-board__frame" />
    {participants.map((participant, index) => {
      const position = posOf(participant.id, index);
      const effect = targetEffect?.targetId === participant.id ? targetEffect : null;
      const impact = targetImpacts[participant.id];
      return <Token key={participant.id}
        participant={participant}
        position={position}
        active={participant.id === activeId}
        enemy={enemyIds.includes(participant.id)}
        dragging={!!transient[participant.id]}
        tokenIcon={iconOverrides[participant.id] || participant.icon}
        auraColor={auraColors[participant.id]}
        formaAvailColor={formaAvailableColors[participant.id]}
        effect={effect}
        targetable={targetableIds.includes(participant.id)}
        selectedTarget={selectedTargetId === participant.id}
        inArea={areaPreviewIds.includes(participant.id)}
        movable={!movableIds || movableIds.includes(participant.id)}
        maskResources={maskEnemyResources && enemyIds.includes(participant.id)}
        impact={impact}
        onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={cancelDrag}
      />;
    })}
  </div>;
};

export default MapBoard;
