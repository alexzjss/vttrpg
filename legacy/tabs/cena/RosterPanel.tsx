import React from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Eye, EyeOff, Plus, Shield, Skull, Swords, Target, Trash2 } from 'lucide-react';
import type { Character, DamageType } from '../../types';
import type { NpcEntry } from '../../utils/cena';
import { getConditionIcon } from '../../components/combat/grid/conditionIconMap';
import { useGhostPct, useTransientOnChange } from '../../utils/animHooks';
import { isDefenseActive, migrateCharacterDefense } from '../../utils/defense';

export type ActiveRef = { id: string; side: 'party' | 'npc' };

export interface TokenFormaState {
  ring: 'none' | 'available' | 'active';
  color?: string;
  iconOverride?: string;
}

export interface TargetImpactPreview {
  hpDelta?: number;
  defenseDelta?: number;
  staggerDelta?: number;
  note?: string;
  accuracyLabel?: string;
  comparison?: string;
  intent?: 'attack' | 'heal' | 'buff' | 'debuff';
}

export interface RosterPanelProps {
  party: Character[];
  npcRoster: NpcEntry[];
  active: ActiveRef | null;
  currentTurnId?: string | null;
  targetFeedback?: { id: string; targetId: string; result?: 'success' | 'failure' } | null;
  round?: number;
  orderIds?: string[];
  onNextTurn?: () => void;
  onSelectTurn?: (index: number) => void;
  onEditCharacter?: (id: string) => void;
  onSelectActive: (ref: ActiveRef) => void;
  onToggleHidden: (npcId: string) => void;
  onTogglePresent: (npcId: string) => void;
  onRemoveNpc: (npcId: string) => void;
  onReorderTurn?: (fromIndex: number, toIndex: number) => void;
  turnControlsDisabled?: boolean;
  formaStates?: Record<string, TokenFormaState>;
  auraPreview?: { charId: string; cost: number } | null;
  targetPreview?: { diceRoll: string; damage?: number; damageType?: DamageType; healHp?: number; conditionName?: string; targeting: 'self' | 'other' } | null;
  targetImpacts?: Record<string, TargetImpactPreview>;
  streamingMode?: boolean;
  /** Replica segura: mantém o visual, remove ferramentas e mascara NPCs. */
  playerMode?: boolean;
}

const iconButton: React.CSSProperties = { background: 'transparent', border: 0, cursor: 'pointer', color: '#8c8378', padding: 3, display: 'flex' };
type GhostResources = Partial<Record<'hp' | 'aura' | 'defense', number>>;
type GhostMap = Record<string, GhostResources>;
const pctOf = (current: number, max = 0) => max > 0 ? Math.max(0, Math.min(100, current / max * 100)) : 0;
const ammoStackSize = (current: number) => current > 30 ? 10 : current > 12 ? 5 : 1;

function AmmoPile({ current, max }: { current: number; max?: number }) {
  const size = ammoStackSize(current);
  const fullStacks = Math.floor(current / size);
  const remainder = current % size;
  const visibleFullStacks = Math.min(fullStacks, 12);
  const stacks = [
    ...Array.from({ length: visibleFullStacks }, () => size),
    ...(remainder ? [remainder] : []),
  ];
  const hiddenAmmo = Math.max(0, fullStacks - visibleFullStacks) * size;
  return <span className="cena-ammo-pile" aria-label={`Municao: ${current}${max ? ` de ${max}` : ''}`} title={`Municao: ${current}${max ? `/${max}` : ''}`}>
    <span className="cena-ammo-pile__rounds" aria-hidden>
      {stacks.map((amount, index) => <i key={index} data-stack={amount > 1 ? amount : undefined} />)}
      {hiddenAmmo > 0 && <em>+{hiddenAmmo}</em>}
    </span>
    <b>{current}</b>
  </span>;
}

