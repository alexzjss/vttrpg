import React from 'react';
import type { Card, Seal, Weapon } from '../../types';
import type { ResolvedItem } from '../../utils/items';

const shell: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0,
  background: '#101013', border: '1px solid #1e1e24', borderRadius: 3, padding: 14,
};
const header: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13 };
const headerLabel: React.CSSProperties = {
  fontFamily: "'Barlow Semi Condensed',sans-serif", fontWeight: 700, fontSize: 12,
  letterSpacing: '2px', color: '#6f6f76',
};
const rule: React.CSSProperties = { flex: 1, height: 1, background: 'linear-gradient(90deg,#E0102B,transparent)' };
const body: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 9, alignContent: 'flex-start', overflow: 'auto' };
const empty: React.CSSProperties = { color: '#7d7d85', fontSize: 13, fontStyle: 'italic' };

interface ChipProps { name: string; dot?: string; badge?: string; badgeColor?: string }
const Chip: React.FC<ChipProps> = ({ name, dot = '#E0102B', badge, badgeColor = '#9a9aa1' }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#15151a', border: '1px solid #2a2a30',
    padding: '8px 12px', clipPath: 'polygon(0 0,100% 0,100% 72%,90% 100%,0 100%)' }}>
    <span style={{ width: 7, height: 7, background: dot, borderRadius: '50%' }} />
    <span style={{ fontFamily: "'Barlow Semi Condensed',sans-serif", fontWeight: 600, fontSize: 14, color: '#e3e3e8' }}>{name}</span>
    {badge && <span style={{ fontSize: 11, fontWeight: 700, color: badgeColor }}>{badge}</span>}
  </div>
);

export const SealsPanel: React.FC<{ seals: Seal[] }> = ({ seals }) => (
  <div className="cena-glass-panel" style={shell}>
    <div style={header}><span style={{ ...headerLabel, letterSpacing: '2.5px' }}>SELOS</span><span style={rule} /><span style={{ fontSize: 11, color: '#55555c', letterSpacing: '1px' }}>{seals.length}</span></div>
    <div style={{ ...body, flexDirection: 'column', flexWrap: 'nowrap' }}>
      {seals.length === 0
        ? <p style={empty}>Nenhum selo.</p>
        : seals.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 11, background: '#15151a', border: '1px solid #26262c', padding: '9px 11px', borderRadius: 3 }}>
              <span style={{ width: 30, height: 30, flex: 'none', background: '#E0102B', clipPath: 'polygon(50% 0,100% 50%,50% 100%,0 50%)' }} />
              <div style={{ fontFamily: "'Barlow Semi Condensed',sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: '.5px', color: '#e9e9ee' }}>{s.name}</div>
            </div>
          ))}
    </div>
  </div>
);

export const ActionsPanel: React.FC<{ cards: Card[]; items: ResolvedItem[]; weapons: Weapon[] }> = ({ cards, items, weapons }) => {
  const isEmpty = cards.length === 0 && items.length === 0 && weapons.length === 0;
  return (
    <div className="cena-glass-panel" style={shell}>
      <div style={header}><span style={headerLabel}>AÇÕES · CARTAS · ITENS</span><span style={rule} /></div>
      <div style={body}>
        {isEmpty
          ? <p style={empty}>Sem ações disponíveis.</p>
          : (
            <>
              {cards.map(c => <Chip key={`c-${c.id}`} name={c.name} badge={c.auraCost ? `${c.auraCost}◆` : undefined} badgeColor="#E0102B" />)}
              {weapons.map(w => <Chip key={`w-${w.id}`} name={w.name} dot="#7a7a82" badge="×1" />)}
              {items.map(i => <Chip key={`i-${i.id}`} name={i.name} dot="#cfcfe6" badge={`×${i.quantity}`} />)}
            </>
          )}
      </div>
    </div>
  );
};
