import React from 'react';
import { Combatant, ActiveForma, Card, Item } from '../../types';
import { PALETTE } from '../../utils/theme';
import ActionIconRail, { ActionCategory } from './ActionIconRail';
import { ConditionEffectOverlay, ConditionBadgeRow } from './ConditionEffects';
import { isDefenseActive, migrateCharacterDefense } from '../../utils/defense';

interface TurnOrderRowProps {
  combatant: Combatant;
  isActive: boolean;
  activeForms: ActiveForma[];
  cards: Card[];
  position: number;
  items: Item[];
  selectedCategory: ActionCategory | null;
  onSelectAction: (category: ActionCategory) => void;
}

const clampPct = (value: number) => Math.max(0, Math.min(100, value));

const getBannerVisual = (combatant: Combatant, displayIcon?: string) => {
  const maybeVisual = combatant as any;
  return (
    maybeVisual.bannerUrl ||
    maybeVisual.bannerImage ||
    maybeVisual.banner ||
    maybeVisual.backgroundImage ||
    displayIcon ||
    ''
  );
};

const StatSlice: React.FC<{
  label: string;
  value: number;
  max: number;
  pct: number;
  color: string;
  className?: string;
  note?: string;
  children?: React.ReactNode;
}> = ({ label, value, max, pct, color, className = '', note, children }) => (
  <div className={`mp-turn-stat ${className}`.trim()}>
    <div className="mp-turn-stat__meta">
      <span>{label}</span>
      <strong style={{ color }}>{value}</strong>
      <em>/{max}</em>
      {note && <b>{note}</b>}
    </div>
    <div className="mp-turn-stat__track">
      <div
        className="mp-turn-stat__fill"
        style={{ width: `${pct}%`, background: color, boxShadow: `0 0 10px ${color}88` }}
      />
    </div>
    {children}
  </div>
);

const StaggerFuse: React.FC<{
  value: number;
  max: number;
  pct: number;
  color: string;
  isStaggered: boolean;
}> = ({ value, max, pct, color, isStaggered }) => (
  <div className={`mp-turn-stat--stagger ${isStaggered ? 'is-staggered' : pct >= 80 ? 'is-danger' : ''}`}>
    <div className="mp-turn-stat__meta mp-turn-stat__meta--fuse">
      <span>STG</span>
      <strong style={{ color }}>{value}</strong>
      <em>/{max}</em>
      {isStaggered && <b>STUN</b>}
    </div>
    <div className="mp-turn-stagger-fuse" aria-hidden>
      <div className="mp-turn-stagger-fuse__wick" />
      <div
        className="mp-turn-stagger-fuse__burn"
        style={{ width: `${pct}%` }}
      />
      <div
        className="mp-turn-stagger-fuse__flame"
        style={{ left: `${Math.max(4, Math.min(96, pct))}%` }}
      />
    </div>
  </div>
);

