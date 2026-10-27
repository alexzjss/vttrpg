import React from 'react';
import { X, Target, Swords, Layers, Flame, ChevronRight } from 'lucide-react';
import { Card, CombatState, Combatant, Character, Item } from '../../types';
import { DAMAGE_TYPES } from '../../utils/theme';
import { resolveOwnedItems } from '../../utils/items';
import ArsenalCardPreview from '../arsenal/ArsenalCardPreview';
import { arsenalCardAtLevel } from '../../utils/arsenal';
import { cardToArsenal } from '../../utils/arsenalMigration';

// Rótulos de bônus (espelha App.tsx)
const BONUS_TYPE_LABELS: Record<string, string> = {
  healHp: '💚 Cura HP',
  recoverAura: '⚡ Recuperar Aura',
  recoverAmmo: '🎯 Recuperar Munição',
  rollBonusGeneral: '🎲 Bônus Geral de Rolagem',
  rollBonusByType: '🃏 Bônus por Tipo de Carta',
  rollBonusByElement: '✨ Bônus por Elemento',
};

// Cor de identidade por tipo de carta (mantida para leitura de gameplay)
const TYPE_CONFIG: Record<string, { accent: string; label: string }> = {
  ataque:     { accent: '#ef4444', label: 'ATAQUE' },
  ação:       { accent: '#eab308', label: 'AÇÃO' },
  reação:     { accent: '#3b82f6', label: 'REAÇÃO' },
  reforço:    { accent: '#22c55e', label: 'REFORÇO' },
  vínculo:    { accent: '#94a3b8', label: 'VÍNCULO' },
  combinação: { accent: '#c084fc', label: 'COMBINAÇÃO' },
  forma:      { accent: '#f59e0b', label: 'FORMA' },
};

const ELEMENT_EMOJI: Record<string, string> = {
  fogo: '🔥', água: '💧', terra: '🪨', vento: '🍃', raio: '⚡',
  escuridão: '🌑', luminoso: '✨', sangue: '🩸', aura: '💠',
};

export type BoostKey = 'par' | 'trinca' | 'quadra' | 'reroll';

interface CardDetailOverlayProps {
  card: Card;
  level: number;
  combat: CombatState;
  currentActor: Combatant | null;
  characters: Character[];
  items: Item[];
  activeBoost: { charId: string; itemName: string } | null;
  onLevelChange: (lv: number) => void;
  onConfirmTarget: () => void;
  onSelfUse: () => void;
  onAreaUse: () => void;
  onBurn: () => void;
  onToggleBoost: (key: BoostKey) => void;
  onCancel: () => void;
}

// ── Selo de estatística estampado ──────────────────────────────
const StatSeal: React.FC<{
  label: string;
  value: React.ReactNode;
  tone: string;
  big?: boolean;
  sub?: React.ReactNode;
}> = ({ label, value, tone, big, sub }) => (
  <div
    className="mp-relic-seal"
    style={{ ['--seal-tone' as string]: tone }}
  >
    <span className="mp-relic-seal__label">{label}</span>
    <strong className="mp-relic-seal__value" style={{ fontSize: big ? 26 : 19 }}>{value}</strong>
    {sub && <span className="mp-relic-seal__sub">{sub}</span>}
  </div>
);

