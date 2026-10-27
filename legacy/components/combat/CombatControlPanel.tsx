import React, { useState, useMemo } from 'react';
import {
  Play, ChevronRight, Clock, UserPlus, ScrollText, XCircle,
  Hourglass, Layers, MapPin, Users, Dices, BookOpen,
  Plus, Minus, RefreshCw, Pause, ChevronDown, ChevronUp,
  Trash2, X, Check, Zap, ShieldAlert,
} from 'lucide-react';
import { CombatState, Combatant, Card } from '../../types';
import { PIN_COLORS } from '../../utils/theme';
import CardFusionPanel from './CardFusionPanel';

// ─── Types ──────────────────────────────────────────────────────────

type PanelMode = 'controls' | 'contextual';

export interface CombatControlPanelProps {
  combat: CombatState;
  currentActor: Combatant | null;
  // Flow
  onStartCombat: () => void;
  onNextTurn: () => void;
  onEndCombat: () => void;
  onAddCombatant: () => void;
  onOpenHistory: () => void;
  // Timer
  turnTimerEnabled: boolean;
  turnTimerRemaining: number;
  turnTimerRunning: boolean;
  turnTimerSeconds: number;
  onTimerToggle: () => void;
  onTimerPlayPause: () => void;
  onTimerReset: () => void;
  onTimerSecondsChange: (v: number) => void;
  // Custom pins
  placingPin: { label: string; color: string } | null;
  onPlacePin: (label: string, color: string) => void;
  onCancelPin: () => void;
  onRemovePin: (id: string) => void;
  // Campo: global bonus + mass damage
  onGlobalBonus: (delta: number) => void;
  showMassDmgPanel: boolean;
  massDmgMode: 'damage' | 'heal';
  massDmgAmount: string;
  massDmgTargets: string[];
  onToggleMassDmgPanel: () => void;
  onSetMassDmgMode: (m: 'damage' | 'heal') => void;
  onSetMassDmgAmount: (v: string) => void;
  onApplyMassDamage: () => void;
  onClearMassDmgTargets: () => void;
  // Unions
  unionMode: boolean;
  unionSelecting: string[];
  unionColor: string;
  onSetUnionMode: (v: boolean) => void;
  onSetUnionColor: (color: string) => void;
  onCreateUnion: () => void;
  onBreakUnion: (id: string) => void;
  // Dice
  combatQuickRoll: { sides: number; result: number; timestamp: number } | null;
  onQuickRoll: (sides: number) => void;
  // Notes
  combatNotes: string;
  onNotesChange: (v: string) => void;
  // Fusion
  cards: Card[];
  onStartFusion: (selectedCards: Card[]) => void;
  floating?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────

interface SectionProps {
  label: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: number;
}

const Section: React.FC<SectionProps> = ({ label, icon, isOpen, onToggle, children, badge }) => (
  <div className={`mp-control-section ${isOpen ? 'mp-control-section--open' : ''}`} style={{
    borderRadius: 8,
    background: 'transparent',
    border: 'none',
    overflow: 'hidden',
  }}>
    <button
      onClick={onToggle}
      className="mp-control-section-title"
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 10px',
        background: 'transparent', border: 'none',
        cursor: 'pointer',
        color: 'var(--text-muted)',
      }}
    >
      <span className="mp-control-section-title__icon" style={{ color: 'var(--text-faint)', display: 'flex' }}>{icon}</span>
      <span className="mp-heading" style={{ fontSize: 8, color: 'var(--text-secondary)', flex: 1, textAlign: 'left' }}>
        {label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span style={{
          fontSize: 7, fontWeight: 900,
          background: 'rgba(122,94,26,0.20)',
          border: '1px solid rgba(122,94,26,0.33)',
          color: 'var(--gold-mid)', borderRadius: 4, padding: '1px 5px',
        }}>
          {badge}
        </span>
      )}
      {isOpen
        ? <ChevronUp size={9} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
        : <ChevronDown size={9} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
      }
    </button>
    {isOpen && (
      <div className="mp-control-drawer" style={{ padding: '0 10px 10px', borderTop: '1px solid var(--border-faint)' }}>
        {children}
      </div>
    )}
  </div>
);

// ─── Main component ─────────────────────────────────────────────────