function Vital({ kind, current, max = 0, previewCost, previewDelta, mask, ghostPct: persistentGhostPct }: { kind: 'hp' | 'aura' | 'ammo'; current: number; max?: number; previewCost?: number; previewDelta?: number; mask?: boolean; ghostPct?: number }) {
  const pct = pctOf(current, max);
  const ghostPct = Math.max(pct, persistentGhostPct ?? pct);
  const ghosting = ghostPct > pct + 0.5;
  const band = pct > 60 ? 'high' : pct > 30 ? 'mid' : 'low';
  const previewNextPct = previewDelta ? pctOf(current + previewDelta, max) : null;
  if (kind === 'aura') {
    const previewFromPct = previewCost ? Math.max(0, Math.min(100, (current - previewCost) / max * 100)) : null;
    return <span className={`cena-vital cena-vital--aura ${ghosting ? 'is-ghosting' : ''}`} data-band={band} aria-label={mask ? 'Aura oculta em modo streaming' : `Aura: ${current} de ${max}`}>
      <i className="cena-vital__ghost" style={{ width: `${ghostPct}%` }} />
      <i className="cena-vital__aura-fill" style={{ width: `${pct}%` }} />
      {previewFromPct !== null && <span className="cena-vital__aura-preview" style={{ left: `${previewFromPct}%`, width: `${Math.max(0, pct - previewFromPct)}%` }} aria-hidden />}
      <b>AURA</b><em>{mask ? 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢' : `${current}/${max}`}</em>
    </span>;
  }
  if (kind === 'ammo') {
    return <span className="cena-ammo-badge" aria-label={`Munição: ${current}`}>
      <AmmoPile current={current} max={max} />
    </span>;
  }
  return <span className={`cena-vital cena-vital--hp ${ghosting ? 'is-ghosting' : ''}`} data-band={band} aria-label={mask ? 'Vitalidade oculta em modo streaming' : `Vitalidade: ${current} de ${max}`}>
    <i className="cena-vital__ghost" style={{ width: `${ghostPct}%` }} />
    <i style={{ width: `${pct}%` }} />
    {previewNextPct !== null && <span className={`cena-vital__impact ${previewDelta! < 0 ? 'is-loss' : 'is-gain'}`} style={previewDelta! < 0 ? { left: `${previewNextPct}%`, width: `${Math.max(0, pct - previewNextPct)}%` } : { left: `${pct}%`, width: `${Math.max(0, previewNextPct - pct)}%` }} aria-hidden />}
    <b>VITALIDADE</b><em>{mask ? 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢' : `${current}/${max}`}</em>
  </span>;
}
function DefenseVitals({ char, ghostPct: persistentGhostPct, preview }: { char: Character; ghostPct?: number; preview?: TargetImpactPreview }) {
  const defense = migrateCharacterDefense(char);
  const defensePct = pctOf(defense.defenseCurrent, defense.defenseMax);
  const staggerPct = pctOf(defense.staggerCurrent, defense.staggerMax);
  const defenseGhostPct = Math.max(defensePct, persistentGhostPct ?? defensePct);
  const staggerGhostPct = useGhostPct(staggerPct);
  const defenseGhosting = defenseGhostPct > defensePct + 0.5;
  const active = isDefenseActive(defense);
  const defensePreviewPct = preview?.defenseDelta ? pctOf(defense.defenseCurrent + preview.defenseDelta, defense.defenseMax) : null;
  const showStagger = defense.isDefenseBroken || defense.isStaggered || defense.staggerCurrent > 0;
  return <>
    <span
      className={`cena-vital cena-vital--defense ${defenseGhosting ? 'is-ghosting' : ''} ${showStagger ? 'has-stagger' : ''} ${defense.isDefenseBroken ? 'is-break' : active ? 'is-active' : 'is-recovering'}`}
      aria-label={`Defesa: ${defense.defenseCurrent} de ${defense.defenseMax}`}
    >
      <i className="cena-vital__ghost" style={{ width: `${defenseGhostPct}%` }} />
      <i className="cena-vital__defense-fill" style={{ width: `${defensePct}%` }} />
      {defensePreviewPct !== null && <span className={`cena-vital__impact ${preview!.defenseDelta! < 0 ? 'is-loss' : 'is-gain'}`} style={preview!.defenseDelta! < 0 ? { left: `${defensePreviewPct}%`, width: `${Math.max(0, defensePct - defensePreviewPct)}%` } : { left: `${defensePct}%`, width: `${Math.max(0, defensePreviewPct - defensePct)}%` }} aria-hidden />}
      <b>{defense.isDefenseBroken ? 'BREAK' : 'DEFESA'}</b>
      <em>{defense.defenseCurrent}/{defense.defenseMax}</em>
      {!defense.isDefenseBroken && <small>{Math.round(defense.defenseReduction * 100)}%</small>}
      {showStagger && <span
        className={`cena-vital--stagger ${defense.isStaggered ? 'is-staggered' : staggerPct >= 80 ? 'is-danger' : ''}`}
        aria-label={`Stagger: ${defense.staggerCurrent} de ${defense.staggerMax}`}
      >
        <span className="cena-vital--stagger__meta">
          <b>{defense.isStaggered ? 'DESNORTEADO' : 'STAGGER'}</b>
          <em>{defense.staggerCurrent}/{defense.staggerMax}</em>
        </span>
        <span className="cena-stagger-fuse" aria-hidden>
          <i className="cena-vital__ghost" style={{ width: `${staggerGhostPct}%` }} />
          <i className="cena-vital__stagger-fill" style={{ width: `${staggerPct}%` }} />
          <i className="cena-stagger-fuse__flame" style={{ left: `${Math.max(4, Math.min(96, staggerPct))}%` }} />
        </span>
      </span>}
    </span>
  </>;
}

function CurrentEffects({ char }: { char: Character }) {
  const effects = [
    ...char.conditions.map(condition => ({ name: condition.name, duration: condition.duration })),
    ...(char.activeEffects ?? []).map(active => ({
      name: active.effect.name,
      duration: active.remaining ?? active.effect.duration.amount ?? 0,
    })),
  ].filter((effect, index, all) => all.findIndex(candidate => candidate.name === effect.name) === index);
  if (effects.length === 0) return null;
  return <div className="cena-current-effects" aria-label={`Condições de ${char.name}`}>
    <span className="cena-current-effects__label">CONDIÇÕES &amp; EFEITOS</span>
    <div className="cena-current-effects__list">
      {effects.map((effect, index) => {
        const Icon = getConditionIcon(effect.name);
        return <span className="cena-current-effect" key={`${effect.name}-${index}`} title={`${effect.name} · ${effect.duration > 0 ? `${effect.duration} rodada(s)` : 'permanente'}`}>
          <Icon size={12} aria-hidden /><strong>{effect.name}</strong><em>{effect.duration > 0 ? effect.duration : '?'}</em>
        </span>;
      })}
    </div>
  </div>;
}

function InitiativeTrail({ entries, currentTurnId, formaStates = {}, disabled = false, onReorderTurn, onSelectTurn, onNextTurn }: { entries: Array<{ char: Character; side: 'party' | 'npc' }>; currentTurnId?: string | null; formaStates?: Record<string, TokenFormaState>; disabled?: boolean; onReorderTurn?: (fromIndex: number, toIndex: number) => void; onSelectTurn?: (index: number) => void; onNextTurn?: () => void }) {
  const [draggedId, setDraggedId] = React.useState<string | null>(null);
  if (entries.length === 0) return null;
  const currentIndex = Math.max(0, entries.findIndex(entry => entry.char.id === currentTurnId));
  const moveDraggedTo = (clientX: number, clientY: number) => {
    if (!draggedId || !onReorderTurn) return;
    const node = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('.cena-initiative-node[data-turn-index]');
    if (!node) return;
    const toIndex = Number(node.dataset.turnIndex);
    const fromIndex = entries.findIndex(item => item.char.id === draggedId);
    if (Number.isFinite(toIndex) && fromIndex >= 0 && fromIndex !== toIndex) onReorderTurn(fromIndex, toIndex);
  };
  return <div className={`cena-initiative-trail ${draggedId ? 'is-reordering' : ''}`} aria-label="Trilha de iniciativa" onPointerMove={event => moveDraggedTo(event.clientX, event.clientY)} onPointerUp={() => setDraggedId(null)} onPointerCancel={() => setDraggedId(null)}>
    <div className="cena-initiative-trail__rail" style={{ '--turn-progress': `${entries.length <= 1 ? 100 : currentIndex / (entries.length - 1) * 100}%` } as React.CSSProperties} />
    {entries.map((entry, index) => {
      const active = entry.char.id === currentTurnId;
      const next = !active && index === (currentIndex + 1) % entries.length;
      const defense = migrateCharacterDefense(entry.char);
      const skip = entry.char.currentHp <= 0 || defense.isStaggered;
      const hasEvent = defense.isDefenseBroken || defense.isStaggered || entry.char.conditions.length > 0 || formaStates[entry.char.id]?.ring === 'active';
      return <button key={`${entry.side}-${entry.char.id}`} type="button" data-turn-index={index}
        onPointerDown={event => { if (!onReorderTurn || event.button !== 0) return; event.preventDefault(); setDraggedId(entry.char.id); }}
        onClick={() => !disabled && onSelectTurn?.(index)}
        disabled={disabled}
        className={`cena-initiative-node ${draggedId === entry.char.id ? 'is-dragging' : ''} ${active ? 'is-active' : ''} ${next ? 'is-next' : ''} ${skip ? 'is-skip' : ''} ${hasEvent ? 'has-event' : ''} ${entry.side === 'npc' ? 'is-npc' : 'is-party'}`} title={`${index + 1}. ${entry.char.name}`}>
        <i style={entry.char.icon ? { backgroundImage: `url(${entry.char.icon})` } : undefined}>{!entry.char.icon && entry.char.name.charAt(0).toUpperCase()}</i>
        <b>{index + 1}</b>
        {hasEvent && <em>{defense.isDefenseBroken ? 'BR' : defense.isStaggered ? 'ST' : formaStates[entry.char.id]?.ring === 'active' ? 'FO' : 'FX'}</em>}
      </button>;
    })}
    {onNextTurn && <button type="button" className="cena-initiative-next" disabled={disabled} onClick={onNextTurn} aria-label="Avançar turno" title="Avançar turno"><ChevronRight size={16} /></button>}
  </div>;
}

interface RowProps {
  char: Character;
  side: 'party' | 'npc';
  selected: boolean;
  current: boolean;
  feedback?: { id: string; result: 'success' | 'failure' } | null;
  forma?: TokenFormaState;
  onClick: () => void;
  onEdit?: () => void;
  onInspect?: (char: Character, top: number) => void;
  onInspectEnd?: () => void;
  auraPreviewCost?: number;
  ghosts?: GhostResources;
  impact?: TargetImpactPreview;
  mask?: boolean;
  children?: React.ReactNode;
}

const Row: React.FC<RowProps> = ({ char, side, selected, current, feedback, forma, onClick, onEdit, onInspect, onInspectEnd, auraPreviewCost, ghosts = {}, impact, mask, children }) => {
  const formaColor = forma?.ring === 'active' ? forma.color : undefined;
  const portraitImage = forma?.ring === 'active' && forma.iconOverride ? forma.iconOverride : char.icon;
  const isDefeated = char.currentHp <= 0;
  const defense = migrateCharacterDefense(char);
  const lowAura = char.maxAura > 0 && char.currentAura / char.maxAura <= 0.2;
  const justDowned = useTransientOnChange(isDefeated, 650);
  return (
  <div onClick={onClick} onDoubleClick={onEdit} onMouseEnter={event => onInspect?.(char, event.currentTarget.getBoundingClientRect().top)} onMouseLeave={onInspectEnd} title={char.name}
    className={`cena-combatant ${side === 'npc' ? 'is-npc' : 'is-party'} ${selected ? 'is-selected' : ''} ${current ? 'is-current' : ''} ${char.bannerImage ? 'has-banner' : ''} ${formaColor ? 'has-forma-color' : ''} ${lowAura ? 'is-aura-low' : ''} ${defense.isDefenseBroken ? 'is-defense-break' : ''} ${defense.isStaggered ? 'is-staggered' : ''} ${impact ? 'has-impact-preview' : ''} ${isDefeated ? 'is-defeated' : ''} ${justDowned ? 'is-downing' : ''}`}
    style={formaColor ? { ['--forma-color' as string]: formaColor } : undefined}>
    {feedback && <span key={feedback.id} aria-label={`${feedback.result === 'success' ? 'Sucesso' : 'Falha'} da ação em ${char.name}`} className={`cena-combatant__result-glow is-${feedback.result}`} />}
    {(char.bannerImage || char.icon) && <div className={`cena-combatant__backdrop ${char.bannerImage ? 'is-custom' : ''}`} style={{ backgroundImage: `url(${char.bannerImage || char.icon})`, backgroundPosition: (char.bannerImage ? char.bannerImagePosition : char.iconPosition) || '50% 50%' }} />}
    <div className="cena-combatant__portrait-col">
      <div className="cena-combatant__portrait" style={portraitImage ? { backgroundImage: `url(${portraitImage})`, backgroundPosition: (forma?.ring === 'active' && forma.iconOverride ? '50% 50%' : char.iconPosition) || '50% 50%' } : undefined}>
        {!portraitImage && char.name.charAt(0).toUpperCase()}
        {isDefeated && <span className="cena-combatant__downed" aria-label={`${char.name} derrotado`}><Skull size={16} /></span>}
        {current && <span className="cena-combatant__turn" />}
        {forma && forma.ring !== 'none' && <span
          className={`cena-combatant__forma-ring is-${forma.ring}`}
          style={{ ['--forma-color' as string]: forma.color ?? '#f59e0b' }}
          aria-label={forma.ring === 'available' ? `Forma disponível para ${char.name}` : `Forma ativa de ${char.name}`}
        >
          {forma.ring === 'available' && Array.from({ length: 6 }, (_, i) => <i key={i} style={{ ['--flame-i' as string]: i } as React.CSSProperties} />)}
        </span>}
      </div>
      {char.maxAmmo > 0 && <Vital kind="ammo" current={char.currentAmmo} max={char.maxAmmo} />}
    </div>
    <div className="cena-combatant__body">
      <div className="cena-combatant__title"><strong>{char.name}</strong></div>
      <Vital kind="hp" current={char.currentHp} max={char.maxHp} ghostPct={ghosts.hp} previewDelta={impact?.hpDelta} mask={mask} />
      <Vital kind="aura" current={char.currentAura} max={char.maxAura} ghostPct={ghosts.aura} previewCost={auraPreviewCost} mask={mask} />
      {!mask && <DefenseVitals char={char} ghostPct={ghosts.defense} preview={impact} />}
      {current && <CurrentEffects char={char} />}
    </div>
    {children && <div className="cena-combatant__tools">{children}</div>}
  </div>
  );
};

const RosterPanel: React.FC<RosterPanelProps> = ({
  party, npcRoster, active, currentTurnId = null, targetFeedback = null, round, orderIds = [], onNextTurn, onSelectTurn, onEditCharacter,
  onSelectActive, onToggleHidden, onTogglePresent, onRemoveNpc, onReorderTurn, turnControlsDisabled = false,
  formaStates = {}, auraPreview = null, targetPreview = null, targetImpacts = {}, streamingMode = false, playerMode = false,
}) => {
  const [preview, setPreview] = React.useState<{ char: Character; top: number } | null>(null);
  const visibleNpcs = npcRoster.filter(npc => !npc.hidden);
  const hiddenNpcs = npcRoster.filter(npc => npc.hidden);
  const rosterChars = React.useMemo(() => [...party, ...npcRoster], [party, npcRoster]);
  const [ghostsById, setGhostsById] = React.useState<GhostMap>({});
  const pctSnapshot = React.useRef<Record<string, Required<GhostResources>>>({});
  const previousTurnId = React.useRef<string | null>(currentTurnId);

  React.useEffect(() => {
    const nextSnapshot: Record<string, Required<GhostResources>> = {};
    const dropped: GhostMap = {};

    rosterChars.forEach(char => {
      const defense = migrateCharacterDefense(char);
      const current = {
        hp: pctOf(char.currentHp, char.maxHp),
        aura: pctOf(char.currentAura, char.maxAura),
        defense: pctOf(defense.defenseCurrent, defense.defenseMax),
      };
      const previous = pctSnapshot.current[char.id];
      if (previous) {
        (Object.keys(current) as (keyof typeof current)[]).forEach(resource => {
          if (current[resource] < previous[resource] - 0.5) {
            dropped[char.id] = {
              ...dropped[char.id],
              [resource]: previous[resource],
            };
          }
        });
      }
      nextSnapshot[char.id] = current;
    });

    const finishedTurnId = previousTurnId.current && previousTurnId.current !== currentTurnId
      ? previousTurnId.current
      : null;

    if (finishedTurnId || Object.keys(dropped).length) {
      setGhostsById(old => {
        const next: GhostMap = { ...old };
        if (finishedTurnId) delete next[finishedTurnId];
        Object.entries(dropped).forEach(([id, resources]) => {
          next[id] = { ...(next[id] ?? {}) };
          (Object.entries(resources) as [keyof GhostResources, number][]).forEach(([resource, value]) => {
            next[id][resource] = Math.max(next[id][resource] ?? 0, value);
          });
        });
        return next;
      });
    }

    pctSnapshot.current = nextSnapshot;
    previousTurnId.current = currentTurnId;
  }, [rosterChars, currentTurnId]);

  const npcTools = (char: NpcEntry, hidden = false) => <>
    {!hidden && <button style={iconButton} title={char.present ? 'Presente' : 'Ausente'} onClick={event => { event.stopPropagation(); onTogglePresent(char.id); }}><span style={{ color: char.present ? '#ef476f' : '#6d665e' }}>ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â</span></button>}
    <button style={iconButton} title={hidden ? 'Revelar' : 'Ocultar'} onClick={event => { event.stopPropagation(); onToggleHidden(char.id); }}>{hidden ? <EyeOff size={15} /> : <Eye size={15} />}</button>
    <button style={iconButton} title="Remover" onClick={event => { event.stopPropagation(); onRemoveNpc(char.id); }}><Trash2 size={15} /></button>
  </>;
  const ordered = orderIds.map(id => {
    const ally = party.find(character => character.id === id);
    if (ally) return { char: ally, side: 'party' as const };
    const npc = visibleNpcs.find(character => character.id === id);
    return npc ? { char: npc, side: 'npc' as const } : null;
  }).filter((entry): entry is { char: Character; side: 'party' | 'npc' } => !!entry);
  const renderRow = (char: Character, side: 'party' | 'npc') => <Row key={char.id} char={char} side={side}
    selected={active?.side === side && active.id === char.id} current={currentTurnId === char.id}
    feedback={targetFeedback?.targetId === char.id && targetFeedback.result ? { id: targetFeedback.id, result: targetFeedback.result } : null}
    forma={formaStates[char.id]}
    auraPreviewCost={auraPreview?.charId === char.id ? auraPreview.cost : undefined}
    impact={targetImpacts[char.id]}
    ghosts={ghostsById[char.id]}
    mask={(streamingMode || playerMode) && side === 'npc'}
    onClick={() => onSelectActive({ id: char.id, side })} onEdit={onEditCharacter ? () => onEditCharacter(char.id) : undefined}
    onInspect={(inspected, top) => setPreview({ char: inspected, top })} onInspectEnd={() => setPreview(null)}>
    {side === 'npc' && !playerMode ? npcTools(char as NpcEntry) : undefined}
  </Row>;

  return <><section className="cena-roster">
    {round && turnControlsDisabled && <div className="cena-combatants-head"><span className="cena-combatants-head__pause-tag">PAUSADO</span></div>}
    {!!round && <InitiativeTrail entries={ordered} currentTurnId={currentTurnId} formaStates={formaStates} disabled={turnControlsDisabled} onReorderTurn={onReorderTurn} onSelectTurn={onSelectTurn} onNextTurn={onNextTurn} />}
    <div className="cena-roster__list">
      {!!round && <>
        {ordered.length ? ordered.map(entry => renderRow(entry.char, entry.side)) : <p className="cena-roster__empty">Nenhum combatente na ordem.</p>}
      </>}
      {!round && <>{party.length ? party.map(char => renderRow(char, 'party')) : <p className="cena-roster__empty">Nenhum personagem no combate.</p>}</>}
    </div>
  </section>{preview && !(playerMode && npcRoster.some(npc => npc.id === preview.char.id)) && createPortal(<div className="cena-floating-card" style={{ top: Math.max(16, Math.min(window.innerHeight - 280, preview.top - 16)) }}>
    <div className="cena-floating-card__portrait" style={preview.char.icon ? { backgroundImage: `url(${preview.char.icon})` } : undefined}>{!preview.char.icon && preview.char.name.charAt(0)}</div>
    <div className="cena-floating-card__heading"><span>COMBATENTE</span><strong>{preview.char.name}</strong></div>
    <div className="cena-floating-card__stats"><span><b>HP</b>{preview.char.currentHp}/{preview.char.maxHp}</span><span><b>AURA</b>{preview.char.currentAura}/{preview.char.maxAura}</span>{preview.char.maxAmmo > 0 && <span><b>MUN</b>{preview.char.currentAmmo}</span>}<span><b>DEF</b>{migrateCharacterDefense(preview.char).defenseCurrent}/{migrateCharacterDefense(preview.char).defenseMax}</span></div>
    <div className="cena-floating-card__battle"><span><Swords size={12}/> VELOCIDADE <b>{(preview.char.speed ?? preview.char.baseInitiative ?? 0) >= 0 ? '+' : ''}{preview.char.speed ?? preview.char.baseInitiative ?? 0}</b></span><span><Shield size={12}/> REDUÇÃO <b>{Math.round(migrateCharacterDefense(preview.char).defenseReduction * 100)}%</b></span></div>
    {targetPreview && targetPreview.targeting !== 'self' && <div className="cena-floating-card__testpreview">
      <Target size={12}/> TESTE <b>{targetPreview.diceRoll}</b>
      {!!targetPreview.damage && <span> · {targetPreview.damage} dano</span>}
      {!!targetPreview.healHp && <span> · +{targetPreview.healHp} cura</span>}
      {targetPreview.conditionName && <span> · {targetPreview.conditionName}</span>}
    </div>}
    <small>Duplo clique para editar</small>
  </div>, document.body)}</>;
};

export default RosterPanel;