const CardDetailOverlay: React.FC<CardDetailOverlayProps> = ({
  card, level, combat, currentActor, characters, items, activeBoost,
  onLevelChange, onConfirmTarget, onSelfUse, onAreaUse, onBurn, onToggleBoost, onCancel,
}) => {
  const cfg = TYPE_CONFIG[card.type] ?? TYPE_CONFIG['ação'];
  const element = (card as any).element as string | undefined;
  const elEmoji = element ? ELEMENT_EMOJI[element] : null;
  const accent = cfg.accent;

  const levelData = level > 1 && card.levels ? card.levels[level - 2] : undefined;
  const shownDamage = levelData?.damage ?? card.damage ?? 0;
  const shownAura = levelData?.auraCost ?? card.auraCost;
  const shownDice = levelData?.diceRoll ?? card.diceRoll;
  const shownDesc = (level > 1 && levelData?.description) ? levelData.description : card.description;
  const previewCard = React.useMemo(() => arsenalCardAtLevel(cardToArsenal(card), level), [card, level]);

  const damageType = (card as any).damageType as string | undefined;
  const dtInfo = damageType && damageType !== 'fisico'
    ? DAMAGE_TYPES.find(d => d.value === damageType)
    : null;

  const isCombo = card.type === 'combinação';
  const isForma = card.type === 'forma';

  // Boosts de item disponíveis para o ator atual
  const boostDefs: { key: BoostKey; name: string; glyph: string }[] = [
    { key: 'par', name: 'Par', glyph: '✌' },
    { key: 'trinca', name: 'Trinca', glyph: '🔱' },
    { key: 'quadra', name: 'Quadra', glyph: '♦' },
    { key: 'reroll', name: 'Reroll', glyph: '🎲' },
  ];
  const actorChar = currentActor ? characters.find(c => c.id === currentActor.id) : null;
  const actorResolved = actorChar ? resolveOwnedItems(actorChar, items) : [];
  const availableBoosts = boostDefs
    .map(def => {
      const it = actorResolved.find(r => r.name === def.name && r.category === 'Upgrade' && (r.quantity ?? 0) > 0);
      return it ? { ...def, quantity: it.quantity } : null;
    })
    .filter((b): b is { key: BoostKey; name: string; glyph: string; quantity: number } => !!b);
  const activeBoostKey = activeBoost?.charId === currentActor?.id ? (activeBoost?.itemName as BoostKey) : null;

  const formaActive = isForma && combat.activeForms?.find(
    f => f.cardId === card.id && f.combatantId === currentActor?.combatId,
  );

  const primaryLabel = isCombo ? '🔗 Convocar'
    : isForma ? '✦ Ativar Forma'
    : card.isAreaEffect ? 'Selecionar Alvos'
    : 'Usar no Alvo';

  const levelOptions = card.levels && card.levels.length > 0
    ? [1, ...card.levels.map((_, i) => i + 2)]
    : [];

  return (
    <>
      <style>{RELIC_CSS}</style>

      {/* Backdrop ardente */}
      <div className="mp-relic-backdrop" onClick={onCancel} />

      {/* Botão cancelar fixo */}
      <button className="mp-relic-cancel" onClick={(e) => { e.stopPropagation(); onCancel(); }}>
        <X style={{ width: 13, height: 13 }} /> Cancelar
      </button>

      <div className="mp-relic-stage" style={{ ['--relic-accent' as string]: accent }}>
        {/* Ondas ardentes */}
        <div className="mp-relic-waves" aria-hidden>
          {[0, 1, 2].map(i => <span key={i} style={{ ['--w' as string]: i }} />)}
        </div>
        <div className="mp-relic-forge" aria-hidden />

        <div className="mp-relic-row">
          {/* ── ESQUERDA: Grimório de estatísticas ── */}
          <div className="mp-relic-grimoire">
            <div className="mp-relic-badges">
              <span className="mp-relic-type" style={{ ['--relic-accent' as string]: accent }}>{cfg.label}</span>
              {elEmoji && <span className="mp-relic-el">{elEmoji}</span>}
              {card.isAreaEffect && <span className="mp-relic-area">💥 Área</span>}
            </div>

            <div className="mp-relic-seals">
              <StatSeal label="Custo Aura" value={<>⚡ {shownAura}</>} tone="#a855f7" big />
              {shownDice && <StatSeal label="Rolagem" value={shownDice} tone="#f0c060" />}
              {shownDamage > 0 && (
                <StatSeal label="Dano" value={<>⚔ {shownDamage}</>} tone="#ef4444" big
                  sub={dtInfo ? <span style={{ color: dtInfo.color }}>{dtInfo.emoji} {dtInfo.label}</span> : undefined} />
              )}
              {(card.dc ?? 0) > 0 && <StatSeal label="CD" value={card.dc} tone="#f59e0b" />}
            </div>

            {/* Condição */}
            {card.conditionEffect && (
              <div className="mp-relic-note" style={{ ['--note-tone' as string]: '#f59e0b' }}>
                <span className="mp-relic-note__title">Condição</span>
                <div className="mp-relic-note__body">
                  ✦ {card.conditionEffect}
                  <em> ({card.conditionDuration ?? 3} rod.)</em>
                </div>
                {card.conditionEffects?.[card.conditionEffect] && (
                  <div className="mp-relic-note__list">
                    {card.conditionEffects[card.conditionEffect].map((eff, i) => {
                      const meta: Record<string, { emoji: string; color: string }> = {
                        damage: { emoji: '🩸', color: '#f87171' }, heal: { emoji: '💚', color: '#4ade80' },
                        drainAura: { emoji: '🔥', color: '#fbbf24' }, recoverAura: { emoji: '⚡', color: '#a78bfa' },
                        drainAmmo: { emoji: '🎯', color: '#f97316' }, recoverAmmo: { emoji: '🔄', color: '#67e8f9' },
                        dicePenalty: { emoji: '📉', color: '#fb923c' }, diceBonus: { emoji: '📈', color: '#86efac' },
                      };
                      const m = meta[eff.type] ?? { emoji: '?', color: '#94a3b8' };
                      return (
                        <div key={i} className="mp-relic-note__row">
                          <span>{m.emoji}</span>
                          <span style={{ color: m.color }}>
                            {eff.diceRoll ? `${eff.diceRoll}${eff.value ? ` +${eff.value}` : ''}` : eff.value} por rodada
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Combo */}
            {isCombo && (
              <div className="mp-relic-note" style={{ ['--note-tone' as string]: '#c084fc' }}>
                <span className="mp-relic-note__title">Combinação</span>
                <div className="mp-relic-note__body">
                  {card.comboFixedUsers
                    ? `${card.comboMinUsers ?? 2} jogadores exatos`
                    : `${card.comboMinUsers ?? 2}${card.comboMaxUsers ? '–' + card.comboMaxUsers : '+'} jogadores`}
                  <em> · {(card.comboDiceMode ?? 'sum') === 'sum' ? '➕ soma os dados' : '🏆 maior dado'}</em>
                </div>
              </div>
            )}

            {/* Forma */}
            {isForma && (
              <div className="mp-relic-note" style={{ ['--note-tone' as string]: (card.formaColor || '#f59e0b') }}>
                <span className="mp-relic-note__title">✦ Forma</span>
                <div className="mp-relic-note__body" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {card.formaIcon && <img src={card.formaIcon} alt="" style={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${(card.formaColor || '#f59e0b')}66` }} />}
                  {card.formaCardIds?.length ? `${card.formaCardIds.length} cartas desbloqueadas` : 'Sem cartas extras'}
                </div>
                {formaActive && <div className="mp-relic-note__active">● FORMA ATIVA — clique para desativar</div>}
              </div>
            )}

            {/* Bônus */}
            {card.bonuses && card.bonuses.length > 0 && (
              <div className="mp-relic-note" style={{ ['--note-tone' as string]: '#22c55e' }}>
                <span className="mp-relic-note__title">🎁 Bônus ao Ativar</span>
                <div className="mp-relic-note__body">
                  {card.bonuses.map((b, i) => (
                    <div key={i} style={{ color: '#86efac', fontWeight: 700, marginBottom: 2 }}>
                      {b.label || `${BONUS_TYPE_LABELS[b.type] || b.type}: +${b.value}`}{b.duration ? ` (${b.duration}r)` : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── CENTRO: A Relíquia ── */}
          <div className="mp-relic-card-wrap">
            <ArsenalCardPreview card={previewCard} className="mp-relic-arsenal-preview" />
            <div className="mp-relic-card" style={{ ['--relic-accent' as string]: accent }}>
              <span className="mp-relic-card__shimmer" aria-hidden />
              <div className="mp-relic-card__head">
                <span className="mp-relic-card__type">{cfg.label}</span>
                {elEmoji && <span>{elEmoji}</span>}
                <span className="mp-relic-card__aura">⚡{shownAura}</span>
              </div>
              <div className="mp-relic-card__media">
                {card.image
                  ? <img src={card.image} alt="" />
                  : <div className="mp-relic-card__media-empty" />}
                <span className="mp-relic-card__media-fade" aria-hidden />
              </div>
              <div className="mp-relic-card__name">{card.name}</div>
            </div>
          </div>

          {/* ── DIREITA: Pergaminho + ações rituais ── */}
          <div className="mp-relic-actions">
            {shownDesc && (
              <div className="mp-relic-scroll">
                <span className="mp-relic-scroll__title">Descrição</span>
                <p>{shownDesc}</p>
              </div>
            )}

            {levelOptions.length > 0 && (
              <div className="mp-relic-levels">
                <span className="mp-relic-levels__title">Nível</span>
                <div className="mp-relic-levels__row">
                  {levelOptions.map(lv => (
                    <button
                      key={lv}
                      className={`mp-relic-lv ${level === lv ? 'mp-relic-lv--on' : ''}`}
                      onClick={(e) => { e.stopPropagation(); onLevelChange(lv); }}
                    >Nv {lv}</button>
                  ))}
                </div>
              </div>
            )}

            <button
              className="mp-relic-btn mp-relic-btn--primary"
              style={{ ['--relic-accent' as string]: accent }}
              onClick={(e) => { e.stopPropagation(); onConfirmTarget(); }}
            >
              <Target style={{ width: 14, height: 14 }} /> {primaryLabel}
            </button>

            {!isCombo && !isForma && (
              <>
                <button className="mp-relic-btn mp-relic-btn--ghost" onClick={(e) => { e.stopPropagation(); onSelfUse(); }}>
                  <Swords style={{ width: 13, height: 13 }} /> Auto-Alvo
                </button>
                <button className="mp-relic-btn mp-relic-btn--gold" onClick={(e) => { e.stopPropagation(); onAreaUse(); }}>
                  <Layers style={{ width: 13, height: 13 }} /> Área Total
                </button>
              </>
            )}

            <div className="mp-relic-divider">◆ escolha o destino ◆</div>

            {availableBoosts.length > 0 && (
              <div className="mp-relic-boosts">
                <span className="mp-relic-boosts__title">🎴 Usar Item</span>
                <div className="mp-relic-boosts__row">
                  {availableBoosts.map(b => (
                    <button
                      key={b.key}
                      className={`mp-relic-boost ${activeBoostKey === b.key ? 'mp-relic-boost--on' : ''}`}
                      onClick={(e) => { e.stopPropagation(); onToggleBoost(b.key); }}
                    >
                      {b.glyph} {b.name} ×{b.quantity}
                    </button>
                  ))}
                </div>
                {activeBoostKey && (
                  <p className="mp-relic-boosts__hint">
                    {activeBoostKey === 'par' ? '✌ Rola 2 dados, usa o melhor'
                      : activeBoostKey === 'trinca' ? '🔱 Rola 3 dados, usa o melhor'
                      : activeBoostKey === 'quadra' ? '♦ Rola 4 dados, usa o melhor'
                      : '🎲 Em falha, relança o dado'} — consumido ao usar
                  </p>
                )}
              </div>
            )}

            {!isForma && (
              <button className="mp-relic-btn mp-relic-btn--burn" onClick={(e) => { e.stopPropagation(); onBurn(); }}>
                <Flame style={{ width: 13, height: 13 }} /> 🔥 Queimar Carta
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

const RELIC_CSS = `
  .mp-relic-backdrop {
    position: fixed; inset: 0; z-index: 9048;
    background:
      radial-gradient(ellipse 70% 60% at 50% 42%, rgba(120,45,15,0.5), transparent 62%),
      rgba(8,5,3,0.78);
    backdrop-filter: blur(5px);
    animation: mp-relic-fade 220ms ease-out both;
  }
  @keyframes mp-relic-fade { from { opacity: 0; } to { opacity: 1; } }

  .mp-relic-cancel {
    position: fixed; top: 18px; right: 18px; z-index: 9999;
    display: flex; align-items: center; gap: 8px;
    padding: 10px 18px;
    background: linear-gradient(180deg, rgba(40,10,8,0.95), rgba(24,6,5,0.95));
    border: 1.5px solid rgba(220,70,40,0.7);
    color: #fca5a5; font-size: 11px; font-weight: 900;
    text-transform: uppercase; letter-spacing: 0.3em;
    cursor: pointer; clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
    box-shadow: 0 0 24px rgba(220,38,38,0.3);
    animation: mp-relic-cancel-in 0.3s 0.1s both;
  }
  .mp-relic-cancel:hover { color: #fff; border-color: rgba(248,113,113,0.9); }
  @keyframes mp-relic-cancel-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }

  .mp-relic-stage {
    position: fixed; inset: 0; z-index: 9050;
    display: flex; align-items: center; justify-content: center;
    pointer-events: none;
  }
  .mp-relic-waves { position: absolute; inset: 0; display: grid; place-items: center; }
  .mp-relic-waves span {
    position: absolute; width: calc(300px + var(--w) * 70px); height: calc(300px + var(--w) * 70px);
    border-radius: 50%;
    border: 1.5px solid color-mix(in srgb, var(--relic-accent) 40%, rgba(249,115,22,0.4));
    animation: mp-relic-wave 2.6s ease-out infinite;
    animation-delay: calc(var(--w) * 0.5s);
    opacity: 0;
  }
  @keyframes mp-relic-wave {
    0% { transform: scale(0.4); opacity: 0.5; }
    100% { transform: scale(2.4); opacity: 0; }
  }
  .mp-relic-forge {
    position: absolute; width: 760px; height: 460px; border-radius: 50%;
    background: radial-gradient(ellipse, rgba(249,115,22,0.28) 0%, rgba(194,65,12,0.1) 40%, transparent 66%);
    filter: blur(50px); animation: mp-relic-breathe 2.4s ease-in-out infinite;
  }
  @keyframes mp-relic-breathe { 0%,100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 0.95; transform: scale(1.08); } }

  .mp-relic-row {
    position: relative; z-index: 2;
    display: flex; align-items: center; gap: 20px;
    max-width: min(96vw, 860px);
    animation: mp-relic-pull 0.6s cubic-bezier(0.22,1,0.36,1) both;
  }
  @keyframes mp-relic-pull {
    0% { opacity: 0; transform: translateY(90px) scale(0.5) rotate(-10deg); filter: blur(14px); }
    55% { opacity: 1; transform: translateY(-8px) scale(1.04) rotate(1.5deg); filter: blur(0); }
    100% { transform: translateY(0) scale(1) rotate(0); }
  }

  /* Grimório / ações: painéis warm */
  .mp-relic-grimoire, .mp-relic-actions {
    width: 184px; flex-shrink: 0; pointer-events: auto;
    display: flex; flex-direction: column; gap: 9px;
  }
  .mp-relic-grimoire { display: none; }
  .mp-relic-actions .mp-relic-scroll { display: none; }
  .mp-relic-grimoire { animation: mp-relic-side-in 0.5s 0.15s both; }
  .mp-relic-actions { animation: mp-relic-side-in 0.5s 0.3s both; }
  @keyframes mp-relic-side-in { from { opacity: 0; transform: translateY(14px) scale(0.92); } to { opacity: 1; transform: none; } }

  .mp-relic-badges { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
  .mp-relic-type {
    font-size: 10px; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--relic-accent); padding: 4px 10px;
    background: color-mix(in srgb, var(--relic-accent) 16%, transparent);
    border: 1.5px solid color-mix(in srgb, var(--relic-accent) 60%, transparent);
    clip-path: polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%);
  }
  .mp-relic-el { font-size: 15px; }
  .mp-relic-area {
    font-size: 9px; font-weight: 800; color: #fdba74;
    background: rgba(234,88,12,0.2); border: 1px solid rgba(234,88,12,0.5);
    padding: 3px 8px; text-transform: uppercase; letter-spacing: 0.06em;
    clip-path: polygon(5px 0, 100% 0, calc(100% - 5px) 100%, 0 100%);
  }

  .mp-relic-seals { display: flex; flex-direction: column; gap: 7px; }
  .mp-relic-seal {
    position: relative; padding: 8px 12px;
    background: linear-gradient(135deg, color-mix(in srgb, var(--seal-tone) 14%, rgba(20,13,7,0.92)), rgba(14,9,5,0.92));
    border: 1px solid color-mix(in srgb, var(--seal-tone) 40%, transparent);
    border-left: 3px solid var(--seal-tone);
    clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
    box-shadow: inset 0 0 18px rgba(0,0,0,0.4);
  }
  .mp-relic-seal__label {
    display: block; font-family: 'Cinzel', serif;
    font-size: 8px; font-weight: 700; letter-spacing: 0.24em; text-transform: uppercase;
    color: color-mix(in srgb, var(--seal-tone) 70%, #fff 10%); margin-bottom: 2px;
  }
  .mp-relic-seal__value {
    font-family: 'JetBrains Mono', monospace; font-weight: 900; line-height: 1;
    color: #fff; text-shadow: 0 0 14px var(--seal-tone);
  }
  .mp-relic-seal__sub { display: block; font-size: 9px; font-weight: 700; margin-top: 3px; }

  .mp-relic-note {
    padding: 8px 11px;
    background: linear-gradient(135deg, color-mix(in srgb, var(--note-tone) 10%, rgba(20,13,7,0.9)), rgba(14,9,5,0.9));
    border: 1px solid color-mix(in srgb, var(--note-tone) 32%, transparent);
    clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
  }
  .mp-relic-note__title {
    display: block; font-family: 'Cinzel', serif; font-size: 8px; font-weight: 700;
    letter-spacing: 0.22em; text-transform: uppercase;
    color: color-mix(in srgb, var(--note-tone) 75%, #fff 8%); margin-bottom: 4px;
  }
  .mp-relic-note__body { font-size: 10px; font-weight: 700; color: #f3ecdd; line-height: 1.4; }
  .mp-relic-note__body em { font-style: normal; opacity: 0.7; font-weight: 600; }
  .mp-relic-note__list { margin-top: 5px; display: flex; flex-direction: column; gap: 3px; }
  .mp-relic-note__row { display: flex; align-items: center; gap: 5px; font-size: 9px; font-weight: 700; }
  .mp-relic-note__active { font-size: 8px; font-weight: 800; color: #4ade80; margin-top: 4px; }

  /* A relíquia (carta) */
  .mp-relic-card-wrap {
    flex-shrink: 0; pointer-events: auto; position: relative; z-index: 2;
    animation: mp-relic-float 3.6s 0.7s ease-in-out infinite;
    width: min(390px, 48vw);
    max-height: min(78vh, 720px);
    overflow-y: auto;
    padding: 2px;
  }
  .mp-relic-card-wrap > .mp-relic-card { display: none; }
  .mp-relic-arsenal-preview {
    min-height: min(72vh, 620px) !important;
  }
  @keyframes mp-relic-float {
    0%,100% { transform: translateY(0) rotate(0); }
    33% { transform: translateY(-8px) rotate(0.6deg); }
    66% { transform: translateY(-3px) rotate(-0.4deg); }
  }
  .mp-relic-card {
    position: relative; width: 262px;
    display: flex; flex-direction: column; overflow: hidden;
    background: linear-gradient(168deg, rgba(34,22,12,0.98), rgba(18,11,6,0.98));
    border: 2.5px solid var(--relic-accent);
    border-radius: 4px;
    clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px));
    box-shadow:
      0 0 56px color-mix(in srgb, var(--relic-accent) 55%, transparent),
      0 0 0 1px rgba(255,221,150,0.18),
      0 40px 80px rgba(0,0,0,0.96),
      inset 0 0 60px rgba(124,45,18,0.2);
  }
  .mp-relic-card__shimmer {
    position: absolute; top: 0; left: 0; right: 0; height: 3px; z-index: 4;
    background: linear-gradient(90deg, transparent, var(--relic-accent), #ffe7aa, var(--relic-accent), transparent);
    background-size: 200% 100%;
    animation: mp-relic-shimmer 2.2s linear infinite;
  }
  @keyframes mp-relic-shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
  .mp-relic-card__head {
    display: flex; align-items: center; gap: 6px;
    padding: 10px 14px 8px;
    background: color-mix(in srgb, var(--relic-accent) 16%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--relic-accent) 40%, transparent);
  }
  .mp-relic-card__type {
    font-family: 'Cinzel', serif; font-size: 9px; font-weight: 700; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--relic-accent);
    padding: 2px 8px; border: 1px solid color-mix(in srgb, var(--relic-accent) 50%, transparent);
    background: color-mix(in srgb, var(--relic-accent) 14%, transparent);
  }
  .mp-relic-card__aura {
    margin-left: auto; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 900;
    color: #d8b4fe; background: rgba(0,0,0,0.5); padding: 2px 8px;
    border: 1px solid rgba(168,85,247,0.3);
  }
  .mp-relic-card__media { position: relative; height: 188px; overflow: hidden; }
  .mp-relic-card__media img { width: 100%; height: 100%; object-fit: cover; filter: saturate(1.1) contrast(1.04); }
  .mp-relic-card__media-empty {
    width: 100%; height: 100%;
    background: radial-gradient(ellipse at 50% 38%, color-mix(in srgb, var(--relic-accent) 26%, transparent), rgba(8,5,3,0.9));
  }
  .mp-relic-card__media-fade {
    position: absolute; inset: 0;
    background: linear-gradient(0deg, rgba(14,9,5,0.92), transparent 52%);
  }
  .mp-relic-card__name {
    padding: 13px 14px 16px; text-align: center;
    font-family: 'Playfair Display', serif; font-size: 19px; font-weight: 900; font-style: italic;
    text-transform: uppercase; color: #fff7e2; letter-spacing: 0.02em; line-height: 1.05;
    text-shadow: 0 0 22px color-mix(in srgb, var(--relic-accent) 80%, transparent), 0 2px 8px rgba(0,0,0,0.9);
  }

  /* Pergaminho de descrição */
  .mp-relic-scroll {
    position: relative; padding: 10px 13px;
    color: rgba(34,26,15,0.9);
    background: linear-gradient(100deg, rgba(244,233,206,0.97), rgba(228,212,178,0.93));
    border-left: 4px solid var(--relic-accent, #c9983a);
    clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
    max-height: 130px; overflow: hidden;
  }
  .mp-relic-scroll__title {
    display: block; font-family: 'Cinzel', serif; font-size: 8px; font-weight: 700;
    letter-spacing: 0.24em; text-transform: uppercase; color: rgba(124,45,18,0.7); margin-bottom: 4px;
  }
  .mp-relic-scroll p { margin: 0; font-size: 11px; line-height: 1.5; font-style: italic; color: rgba(34,26,15,0.85); }

  .mp-relic-levels {
    padding: 8px 11px; background: rgba(201,152,58,0.08);
    border: 1px solid rgba(201,152,58,0.28);
    clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
  }
  .mp-relic-levels__title {
    display: block; font-family: 'Cinzel', serif; font-size: 8px; font-weight: 700;
    letter-spacing: 0.22em; text-transform: uppercase; color: rgba(240,192,96,0.7); margin-bottom: 6px;
  }
  .mp-relic-levels__row { display: flex; gap: 5px; flex-wrap: wrap; }
  .mp-relic-lv {
    padding: 4px 10px; font-size: 10px; font-weight: 900; cursor: pointer;
    background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); color: #94785a;
    clip-path: polygon(5px 0, 100% 0, calc(100% - 5px) 100%, 0 100%); transition: all 0.16s;
  }
  .mp-relic-lv--on {
    background: linear-gradient(135deg, rgba(240,192,96,0.42), rgba(194,65,12,0.3));
    border-color: rgba(240,192,96,0.8); color: #fff3df;
    box-shadow: 0 0 12px rgba(240,192,96,0.4);
  }

  /* Botões rituais */
  .mp-relic-btn {
    position: relative; width: 100%; padding: 11px 14px;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.12em;
    cursor: pointer; overflow: hidden;
    clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
    transition: transform 0.14s ease, filter 0.14s ease, box-shadow 0.14s ease;
  }
  .mp-relic-btn:hover { transform: translateY(-1px); filter: brightness(1.1); }
  .mp-relic-btn--primary {
    color: #1a0f06; border: 1.5px solid color-mix(in srgb, var(--relic-accent) 70%, #ffcd82);
    background: linear-gradient(135deg, #c2410c 0%, #f59e0b 36%, #ffe0a3 52%, var(--relic-accent) 100%);
    box-shadow: 0 0 22px color-mix(in srgb, var(--relic-accent) 55%, transparent), inset 0 1px 0 rgba(255,255,255,0.4);
    text-shadow: 0 1px 0 rgba(255,231,170,0.4);
  }
  .mp-relic-btn--ghost {
    color: #e8c878; background: rgba(28,18,9,0.92); border: 1.5px solid rgba(201,152,58,0.5);
    box-shadow: 0 0 12px rgba(201,152,58,0.16);
  }
  .mp-relic-btn--ghost:hover { color: #fdf0cc; border-color: rgba(240,192,96,0.8); }
  .mp-relic-btn--gold {
    color: #fdf0cc; border: 1.5px solid rgba(240,192,96,0.6);
    background: linear-gradient(135deg, rgba(170,120,30,0.4), rgba(110,70,12,0.5));
    box-shadow: 0 0 18px rgba(201,152,58,0.24);
  }
  .mp-relic-btn--burn {
    color: #fca5a5; border: 1.5px solid rgba(220,60,38,0.7); margin-top: 2px;
    background: linear-gradient(135deg, rgba(194,40,20,0.34), rgba(110,12,8,0.5));
    box-shadow: 0 0 18px rgba(220,38,38,0.3);
  }
  .mp-relic-btn--burn:hover { color: #fff; border-color: rgba(248,113,113,0.9); }

  .mp-relic-divider {
    text-align: center; font-family: 'Cinzel', serif; font-size: 8px; font-weight: 700;
    letter-spacing: 0.38em; text-transform: uppercase;
    color: color-mix(in srgb, var(--relic-accent, #c9983a) 60%, transparent); margin: 2px 0;
  }

  .mp-relic-boosts {
    padding: 9px 11px; background: rgba(251,191,36,0.06); border: 1px solid rgba(251,191,36,0.25);
    clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
  }
  .mp-relic-boosts__title {
    display: block; font-family: 'Cinzel', serif; font-size: 8px; font-weight: 700;
    letter-spacing: 0.2em; text-transform: uppercase; color: rgba(251,191,36,0.6); margin-bottom: 6px;
  }
  .mp-relic-boosts__row { display: flex; gap: 5px; flex-wrap: wrap; }
  .mp-relic-boost {
    padding: 4px 10px; font-size: 9px; font-weight: 700; cursor: pointer;
    background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.12); color: #b8a07a;
    clip-path: polygon(5px 0, 100% 0, calc(100% - 5px) 100%, 0 100%); transition: all 0.15s;
  }
  .mp-relic-boost--on {
    background: rgba(251,191,36,0.35); border-color: rgba(251,191,36,0.8); color: #fcd34d;
  }
  .mp-relic-boosts__hint { margin: 5px 0 0; font-size: 8px; color: rgba(251,191,36,0.7); line-height: 1.4; }

  @media (max-width: 820px) {
    .mp-relic-grimoire, .mp-relic-actions { width: 150px; }
    .mp-relic-card { width: 210px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .mp-relic-row, .mp-relic-card-wrap, .mp-relic-forge, .mp-relic-waves span,
    .mp-relic-grimoire, .mp-relic-actions, .mp-relic-card__shimmer {
      animation-duration: 1ms !important; animation-iteration-count: 1 !important;
    }
  }
  [data-reduced-motion='true'] .mp-relic-card-wrap,
  [data-reduced-motion='true'] .mp-relic-forge,
  [data-reduced-motion='true'] .mp-relic-waves span,
  [data-reduced-motion='true'] .mp-relic-card__shimmer {
    animation: none !important;
  }
`;

export default CardDetailOverlay;