const CombatControlPanel: React.FC<CombatControlPanelProps> = ({
  combat, currentActor,
  onStartCombat, onNextTurn, onEndCombat, onAddCombatant, onOpenHistory,
  turnTimerEnabled, turnTimerRemaining, turnTimerRunning, turnTimerSeconds,
  onTimerToggle, onTimerPlayPause, onTimerReset, onTimerSecondsChange,
  placingPin, onPlacePin, onCancelPin, onRemovePin,
  onGlobalBonus,
  showMassDmgPanel, massDmgMode, massDmgAmount, massDmgTargets,
  onToggleMassDmgPanel, onSetMassDmgMode, onSetMassDmgAmount, onApplyMassDamage, onClearMassDmgTargets,
  unionMode, unionSelecting, unionColor,
  onSetUnionMode, onSetUnionColor, onCreateUnion, onBreakUnion,
  combatQuickRoll, onQuickRoll,
  combatNotes, onNotesChange,
  cards, onStartFusion,
  floating = false,
}) => {
  const [mode, setMode] = useState<PanelMode>('controls');
  const [openSections, setOpenSections] = useState<string[]>([]);

  // Pin creator local state
  const [pinLabel, setPinLabel] = useState('');
  const [pinColor, setPinColor] = useState('#ef4444');

  // Fusion open state
  const [fusionActive, setFusionActive] = useState(false);

  const toggleSection = (key: string) =>
    setOpenSections(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  const isOpen = (key: string) => openSections.includes(key);

  const timerMin = String(Math.floor(turnTimerRemaining / 60)).padStart(2, '0');
  const timerSec = String(turnTimerRemaining % 60).padStart(2, '0');
  const timerUrgent = turnTimerEnabled && turnTimerRemaining <= 10 && turnTimerRunning;

  const fusionActorCards = useMemo(() => {
    if (!currentActor) return [];
    const extraIds = (combat.activeForms ?? [])
      .find(f => f.combatantId === currentActor.combatId)?.extraCardIds ?? [];
    const allIds = [...currentActor.cardIds, ...extraIds];
    return allIds.map(id => cards.find(c => c.id === id)).filter((c): c is Card => c !== undefined);
  }, [currentActor, combat, cards]);

  return (
    <div
      className={`hidden lg:flex flex-col mp-control-panel ${floating ? 'mp-control-panel--floating' : ''}`}
      style={{
        width: 260,
        flexShrink: 0,
        height: '100%',
        background: floating ? 'rgba(6,8,16,0.78)' : 'var(--bg-surface)',
        border: floating ? '1px solid rgba(47,212,196,0.26)' : undefined,
        borderLeft: floating ? undefined : '1px solid var(--border-faint)',
        borderRadius: floating ? 0 : undefined,
        overflow: 'hidden',
        boxShadow: floating ? '0 18px 60px rgba(0,0,0,0.58), 0 0 26px rgba(47,212,196,0.10)' : undefined,
        backdropFilter: floating ? 'blur(18px) saturate(1.25)' : undefined,
      }}
    >
      {/* ── Header ── */}
      <div className="mp-control-header" style={{
        padding: '8px 10px 7px',
        borderBottom: '1px solid var(--border-faint)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, background: 'transparent',
      }}>
        <span className="mp-heading mp-control-header__title" style={{ fontSize: 9, color: 'var(--gold-mid)' }}>Combate</span>
        <div className="mp-control-header__modes" style={{ display: 'flex', gap: 3 }}>
          {(['controls', 'contextual'] as PanelMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)} className={`mp-control-mode ${mode === m ? 'mp-control-mode--active' : ''}`} style={{
              fontSize: 7, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
              padding: '2px 7px', borderRadius: 4,
              background: mode === m ? 'rgba(122,94,26,0.20)' : 'transparent',
              border: `1px solid ${mode === m ? 'rgba(122,94,26,0.47)' : 'rgba(255,255,255,0.1)'}`,
              color: mode === m ? 'var(--gold-mid)' : 'var(--text-faint)',
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}>
              {m === 'controls' ? 'Controles' : 'Contextual'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto custom-scroll mp-control-body"
        style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>

        {mode === 'controls' ? (<>

          {/* ── FLUXO DE COMBATE ── */}
          <div className="mp-control-section mp-control-section--hero" style={{
            borderRadius: 8,
            background: 'transparent',
            border: 'none',
            padding: '8px 10px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
              <div className="mp-heading" style={{ fontSize: 8, color: 'var(--text-faint)' }}>
                Fluxo de Combate
              </div>
              {/* Timer toggle */}
              <button onClick={onTimerToggle} style={{
                fontSize: 7, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                background: turnTimerEnabled ? 'rgba(201,152,58,0.15)' : 'var(--bg-surface)',
                border: '1px solid var(--border-faint)',
                color: turnTimerEnabled ? 'var(--gold-mid)' : 'var(--text-faint)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
              }}>
                <Hourglass size={7} />
                {turnTimerEnabled ? 'Timer On' : 'Timer Off'}
              </button>
            </div>

            {combat.isActive ? (<>
              {/* Round + actor */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 24, fontWeight: 700, lineHeight: 1, color: 'var(--gold-bright)', flexShrink: 0,
                }}>
                  R{combat.round}
                </div>
                {currentActor && (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 7, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Vez de</div>
                    <div style={{ fontSize: 11, fontWeight: 800, fontStyle: 'italic', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {currentActor.name}
                    </div>
                  </div>
                )}
              </div>

              {/* Timer full controls */}
              {turnTimerEnabled && (<>
                <div className={timerUrgent ? 'timer-urgent' : undefined} style={{
                  textAlign: 'center', padding: '8px', borderRadius: 8, marginBottom: 6,
                  background: timerUrgent ? 'rgba(239,68,68,0.1)' : 'rgba(0,0,0,0.25)',
                  border: `1px solid ${timerUrgent ? 'rgba(239,68,68,0.3)' : 'var(--border-faint)'}`,
                }}>
                  <p style={{ fontSize: 28, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: timerUrgent ? '#f87171' : 'var(--text-primary)', lineHeight: 1 }}>
                    {timerMin}:{timerSec}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
                  <button onClick={onTimerPlayPause} style={{
                    flex: 2, padding: '6px', borderRadius: 7, fontSize: 10, fontWeight: 700,
                    background: turnTimerRunning ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                    border: `1px solid ${turnTimerRunning ? 'rgba(239,68,68,0.35)' : 'rgba(34,197,94,0.35)'}`,
                    color: turnTimerRunning ? '#f87171' : '#86efac',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    cursor: 'pointer',
                  }}>
                    {turnTimerRunning ? <><Pause size={9} /> Pausar</> : <><Play size={9} /> Iniciar</>}
                  </button>
                  <button onClick={onTimerReset} style={{
                    flex: 1, padding: '6px', borderRadius: 7, fontSize: 10, fontWeight: 700,
                    background: 'var(--bg-surface)', border: '1px solid var(--border-faint)',
                    color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}>
                    <RefreshCw size={9} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 7 }}>
                  <span style={{ fontSize: 8, color: 'var(--text-muted)', flexShrink: 0 }}>Limite:</span>
                  <input type="number" value={turnTimerSeconds} min={5} max={600}
                    onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v > 0) onTimerSecondsChange(v); }}
                    style={{ flex: 1, background: 'rgba(0,0,0,0.35)', border: '1px solid var(--border-faint)', borderRadius: 6, padding: '4px 6px', fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: 'var(--text-primary)', outline: 'none', textAlign: 'center' }}
                  />
                  <span style={{ fontSize: 8, color: 'var(--text-muted)', flexShrink: 0 }}>seg</span>
                </div>
              </>)}

              {/* Flow buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button onClick={onNextTurn} className="mp-control-primary" style={{
                  padding: '7px 10px',
                  background: 'linear-gradient(135deg, #c2410c 0%, #f59e0b 36%, #ffe0a3 52%, #f0c060 66%, #c2410c 100%)',
                  border: 'none', borderRadius: 7, color: '#1a0f06', fontWeight: 700, fontSize: 10,
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: 'pointer',
                  textShadow: '0 1px 0 rgba(255,231,170,0.4)',
                  boxShadow: '0 0 16px rgba(249,115,22,0.5), 0 4px 14px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.35)',
                }}>
                  Próximo <ChevronRight size={11} />
                </button>
                <button onClick={onNextTurn} className="mp-control-secondary" style={{
                  padding: '5px 10px', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7,
                  color: 'var(--text-muted)', fontWeight: 700, fontSize: 10,
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: 'pointer',
                }}>
                  <Clock size={9} /> Aguardar
                </button>
                <button onClick={onEndCombat} className="mp-control-danger" style={{
                  padding: '5px 10px', background: 'rgba(220,38,38,0.08)',
                  border: '1px solid rgba(220,38,38,0.22)', borderRadius: 7,
                  color: '#f87171', fontWeight: 700, fontSize: 10,
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: 'pointer',
                }}>
                  <XCircle size={9} /> Encerrar
                </button>
              </div>
            </>) : (<>
              <p style={{ fontSize: 10, color: 'var(--text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10, textAlign: 'center' }}>
                Aguardando início
              </p>
              <button onClick={onStartCombat} disabled={combat.combatants.length === 0}
                title={combat.combatants.length === 0 ? 'Adicione ao menos um combatente para iniciar' : 'Iniciar combate'}
                className={combat.combatants.length > 0 ? 'mp-control-primary' : 'mp-control-secondary'}
                style={{
                  width: '100%', padding: '9px 12px',
                  background: combat.combatants.length === 0 ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #c2410c 0%, #f59e0b 36%, #ffe0a3 52%, #f0c060 66%, #c2410c 100%)',
                  border: 'none', borderRadius: 7,
                  color: combat.combatants.length === 0 ? 'var(--text-faint)' : '#0f1117',
                  fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  cursor: combat.combatants.length === 0 ? 'not-allowed' : 'pointer',
                  textShadow: combat.combatants.length === 0 ? 'none' : '0 1px 0 rgba(255,231,170,0.4)',
                  boxShadow: combat.combatants.length === 0 ? 'none' : '0 0 18px rgba(249,115,22,0.5), 0 4px 16px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.35)',
                }}>
                <Play size={12} /> Iniciar Combate
              </button>
              {combat.combatants.length === 0 && (
                <p style={{ fontSize: 8, color: 'var(--text-faint)', marginTop: 7, textAlign: 'center', lineHeight: 1.5 }}>
                  Adicione ao menos um combatente abaixo.
                </p>
              )}

              {/* Timer controls even when inactive */}
              {turnTimerEnabled && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 8, color: 'var(--text-muted)', flexShrink: 0 }}>Limite:</span>
                  <input type="number" value={turnTimerSeconds} min={5} max={600}
                    onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v > 0) onTimerSecondsChange(v); }}
                    style={{ flex: 1, background: 'rgba(0,0,0,0.35)', border: '1px solid var(--border-faint)', borderRadius: 6, padding: '4px 6px', fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: 'var(--text-primary)', outline: 'none', textAlign: 'center' }}
                  />
                  <span style={{ fontSize: 8, color: 'var(--text-muted)', flexShrink: 0 }}>seg</span>
                </div>
              )}
            </>)}
          </div>

          {/* ── COMBATENTES ── */}
          <div className="mp-control-section mp-control-section--compact" style={{ borderRadius: 8, background: 'transparent', border: 'none', padding: '8px 10px' }}>
            <div className="mp-heading" style={{ fontSize: 8, color: 'var(--text-faint)', marginBottom: 7 }}>Combatentes</div>
            <div style={{ display: 'flex', gap: 5 }}>
              <button onClick={onAddCombatant} className="mp-control-primary mp-control-primary--small" style={{
                flex: 1, padding: '6px 8px',
                background: 'rgba(122,94,26,0.12)', border: '1px solid rgba(122,94,26,0.27)', borderRadius: 7,
                color: 'var(--gold-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer',
              }}>
                <UserPlus size={12} /> Adicionar
              </button>
              <button onClick={onOpenHistory} title="Histórico de combate" className="mp-control-secondary mp-control-icon-button" style={{
                padding: '6px 9px', background: 'var(--bg-surface)',
                border: '1px solid var(--border-faint)', borderRadius: 7,
                color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}>
                <ScrollText size={13} />
              </button>
            </div>
          </div>

          {/* ── CAMPO DE BATALHA ── */}
          <Section
            label="Campo de Batalha"
            icon={<MapPin size={10} />}
            isOpen={isOpen('campo')}
            onToggle={() => toggleSection('campo')}
            badge={(combat.customPins?.length ?? 0)}
          >
            {/* Global Bonus */}
            <div style={{ paddingTop: 8 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Zap size={8} style={{ color: '#f59e0b' }} /> Bônus Global
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-faint)', borderRadius: 8, padding: '2px 4px' }}>
                <button onClick={() => onGlobalBonus(-1)} style={{ padding: '6px 10px', color: 'var(--text-muted)', borderRadius: 7, cursor: 'pointer', background: 'transparent', border: 'none' }} className="hover:bg-amber-600/20 hover:text-white transition-colors">
                  <Minus size={12} />
                </button>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 22, color: combat.globalBonus !== 0 ? 'var(--gold-bright)' : 'var(--text-faint)' }}>
                  {combat.globalBonus > 0 ? `+${combat.globalBonus}` : combat.globalBonus}
                </span>
                <button onClick={() => onGlobalBonus(1)} style={{ padding: '6px 10px', color: 'var(--text-muted)', borderRadius: 7, cursor: 'pointer', background: 'transparent', border: 'none' }} className="hover:bg-amber-600/20 hover:text-white transition-colors">
                  <Plus size={12} />
                </button>
              </div>
            </div>

            {/* Mass Damage */}
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-faint)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showMassDmgPanel ? 6 : 0 }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ShieldAlert size={8} style={{ color: '#f87171' }} /> Dano em Massa
                </div>
                <button onClick={onToggleMassDmgPanel} style={{
                  fontSize: 7, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                  background: showMassDmgPanel ? 'rgba(201,152,58,0.15)' : 'var(--bg-surface)',
                  border: '1px solid var(--border-faint)',
                  color: showMassDmgPanel ? 'var(--gold-mid)' : 'var(--text-muted)', cursor: 'pointer',
                }}>
                  {showMassDmgPanel ? '▲ Fechar' : '▼ Abrir'}
                </button>
              </div>
              {showMassDmgPanel && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['damage', 'heal'] as const).map(m => (
                      <button key={m} onClick={() => onSetMassDmgMode(m)} style={{
                        flex: 1, padding: '4px 0', borderRadius: 6, fontSize: 9, fontWeight: 700,
                        textTransform: 'uppercase', cursor: 'pointer', border: '1px solid',
                        background: massDmgMode === m ? (m === 'damage' ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)') : 'transparent',
                        borderColor: massDmgMode === m ? (m === 'damage' ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.5)') : 'var(--border-faint)',
                        color: massDmgMode === m ? (m === 'damage' ? '#f87171' : '#86efac') : 'var(--text-muted)',
                      }}>
                        {m === 'damage' ? '⚔ Dano' : '❤ Cura'}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <input type="number" value={massDmgAmount} onChange={e => onSetMassDmgAmount(e.target.value)} placeholder="Qtd" min="0"
                      style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-faint)', borderRadius: 7, padding: '5px 8px', fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: 'var(--text-primary)', outline: 'none', textAlign: 'center' }} />
                    <button onClick={onApplyMassDamage} disabled={!massDmgAmount || massDmgTargets.length === 0} style={{
                      padding: '5px 10px', borderRadius: 7, fontSize: 10, fontWeight: 700,
                      background: massDmgMode === 'damage' ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)',
                      border: `1px solid ${massDmgMode === 'damage' ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.5)'}`,
                      color: massDmgMode === 'damage' ? '#f87171' : '#86efac',
                      opacity: (!massDmgAmount || massDmgTargets.length === 0) ? 0.4 : 1,
                      cursor: (!massDmgAmount || massDmgTargets.length === 0) ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <Check size={9} /> Ok
                    </button>
                  </div>
                  <p style={{ fontSize: 8, color: 'var(--text-muted)' }}>Alvos ({massDmgTargets.length}): clique nos combatentes acima</p>
                  {massDmgTargets.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
                      {massDmgTargets.map(id => {
                        const cb = combat.combatants.find(c => c.combatId === id);
                        return cb ? <span key={id} style={{ fontSize: 8, fontWeight: 700, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4, padding: '1px 5px', color: '#f87171' }}>{cb.name.split(' ')[0]}</span> : null;
                      })}
                      <button onClick={onClearMassDmgTargets} style={{ fontSize: 8, color: 'var(--text-muted)', padding: '1px 4px', background: 'transparent', border: 'none', cursor: 'pointer' }}>✕</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Custom Pins */}
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-faint)' }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={8} style={{ color: 'var(--gold-mid)' }} /> Pins do Grid
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <input type="text" placeholder="Rótulo do pin (opcional)..." value={pinLabel}
                  onChange={e => setPinLabel(e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '4px 7px', fontSize: 9, color: '#e8c878', outline: 'none', width: '100%' }} />
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {PIN_COLORS.map(c => (
                    <button key={c} onClick={() => setPinColor(c)} style={{ width: 14, height: 14, borderRadius: '50%', background: c, border: pinColor === c ? '2px solid white' : '2px solid transparent', cursor: 'pointer', flexShrink: 0 }} title={c} />
                  ))}
                </div>
                {placingPin ? (
                  <button onClick={onCancelPin} style={{ padding: '4px', borderRadius: 6, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                    <X size={8} /> Cancelar Posicionamento
                  </button>
                ) : (
                  <button onClick={() => onPlacePin(pinLabel, pinColor)} style={{ padding: '4px', borderRadius: 6, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', background: `${pinColor}22`, border: `1px solid ${pinColor}55`, color: pinColor, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                    <MapPin size={8} /> Colocar Pin no Grid
                  </button>
                )}
                {(combat.customPins ?? []).length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                    {(combat.customPins ?? []).map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '2px 6px', border: `1px solid ${p.color}33` }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 7, fontWeight: 700, color: p.color, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label || '—'}</span>
                        <span style={{ fontSize: 7, color: 'var(--text-faint)' }}>({p.gridPos.x},{p.gridPos.y})</span>
                        <button onClick={() => onRemovePin(p.id)} style={{ color: 'var(--text-faint)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 1, flexShrink: 0 }} className="hover:text-rose-500"><Trash2 size={8} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* ── UNIÕES ── */}
          <Section
            label="Uniões"
            icon={<Users size={10} />}
            isOpen={isOpen('unions')}
            onToggle={() => toggleSection('unions')}
            badge={combat.unions?.length}
          >
            <div style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Existing unions */}
              {(combat.unions ?? []).map(u => {
                const members = combat.combatants.filter(c => u.combatantIds.includes(c.combatId));
                return (
                  <div key={u.id} style={{ background: 'var(--bg-surface)', border: `1px solid ${u.color}44`, borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {members.map(m => (
                          <div key={m.combatId} style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${u.color}`, flexShrink: 0 }}>
                            <img src={m.icon || undefined} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                          </div>
                        ))}
                      </div>
                      <button onClick={() => onBreakUnion(u.id)} style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border-faint)', background: 'var(--bg-raised)', cursor: 'pointer' }} className="hover:text-rose-400">Desfazer</button>
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {members.map(m => m.name.split(' ')[0]).join(' + ')}
                    </div>
                  </div>
                );
              })}
              {/* Create union UI */}
              {unionMode ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px', background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 9 }}>
                  <p style={{ fontSize: 10, color: '#a855f7', fontWeight: 700 }}>Clique nos combatentes para selecioná-los ({unionSelecting.length} sel.)</p>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {['#a855f7', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#ec4899'].map(col => (
                      <button key={col} onClick={() => onSetUnionColor(col)} style={{ width: 16, height: 16, borderRadius: '50%', background: col, border: unionColor === col ? '2px solid white' : '2px solid transparent', cursor: 'pointer' }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button onClick={onCreateUnion} disabled={unionSelecting.length < 2} style={{
                      flex: 1, padding: '6px', borderRadius: 7, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      background: unionSelecting.length >= 2 ? `${unionColor}22` : 'rgba(0,0,0,0.3)',
                      border: `1px solid ${unionSelecting.length >= 2 ? unionColor + '55' : 'var(--border-faint)'}`,
                      color: unionSelecting.length >= 2 ? unionColor : 'var(--text-faint)',
                      cursor: unionSelecting.length >= 2 ? 'pointer' : 'not-allowed',
                    }}>✓ Criar</button>
                    <button onClick={() => onSetUnionMode(false)} style={{ padding: '6px 10px', borderRadius: 7, fontSize: 10, fontWeight: 700, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', cursor: 'pointer' }}>✕</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => onSetUnionMode(true)} style={{ padding: '8px', borderRadius: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)', color: '#a855f7', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Plus size={10} /> Nova União
                </button>
              )}
              {(combat.unions ?? []).length === 0 && !unionMode && (
                <p style={{ fontSize: 9, color: 'var(--text-faint)', textAlign: 'center', padding: '4px 0' }}>Nenhuma união ativa</p>
              )}
            </div>
          </Section>

          {/* ── FUSÃO ── */}
          <Section
            label="Fusão"
            icon={<Layers size={10} />}
            isOpen={isOpen('fusao')}
            onToggle={() => { toggleSection('fusao'); setFusionActive(false); }}
          >
            <div style={{ paddingTop: 8 }}>
              {fusionActive && currentActor ? (
                <CardFusionPanel
                  actor={currentActor}
                  allCards={fusionActorCards}
                  onStartFusion={(selectedCards) => {
                    onStartFusion(selectedCards);
                    setFusionActive(false);
                  }}
                  onCancel={() => setFusionActive(false)}
                />
              ) : (
                <>
                  {currentActor ? (
                    <button onClick={() => setFusionActive(true)} style={{
                      width: '100%', padding: '8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.1em',
                      background: 'linear-gradient(135deg,rgba(139,92,246,0.15),rgba(109,40,217,0.25))',
                      border: '1px solid rgba(196,181,253,0.3)', color: '#c4b5fd', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}>
                      <Layers size={10} /> Iniciar Fusão
                    </button>
                  ) : (
                    <p style={{ fontSize: 9, color: 'var(--text-faint)', textAlign: 'center', padding: '8px 0' }}>Nenhum ator ativo</p>
                  )}
                </>
              )}
            </div>
          </Section>

          {/* ── DADOS ── */}
          <Section
            label="Dados"
            icon={<Dices size={10} />}
            isOpen={isOpen('dados')}
            onToggle={() => toggleSection('dados')}
          >
            <div style={{ paddingTop: 8 }}>
              {combatQuickRoll && (
                <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(201,152,58,0.1)', border: '1px solid rgba(201,152,58,0.25)', borderRadius: 10, marginBottom: 8 }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 3 }}>d{combatQuickRoll.sides}</p>
                  <p style={{ fontSize: 36, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: combatQuickRoll.result === combatQuickRoll.sides ? '#f0c060' : combatQuickRoll.result === 1 ? '#f87171' : 'var(--text-primary)', lineHeight: 1 }}>
                    {combatQuickRoll.result}
                  </p>
                  {combatQuickRoll.result === combatQuickRoll.sides && <p style={{ fontSize: 8, color: 'var(--gold-mid)', fontWeight: 700, marginTop: 2 }}>⚡ CRÍTICO!</p>}
                  {combatQuickRoll.result === 1 && <p style={{ fontSize: 8, color: '#f87171', fontWeight: 700, marginTop: 2 }}>💀 FALHA CRÍTICA</p>}
                </div>
              )}
              <div className="mp-control-mini-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                {[4, 6, 8, 10, 12, 20].map(s => (
                  <button key={s} onClick={() => onQuickRoll(s)} style={{
                    padding: '8px 4px', borderRadius: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    background: 'var(--bg-surface)', border: '1px solid var(--border-mid)',
                    color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer',
                  }} className="hover:border-amber-700/60 hover:text-amber-300 hover:bg-amber-900/10 transition-all">
                    <Dices size={12} /> d{s}
                  </button>
                ))}
              </div>
              <button onClick={() => onQuickRoll(100)} style={{
                width: '100%', marginTop: 5, padding: '7px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                background: 'var(--bg-surface)', border: '1px solid var(--border-mid)',
                color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer',
              }} className="hover:border-amber-700/50 hover:text-amber-300 transition-all">
                <Dices size={11} /> d100
              </button>
            </div>
          </Section>

          {/* ── NOTAS ── */}
          <Section
            label="Notas"
            icon={<BookOpen size={10} />}
            isOpen={isOpen('notas')}
            onToggle={() => toggleSection('notas')}
          >
            <div style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <textarea
                className="combat-notes custom-scroll mp-control-note"
                style={{ minHeight: 180, resize: 'none', width: '100%' }}
                value={combatNotes}
                onChange={e => onNotesChange(e.target.value)}
                placeholder="Anotações de combate, estratégias, loot, etc..."
              />
              <p style={{ fontSize: 8, color: 'var(--text-faint)', textAlign: 'right' }}>{combatNotes.length} chars</p>
            </div>
          </Section>

        </>) : (
          /* ── CONTEXTUAL MODE ── */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-faint)', lineHeight: 2 }}>
              Modo Contextual
              <br />
              <span style={{ fontWeight: 400, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0, opacity: 0.6 }}>
                Disponível em etapas futuras
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CombatControlPanel;