const TurnOrderRow: React.FC<TurnOrderRowProps> = ({
  combatant,
  isActive,
  activeForms,
  cards,
  position,
  items,
  selectedCategory,
  onSelectAction,
}) => {
  const isDefeated = combatant.currentHp <= 0;
  const hpPct = combatant.maxHp > 0 ? clampPct((combatant.currentHp / combatant.maxHp) * 100) : 0;
  const apPct = combatant.maxAura > 0 ? clampPct((combatant.currentAura / combatant.maxAura) * 100) : 0;
  const defense = migrateCharacterDefense(combatant);
  const defensePct = defense.defenseMax > 0 ? clampPct((defense.defenseCurrent / defense.defenseMax) * 100) : 0;
  const staggerPct = defense.staggerMax > 0 ? clampPct((defense.staggerCurrent / defense.staggerMax) * 100) : 0;
  const ammoPct = combatant.maxAmmo > 0 ? clampPct((combatant.currentAmmo / combatant.maxAmmo) * 100) : 0;
  const hpColor = hpPct > 60 ? PALETTE.hpHigh : hpPct > 30 ? '#f97316' : PALETTE.hpLow;
  const auraColor = apPct > 60 ? '#67e8f9' : apPct > 30 ? '#3b82f6' : PALETTE.auraPurple;
  const defenseColor = defense.isDefenseBroken ? '#fb7185' : isDefenseActive(defense) ? '#93c5fd' : '#64748b';
  const staggerColor = defense.isStaggered || staggerPct >= 80 ? '#f43f5e' : '#f59e0b';
  const teamColor = PALETTE.teamCast;
  const showStagger = defense.isDefenseBroken || defense.isStaggered || defense.staggerCurrent > 0;

  const activeForma = activeForms.find(f => f.combatantId === combatant.combatId);
  const hasFormaCard = !activeForma && !isDefeated &&
    combatant.cardIds.some(id => cards.find(c => c.id === id)?.type === 'forma');
  const displayIcon = activeForma?.iconOverride || combatant.icon;
  const formaColor = activeForma?.color ?? null;
  const bannerVisual = getBannerVisual(combatant, displayIcon);

  return (
    <div
      className={`mp-turn-banner ${isActive ? 'mp-turn-banner--active' : ''} ${isDefeated ? 'mp-turn-banner--down' : ''}`}
      style={{
        ['--team-color' as any]: formaColor ?? teamColor,
        ['--hp-color' as any]: hpColor,
        ['--ap-color-local' as any]: auraColor,
      }}
    >
      {bannerVisual ? (
        <img className="mp-turn-banner__image" src={bannerVisual} alt="" />
      ) : (
        <div
          className="mp-turn-banner__image"
          style={{
            background: `linear-gradient(120deg, ${teamColor}55, rgba(8,10,16,0.95) 58%, ${teamColor}22)`,
          }}
        />
      )}

      <div className="mp-turn-banner__veil" />
      <ConditionEffectOverlay conditions={combatant.conditions} />
      {isActive && <div className="mp-turn-banner__active-stroke" />}
      {isDefeated && <div className="mp-turn-banner__slash" />}

      <div className="mp-turn-banner__position">
        <span>{position}</span>
      </div>

      <div className="mp-turn-banner__portrait">
        {displayIcon ? (
          <img src={displayIcon} alt="" />
        ) : (
          <div className="mp-turn-banner__portrait-empty">
            P
          </div>
        )}
        {hasFormaCard && <div className="mp-turn-banner__forma-dot" />}
      </div>

      <div className="mp-turn-banner__content">
        <div className="mp-turn-banner__topline">
          <div className="mp-turn-banner__name-block">
            <span className="mp-turn-banner__role">
              PERSONAGEM
            </span>
            <strong className="mp-turn-banner__name">{combatant.name}</strong>
          </div>
          <ConditionBadgeRow
            conditions={combatant.conditions}
            maxVisible={5}
            className="mp-turn-banner__conditions"
          />
        </div>

        <div className="mp-turn-banner__stats">
          <StatSlice label="HP" value={combatant.currentHp} max={combatant.maxHp} pct={hpPct} color={hpColor} />
          <StatSlice label="AP" value={combatant.currentAura} max={combatant.maxAura} pct={apPct} color={auraColor} className="mp-turn-stat--aura" />
          {combatant.maxAmmo > 0 && (
            <StatSlice label="AM" value={combatant.currentAmmo} max={combatant.maxAmmo} pct={ammoPct} color="#f5b93f" className="mp-turn-stat--ammo" />
          )}
          <StatSlice
            label="DEF"
            value={defense.defenseCurrent}
            max={defense.defenseMax}
            pct={defensePct}
            color={defenseColor}
            note={defense.isDefenseBroken ? 'BREAK' : `${Math.round(defense.defenseReduction * 100)}%`}
            className={`mp-turn-stat--defense ${defense.isDefenseBroken ? 'is-break' : isDefenseActive(defense) ? 'is-active' : 'is-recovering'}`}
          >
            {showStagger && (
              <StaggerFuse
                value={defense.staggerCurrent}
                max={defense.staggerMax}
                pct={staggerPct}
                color={staggerColor}
                isStaggered={defense.isStaggered}
              />
            )}
          </StatSlice>
        </div>

        {isDefeated && (
          <div className="mp-turn-banner__down-label">Derrotado</div>
        )}

        {isActive && (
          <div className="mp-turn-banner__actions">
            <ActionIconRail
              combatant={combatant}
              activeForms={activeForms}
              cards={cards}
              items={items}
              selectedCategory={selectedCategory}
              onSelectAction={onSelectAction}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default TurnOrderRow;
