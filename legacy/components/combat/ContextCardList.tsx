import React from 'react';
import { Pin, Zap, Crosshair, PackageOpen, Hexagon, Sparkles, Link, Swords } from 'lucide-react';
import { CombatState, Card, Item, CardType, Weapon, Seal } from '../../types';
import { resolveOwnedItems, resolveWeapons, ResolvedItem } from '../../utils/items';
import { CARD_TYPE_THEME, PALETTE } from '../../utils/theme';
import type { ActionCategory } from './ActionIconRail';

const CATEGORY_LABELS: Record<ActionCategory, string> = {
  ataque:  'ATAQUE',
  acao:    'ACAO',
  vinculo: 'VINCULO',
  item:    'ITEM',
  forma:   'FORMA',
  selo:    'SELO',
};

const CATEGORY_SUBTITLES: Record<ActionCategory, string> = {
  ataque:  'Tecnicas ofensivas',
  acao:    'Habilidades e respostas',
  vinculo: 'Elos e suporte',
  item:    'Suprimentos de combate',
  forma:   'Manifestacoes',
  selo:    'Codigos rituais',
};

const AO_TYPES: CardType[] = ['ação', 'reação', 'reforço', 'combinação'];

const normalizeLabel = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

const isVinculoValue = (value: unknown) => normalizeLabel(value) === 'vinculo';

const isVinculoCard = (card: Card) =>
  isVinculoValue(card.type) || isVinculoValue((card as any).command);

interface ContextCardListProps {
  selectedAction: { combatId: string; category: ActionCategory } | null;
  combat: CombatState;
  cards: Card[];
  items: Item[];
  weapons: Weapon[];
  seals: Seal[];
  onCardClick?: (card: Card) => void;
  onItemClick?: (item: ResolvedItem) => void;
  onWeaponClick?: (weapon: Weapon) => void;
  onSealClick?: (seal: Seal) => void;
  floating?: boolean;
}

type SkillEntry = {
  id: string;
  kind: 'card' | 'item' | 'weapon' | 'seal' | 'bond';
  name: string;
  description?: string;
  typeLabel: string;
  accent: string;
  sideLabel: string;
  metaLabel?: string;
  image?: string;
  imagePosition?: string;
  pinned?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  card?: Card;
  item?: ResolvedItem;
  weapon?: Weapon;
  seal?: Seal;
};

function canAffordCard(
  card: Card,
  aura: number,
  maxAmmo: number,
  currentAmmo: number,
): boolean {
  const ammoCost = card.ammoCost ?? 0;
  return (
    aura >= card.auraCost &&
    (ammoCost === 0 || maxAmmo === 0 || currentAmmo >= ammoCost)
  );
}

function getUnavailableReason(card: Card, aura: number, maxAmmo: number, currentAmmo: number): string | undefined {
  const ammoCost = card.ammoCost ?? 0;
  if (aura < card.auraCost) return 'AP insuficiente';
  if (ammoCost > 0 && maxAmmo > 0 && currentAmmo < ammoCost) return 'Municao insuficiente';
  return undefined;
}

function getCardCostLabel(card: Card): string {
  const parts: string[] = [];
  if (card.auraCost > 0) parts.push(`${card.auraCost} AP`);
  if ((card.ammoCost ?? 0) > 0) parts.push(`${card.ammoCost} AM`);
  return parts.length > 0 ? parts.join(' + ') : '0';
}

function getCardMetaLabel(card: Card): string | undefined {
  const parts: string[] = [];
  const diceRoll = (card as any).diceRoll;
  if (diceRoll) parts.push(diceRoll);
  if ((card.damage ?? 0) > 0) parts.push(`${card.damage} dmg`);
  if (card.isAreaEffect) parts.push('area');
  return parts.length ? parts.join(' / ') : undefined;
}

function filterCardForCategory(category: ActionCategory, card: Card): boolean {
  switch (category) {
    case 'ataque':  return card.type === 'ataque';
    case 'acao':    return AO_TYPES.includes(card.type);
    case 'vinculo': return isVinculoCard(card);
    case 'forma':   return card.type === 'forma';
    default:        return false;
  }
}

