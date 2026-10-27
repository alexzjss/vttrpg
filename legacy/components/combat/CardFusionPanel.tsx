import React from 'react';
import { Card } from '../../types';

interface CardFusionPanelProps {
  actor: any;
  allCards: Card[];
  onStartFusion: (selectedCards: Card[]) => void;
  onCancel: () => void;
}

const CardFusionPanel: React.FC<CardFusionPanelProps> = ({ allCards, onStartFusion, onCancel }) => {
  const [selected, setSelected] = React.useState<string[]>([]);

  const toggleCard = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectedCards = allCards.filter(c => selected.includes(c.id));

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 900, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.2em', textAlign: 'center', paddingBottom: 6, borderBottom: '1px solid rgba(196,181,253,0.2)' }}>
        ✦ FUSÃO DE CARTAS ✦
      </div>
      <div style={{ fontSize: 9, color: 'rgba(196,181,253,0.6)', textAlign: 'center', letterSpacing: '0.1em' }}>
        Selecione 2 ou mais cartas para fundir
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
        {allCards.map(card => {
          const isSel = selected.includes(card.id);
          return (
            <div key={card.id} onClick={() => toggleCard(card.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 10,
                background: isSel ? 'rgba(139,92,246,0.25)' : 'rgba(0,0,0,0.35)',
                border: isSel ? '1.5px solid rgba(196,181,253,0.7)' : '1px solid rgba(100,80,180,0.2)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
              {card.image
                ? <img src={card.image} style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} alt="" />
                : <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(139,92,246,0.2)', flexShrink: 0 }} />
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: isSel ? '#c4b5fd' : 'rgba(200,190,240,0.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.name}</div>
                <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{card.type} · {(card as any).diceRoll}</div>
              </div>
              <div style={{ width: 16, height: 16, borderRadius: 4, border: isSel ? '2px solid #a855f7' : '2px solid rgba(100,80,180,0.35)', background: isSel ? '#a855f7' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isSel && <span style={{ fontSize: 9, color: 'white', fontWeight: 900 }}>✓</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onCancel}
          style={{ flex: 1, padding: '8px', borderRadius: 10, background: 'rgba(30,12,12,0.9)', border: '1px solid rgba(220,38,38,0.3)', color: '#f87171', fontSize: 10, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          ✕ Cancelar
        </button>
        <button
          onClick={() => selected.length >= 2 && onStartFusion(selectedCards)}
          disabled={selected.length < 2}
          style={{
            flex: 2, padding: '8px', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: selected.length >= 2 ? 'pointer' : 'not-allowed',
            background: selected.length >= 2 ? 'linear-gradient(135deg,rgba(139,92,246,0.5),rgba(109,40,217,0.7))' : 'rgba(30,20,50,0.5)',
            border: selected.length >= 2 ? '1px solid rgba(196,181,253,0.6)' : '1px solid rgba(100,80,180,0.2)',
            color: selected.length >= 2 ? '#c4b5fd' : 'rgba(150,140,180,0.3)',
            textTransform: 'uppercase', letterSpacing: '0.1em', opacity: selected.length >= 2 ? 1 : 0.5,
          }}>
          ✦ Fundir {selected.length >= 2 ? `(${selected.length})` : '—'}
        </button>
      </div>
    </div>
  );
};

export default CardFusionPanel;
