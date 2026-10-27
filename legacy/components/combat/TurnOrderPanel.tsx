import React from 'react';
import { CombatState, Card, Item } from '../../types';
import TurnOrderRow from './TurnOrderRow';
import { ActionCategory } from './ActionIconRail';
import { ConditionEffectStyles } from './ConditionEffects';

interface TurnOrderPanelProps {
  combat: CombatState;
  cards: Card[];
  // Etapa 2: action rail props
  items: Item[];
  selectedAction: { combatId: string; category: ActionCategory } | null;
  onSelectAction: (combatId: string, category: ActionCategory) => void;
  floating?: boolean;
}

const TurnOrderPanel: React.FC<TurnOrderPanelProps> = ({
  combat,
  cards,
  items,
  selectedAction,
  onSelectAction,
  floating = false,
}) => {
  const activeForms = combat.activeForms ?? [];

  return (
    <div
      className="hidden lg:flex flex-col"
      style={{
        width: floating ? 320 : 220,
        flexShrink: 0,
        height: '100%',
        background: floating ? 'transparent' : 'var(--bg-surface)',
        borderRight: floating ? undefined : '1px solid var(--border-faint)',
        borderRadius: floating ? 16 : undefined,
        overflow: floating ? 'visible' : 'hidden',
        boxShadow: undefined,
        backdropFilter: undefined,
      }}
    >
      <ConditionEffectStyles />
      {/* Header */}
      {floating ? (
        <div className="mp-battle-panel-header" style={{ flexShrink: 0 }}>
          <div className="mp-battle-round-ghost">{combat.isActive ? combat.round : '—'}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.38em', color: 'rgba(47,212,196,0.62)', textTransform: 'uppercase', marginBottom: 2 }}>
                Ordem de
              </div>
              <div className="mp-battle-panel-title">TURNO</div>
            </div>
            {combat.isActive && (
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                fontWeight: 900,
                color: 'var(--gold-bright)',
                background: 'rgba(0,0,0,0.52)',
                border: '1px solid rgba(47,212,196,0.42)',
                borderRadius: 3,
                padding: '2px 9px',
                position: 'relative',
                zIndex: 1,
              }}>
                Round {combat.round}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div style={{
          padding: '8px 10px 7px',
          borderBottom: '1px solid var(--border-faint)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          background: 'var(--bg-raised)',
        }}>
          <span className="mp-heading" style={{ fontSize: 9, color: 'var(--gold-mid)', letterSpacing: 0 }}>Turno</span>
          {combat.isActive && (
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              fontWeight: 900,
              color: 'var(--gold-bright)',
              background: 'rgba(122,94,26,0.27)',
              border: '1px solid rgba(122,94,26,0.53)',
              borderRadius: 5,
              padding: '1px 6px',
            }}>
              R{combat.round}
            </span>
          )}
        </div>
      )}

      {/* Combatant list */}
      <div
        className="flex-1 overflow-y-auto custom-scroll"
        style={{ padding: floating ? '10px 8px 12px' : '6px' }}
      >
        {combat.combatants.length === 0 ? (
          <div style={{
            padding: '24px 0',
            textAlign: 'center',
            color: 'var(--text-faint)',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
          }}>
            Nenhum combatente
          </div>
        ) : (
          combat.combatants.map((combatant, index) => {
            const isActive = combat.isActive && index === combat.turnIndex;
            const selectedCategory = isActive && selectedAction?.combatId === combatant.combatId
              ? selectedAction.category
              : null;
            return (
              <TurnOrderRow
                key={combatant.combatId}
                combatant={combatant}
                isActive={isActive}
                activeForms={activeForms}
                cards={cards}
                position={index + 1}
                items={items}
                selectedCategory={selectedCategory}
                onSelectAction={(category) => onSelectAction(combatant.combatId, category)}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

export default TurnOrderPanel;