const SkillIcon: React.FC<{ entry: SkillEntry }> = ({ entry }) => {
  if (entry.kind === 'weapon') return <Swords size={17} />;
  if (entry.kind === 'seal') return <Hexagon size={17} />;
  if (entry.kind === 'item') return <PackageOpen size={17} />;
  if (entry.kind === 'bond' || (entry.card && isVinculoCard(entry.card))) return <Link size={17} />;
  if (entry.card?.type === 'forma') return <Sparkles size={17} />;
  if (entry.card?.type === 'combinação') return <Hexagon size={17} />;
  if ((entry.card?.ammoCost ?? 0) > 0) return <Crosshair size={17} />;
  return <Zap size={17} />;
};

const previewPill: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 20,
  padding: '4px 7px',
  border: '1px solid rgba(255,255,255,.13)',
  borderRadius: 999,
  background: 'rgba(5,7,10,.42)',
  backdropFilter: 'blur(8px)',
  color: '#f3f6fb',
  fontSize: 8,
  fontWeight: 900,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  textShadow: '0 1px 3px rgba(0,0,0,.85)',
};

const ContextCardList: React.FC<ContextCardListProps> = ({
  selectedAction,
  combat,
  cards,
  items,
  weapons,
  seals,
  onCardClick,
  onItemClick,
  onWeaponClick,
  onSealClick,
  floating = false,
}) => {
  const [highlightedEntryId, setHighlightedEntryId] = React.useState<string | null>(null);

  if (!selectedAction) return null;

  const combatant = combat.combatants.find(c => c.combatId === selectedAction.combatId);
  if (!combatant) return null;

  const { category } = selectedAction;
  const activeForma = (combat.activeForms ?? []).find(f => f.combatantId === combatant.combatId);
  const extraCardIds = activeForma?.extraCardIds ?? [];
  const allCardIds = [...combatant.cardIds, ...extraCardIds];
  const pinnedIds = combatant.pinnedCardIds ?? [];
  const { currentAura, maxAmmo = 0, currentAmmo = 0 } = combatant;

  let entries: SkillEntry[] = [];
  let emptyMessage = 'Nenhuma opcao disponivel';

  if (category === 'item') {
    const resolvedItems = resolveOwnedItems(combatant, items)
      .filter(it => it.usableInCombat && it.quantity > 0);

    const resolvedWeapons = resolveWeapons(combatant, weapons)
      .filter(w => w.usableInCombat);

    emptyMessage = 'Nenhum item ou arma de combate';

    const itemEntries: SkillEntry[] = resolvedItems.map(item => ({
      id: `item-${item.id}`,
      kind: 'item',
      name: item.name,
      description: item.description,
      typeLabel: 'IT',
      accent: 'var(--gold-mid)',
      sideLabel: `x${item.quantity}`,
      image: item.image,
      item,
    }));

    const weaponEntries: SkillEntry[] = resolvedWeapons.map(w => ({
      id: `weapon-${w.id}`,
      kind: 'weapon',
      name: w.name,
      description: w.description,
      typeLabel: 'AR',
      accent: '#f87171',
      sideLabel: (w.damage ?? 0) > 0 ? `${w.damage} dmg` : '—',
      image: w.image,
      weapon: w,
    }));

    entries = [...itemEntries, ...weaponEntries];
  } else if (category === 'selo') {
    const ownedSealIds = combatant.sealIds ?? [];
    const visibleSeals = ownedSealIds.length > 0
      ? seals.filter(s => ownedSealIds.includes(s.id))
      : seals;

    emptyMessage = 'Nenhum selo disponivel';
    entries = visibleSeals.map(s => ({
      id: `seal-${s.id}`,
      kind: 'seal',
      name: s.name,
      description: s.description,
      typeLabel: 'SE',
      accent: '#fb923c',
      sideLabel: (s.executionModes ?? (s.executionMode ? [s.executionMode] : ['immediate']))[0] ?? 'ritual',
      image: s.image,
      seal: s,
    }));
  } else {
    const seen = new Set<string>();
    let uniqueCards = allCardIds
      .map(id => cards.find(c => c.id === id))
      .filter((c): c is Card => c !== undefined && filterCardForCategory(category, c))
      .filter(card => {
        if (seen.has(card.id)) return false;
        seen.add(card.id);
        return true;
      });

    const bondNames = category === 'vinculo'
      ? (combatant.bonds ?? []).map(bond => bond.trim()).filter(Boolean)
      : [];

    if (category === 'vinculo' && bondNames.length > 0) {
      const bondCards = bondNames
        .map(bondName => cards.find(card =>
          isVinculoCard(card) && normalizeLabel(card.name) === normalizeLabel(bondName)
        ))
        .filter((card): card is Card => Boolean(card))
        .filter(card => {
          if (seen.has(card.id)) return false;
          seen.add(card.id);
          return true;
        });

      uniqueCards = [...uniqueCards, ...bondCards];
    }

    uniqueCards.sort((a, b) => {
      const aPin = pinnedIds.includes(a.id) ? 0 : 1;
      const bPin = pinnedIds.includes(b.id) ? 0 : 1;
      if (aPin !== bPin) return aPin - bPin;
      return a.name.localeCompare(b.name, 'pt-BR');
    });

    emptyMessage = 'Nenhuma carta disponivel';
    entries = uniqueCards.map(card => {
      const theme = CARD_TYPE_THEME[card.type];
      const affordable = canAffordCard(card, currentAura, maxAmmo, currentAmmo);
      return {
        id: `card-${card.id}`,
        kind: 'card',
        name: card.name,
        description: card.description,
        typeLabel: theme.label,
        accent: theme.topColor,
        sideLabel: getCardCostLabel(card),
        metaLabel: getCardMetaLabel(card),
        image: card.image,
        imagePosition: (card as any).iconPosition,
        pinned: pinnedIds.includes(card.id),
        disabled: !affordable,
        disabledReason: affordable ? undefined : getUnavailableReason(card, currentAura, maxAmmo, currentAmmo),
        card,
      };
    });

    if (category === 'vinculo' && bondNames.length > 0) {
      const representedBondNames = new Set(uniqueCards.map(card => normalizeLabel(card.name)));
      const bondOnlyEntries: SkillEntry[] = bondNames
        .filter(bondName => !representedBondNames.has(normalizeLabel(bondName)))
        .map((bondName, index) => ({
          id: `bond-${normalizeLabel(bondName) || 'vinculo'}-${index}`,
          kind: 'bond',
          name: bondName,
          description: 'Vinculo registrado na ficha. Nenhuma carta correspondente foi encontrada.',
          typeLabel: 'VIN',
          accent: PALETTE.teamCast,
          sideLabel: '--',
          metaLabel: 'Sem carta vinculada',
          disabled: true,
          disabledReason: 'Sem carta vinculada',
        }));

      entries = [...entries, ...bondOnlyEntries];
    }
  }

  const activeEntry =
    entries.find(entry => entry.id === highlightedEntryId) ??
    entries.find(entry => !entry.disabled) ??
    entries[0];

  const handleActivate = (entry: SkillEntry) => {
    if (entry.disabled) return;
    if (entry.kind === 'card' && entry.card && onCardClick) onCardClick(entry.card);
    if (entry.kind === 'item' && entry.item && onItemClick) onItemClick(entry.item);
    if (entry.kind === 'weapon' && entry.weapon && onWeaponClick) onWeaponClick(entry.weapon);
    if (entry.kind === 'seal' && entry.seal && onSealClick) onSealClick(entry.seal);
  };

  return (
    <div
      className={`hidden lg:flex flex-col mp-skill-panel ${floating ? 'mp-floating-panel' : ''}`}
      style={{
        width: floating ? 330 : 292,
        flexShrink: 0,
        height: '100%',
        background: floating ? 'linear-gradient(180deg, rgba(28,20,11,0.93), rgba(17,12,7,0.94))' : 'var(--bg-surface)',
        border: floating ? '1px solid rgba(47,212,196,0.30)' : undefined,
        borderRight: floating ? undefined : '1px solid var(--border-faint)',
        borderRadius: floating ? 16 : undefined,
        overflow: 'hidden',
        boxShadow: floating ? '0 22px 70px rgba(0,0,0,0.62)' : undefined,
        backdropFilter: floating ? 'blur(20px) saturate(1.28)' : undefined,
      }}
    >
      <div className="mp-skill-header">
        <div className="mp-battle-ghost mp-battle-ghost--skill" style={{ position: 'absolute', top: -4, right: -6, zIndex: 0 }}>
          {CATEGORY_LABELS[category].slice(0, 3)}
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="mp-skill-kicker">{CATEGORY_SUBTITLES[category]}</div>
          <h3 className="mp-skill-title">{CATEGORY_LABELS[category]}</h3>
        </div>
        <div className="mp-skill-actor" style={{ position: 'relative', zIndex: 1 }}>{combatant.name}</div>
      </div>

      {entries.length === 0 ? (
        <div className="mp-skill-empty">
          <Sparkles size={26} />
          <strong>{emptyMessage}</strong>
          <span>Escolha outra categoria na faixa de turno.</span>
        </div>
      ) : (
        <>
          <div className="mp-skill-list custom-scroll">
            {entries.map(entry => {
              const isActive = activeEntry?.id === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={`mp-skill-row ${isActive ? 'mp-skill-row--active' : ''} ${entry.disabled ? 'mp-skill-row--disabled' : ''}`}
                  style={{ ['--skill-color' as any]: entry.accent }}
                  disabled={entry.disabled}
                  onMouseEnter={() => setHighlightedEntryId(entry.id)}
                  onFocus={() => setHighlightedEntryId(entry.id)}
                  onClick={() => handleActivate(entry)}
                >
                  <span className="mp-skill-row__brush" />
                  <span className="mp-skill-row__icon"><SkillIcon entry={entry} /></span>
                  <span className="mp-skill-row__main">
                    <span className="mp-skill-row__name">
                      {entry.pinned && <Pin size={10} />}
                      {entry.name}
                    </span>
                    <span className="mp-skill-row__meta">
                      {entry.disabledReason ?? entry.metaLabel ?? entry.typeLabel}
                    </span>
                  </span>
                  <span className="mp-skill-cost">{entry.sideLabel}</span>
                </button>
              );
            })}
          </div>

          <div
            className="mp-skill-description"
            style={{
              ['--skill-color' as any]: activeEntry?.accent ?? 'var(--gold-mid)',
              position: 'relative',
              minHeight: 250,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              overflow: 'hidden',
              background: activeEntry?.image
                ? `linear-gradient(180deg,rgba(7,9,13,.04) 0%,rgba(7,9,13,.26) 42%,rgba(7,9,13,.82) 100%),url(${activeEntry.image}) ${activeEntry.imagePosition ?? '50% 50%'}/cover`
                : `radial-gradient(circle at 65% 22%,${activeEntry?.accent ?? '#d4a853'}38,transparent 44%),linear-gradient(145deg,#151922,#090b10)`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <span style={previewPill}>{activeEntry?.typeLabel}</span>
              <span style={previewPill}>{activeEntry?.sideLabel}</span>
            </div>
            <div className="mp-skill-description__top" style={{ background: 'rgba(5,7,10,.34)', backdropFilter: 'blur(8px)', borderRadius: 8, padding: '8px 9px' }}>
              <strong>{activeEntry?.name}</strong>
            </div>
            <p style={{ color: '#d7dee8', textShadow: '0 1px 3px rgba(0,0,0,.9)' }}>
              {activeEntry?.description ||
                (activeEntry?.disabledReason
                  ? activeEntry.disabledReason
                  : 'Sem descricao registrada.')}
            </p>
            {activeEntry?.metaLabel && <small style={{ ...previewPill, alignSelf: 'flex-start' }}>{activeEntry.metaLabel}</small>}
          </div>
        </>
      )}
    </div>
  );
};

export default ContextCardList;
