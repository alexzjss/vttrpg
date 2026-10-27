import React from 'react';
import { Swords, Zap, Link, Backpack, Sparkles, Hexagon } from 'lucide-react';
import { Combatant, ActiveForma, Card, Item, CardType } from '../../types';
import { resolveOwnedItems } from '../../utils/items';

export type ActionCategory = 'ataque' | 'acao' | 'vinculo' | 'item' | 'forma' | 'selo';

interface IconDef {
  category: ActionCategory;
  icon: React.ReactNode;
  label: string;
  available: boolean;
}

interface ActionIconRailProps {
  combatant: Combatant;
  activeForms: ActiveForma[];
  cards: Card[];
  items: Item[];
  selectedCategory: ActionCategory | null;
  onSelectAction: (category: ActionCategory) => void;
}

const AO_TYPES: CardType[] = ['ação', 'reação', 'reforço', 'combinação'];

const normalizeLabel = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const isVinculoValue = (value: unknown) => normalizeLabel(value) === 'vinculo';

const isVinculoCard = (card: Card) =>
  isVinculoValue(card.type) || isVinculoValue((card as any).command);

const ActionIconRail: React.FC<ActionIconRailProps> = ({
  combatant,
  activeForms,
  cards,
  items,
  selectedCategory,
  onSelectAction,
}) => {

  const isDefeated = combatant.currentHp <= 0;
  if (isDefeated) return null;

  const activeForma = activeForms.find(f => f.combatantId === combatant.combatId);
  const extraCardIds = activeForma?.extraCardIds ?? [];
  const allCardIds = [...combatant.cardIds, ...extraCardIds];
  const actorCards = allCardIds
    .map(id => cards.find(c => c.id === id))
    .filter((c): c is Card => c !== undefined);

  const hasAtaque  = actorCards.some(c => c.type === 'ataque');
  const hasAcao    = actorCards.some(c => AO_TYPES.includes(c.type));
  const hasVinculo = actorCards.some(isVinculoCard) || (combatant.bonds ?? []).some(bond => bond.trim().length > 0);
  const hasForma   = !activeForma && combatant.cardIds.some(id => cards.find(c => c.id === id)?.type === 'forma');
  const hasItem    = resolveOwnedItems(combatant, items).some(it => it.usableInCombat && it.quantity > 0);

  const iconDefs: IconDef[] = [
    { category: 'ataque',  icon: <Swords   size={12} />, label: 'Ataque',  available: hasAtaque  },
    { category: 'acao',    icon: <Zap      size={12} />, label: 'Ação',    available: hasAcao    },
    { category: 'vinculo', icon: <Link     size={12} />, label: 'Vínculo', available: hasVinculo },
    { category: 'item',    icon: <Backpack size={12} />, label: 'Item',    available: hasItem    },
    { category: 'selo',    icon: <Hexagon  size={12} />, label: 'Selo',    available: true       },
  ];

  if (hasForma) {
    iconDefs.splice(4, 0, {
      category: 'forma',
      icon: <Sparkles size={12} />,
      label: 'Forma',
      available: true,
    });
  }

  const isCompact = iconDefs.length >= 6;

  return (
    <div className={`mp-action-rail mp-action-rail--horizontal ${isCompact ? 'mp-action-rail--compact' : ''}`}>
      {iconDefs.map(({ category, icon, label, available }) => {
        const isSelected = selectedCategory === category;
        return (
          <button
            key={category}
            disabled={!available}
            title={label}
            aria-label={label}
            onClick={() => onSelectAction(category)}
            className={`mp-action-button ${isSelected ? 'mp-action-button--active' : ''} ${!available ? 'mp-action-button--disabled' : ''} ${isCompact ? 'mp-action-button--compact' : ''}`}
          >
            <span className="mp-action-button__brush" />
            {icon}
            <span className="mp-action-button__label">{label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ActionIconRail;
