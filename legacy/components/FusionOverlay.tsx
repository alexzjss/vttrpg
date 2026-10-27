import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../types';

interface FusionOverlayProps {
  step: 'rolling' | 'animating' | 'creating' | 'revealing';
  selectedCards: Card[];
  actor: any;
  rolls: number[];
  success: boolean;
  newCard: Card | null;
  revealCard: Card | null;
  cards: Card[];
  onRollComplete: (rolls: number[], success: boolean) => void;
  onAnimComplete: () => void;
  onCardCreated: (card: Partial<Card>) => void;
  onRevealComplete: () => void;
  onClose: () => void;
}

// --- Rolling Step ---
const RollingStep: React.FC<{
  selectedCards: Card[];
  onComplete: (rolls: number[], success: boolean) => void;
}> = ({ selectedCards, onComplete }) => {
  const [rolls, setRolls] = useState<number[]>([]);
  const [rolling, setRolling] = useState(false);
  const [animRolls, setAnimRolls] = useState<number[]>(selectedCards.map(() => 0));
  const intervalRef = useRef<any>(null);

  const startRoll = () => {
    setRolling(true);
    let ticks = 0;
    const maxTicks = 24;
    intervalRef.current = setInterval(() => {
      ticks++;
      setAnimRolls(selectedCards.map(() => Math.floor(Math.random() * 20) + 1));
      if (ticks >= maxTicks) {
        clearInterval(intervalRef.current);
        const finalRolls = selectedCards.map(() => Math.floor(Math.random() * 20) + 1);
        setAnimRolls(finalRolls);
        setRolls(finalRolls);
        setRolling(false);
        // Check if max difference <= 3
        const min = Math.min(...finalRolls);
        const max = Math.max(...finalRolls);
        const success = (max - min) <= 3;
        setTimeout(() => onComplete(finalRolls, success), 1200);
      }
    }, 60);
  };

  useEffect(() => {
    const t = setTimeout(startRoll, 400);
    return () => { clearTimeout(t); clearInterval(intervalRef.current); };
  }, []);

  const finalRolls = rolls.length > 0 ? rolls : animRolls;
  const min = finalRolls.length > 0 ? Math.min(...finalRolls) : 0;
  const max = finalRolls.length > 0 ? Math.max(...finalRolls) : 0;
  const diff = max - min;
  const isSuccess = rolls.length > 0 && diff <= 3;
  const isFail = rolls.length > 0 && diff > 3;

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 12, fontWeight: 900, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.25em', marginBottom: 16 }}>
        Rolando os Dados da Fusão
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        {selectedCards.map((card, i) => (
          <div key={card.id} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            background: 'rgba(139,92,246,0.12)', border: '1.5px solid rgba(196,181,253,0.3)',
            borderRadius: 14, padding: '12px 16px', minWidth: 90,
          }}>
            {card.image
              ? <img src={card.image} style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover' }} />
              : <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(139,92,246,0.3)' }} />
            }
            <div style={{ fontSize: 9, color: 'rgba(196,181,253,0.7)', fontWeight: 700, letterSpacing: '0.05em', maxWidth: 80, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{card.name}</div>
            <div style={{
              fontSize: 28, fontWeight: 900, fontFamily: "'JetBrains Mono',monospace",
              color: rolls.length > 0
                ? (finalRolls[i] === min && finalRolls[i] === max ? '#c4b5fd' : finalRolls[i] === max ? '#86efac' : finalRolls[i] === min ? '#fca5a5' : '#c4b5fd')
                : 'rgba(196,181,253,0.5)',
              animation: rolling ? 'fusion-dice-spin 0.06s linear infinite' : 'none',
              textShadow: rolls.length > 0 ? '0 0 12px rgba(196,181,253,0.6)' : 'none',
              transition: 'color 0.3s',
            }}>
              {animRolls[i] || '?'}
            </div>
          </div>
        ))}
      </div>
      {rolls.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          animation: 'fusion-result-appear 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
        }}>
          <div style={{ fontSize: 10, color: 'rgba(196,181,253,0.5)', letterSpacing: '0.1em' }}>
            Diferença: <strong style={{ color: diff <= 3 ? '#86efac' : '#f87171' }}>{diff}</strong> {diff <= 3 ? '≤' : '>'} 3
          </div>
          <div style={{
            fontSize: 16, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.3em',
            color: isSuccess ? '#86efac' : '#f87171',
            textShadow: `0 0 20px ${isSuccess ? 'rgba(134,239,172,0.8)' : 'rgba(248,113,113,0.8)'}`,
            animation: 'fusion-result-appear 0.4s ease both',
          }}>
            {isSuccess ? '✦ FUSÃO BEM-SUCEDIDA! ✦' : '✕ FUSÃO FALHOU!'}
          </div>
          {isFail && (
            <div style={{ fontSize: 9, color: 'rgba(248,113,113,0.6)', letterSpacing: '0.1em', marginTop: 4 }}>
              Os valores precisam ter diferença de no máximo 3
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- Animating Step (whirlpool) ---
const AnimatingStep: React.FC<{
  selectedCards: Card[];
  onComplete: () => void;
}> = ({ selectedCards, onComplete }) => {
  useEffect(() => {
    const t = setTimeout(onComplete, 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ textAlign: 'center', position: 'relative', height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Whirlpool cards */}
      {selectedCards.map((card, i) => {
        const angle = (i / selectedCards.length) * 360;
        const delay = i * (0.4 / selectedCards.length);
        return (
          <div key={card.id} style={{
            position: 'absolute',
            width: 60, height: 80,
            animation: `fusion-card-whirl 3s cubic-bezier(0.4,0,0.2,1) ${delay}s both`,
            transformOrigin: '50% 150%',
            transform: `rotate(${angle}deg)`,
            zIndex: selectedCards.length - i,
          }}>
            {card.image
              ? <img src={card.image} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10, border: '2px solid rgba(196,181,253,0.6)', boxShadow: '0 0 20px rgba(139,92,246,0.6)' }} />
              : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,rgba(139,92,246,0.5),rgba(109,40,217,0.7))', borderRadius: 10, border: '2px solid rgba(196,181,253,0.6)' }} />
            }
          </div>
        );
      })}
      {/* Center glow */}
      <div style={{
        position: 'absolute', width: 80, height: 80, borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(196,181,253,0.9) 0%, rgba(139,92,246,0.4) 50%, transparent 80%)',
        animation: 'fusion-center-pulse 0.8s ease-in-out infinite alternate',
        boxShadow: '0 0 40px rgba(139,92,246,0.8), 0 0 80px rgba(196,181,253,0.4)',
      }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center',
        fontSize: 11, fontWeight: 900, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.3em',
        animation: 'fusion-text-flicker 0.3s ease-in-out infinite alternate',
      }}>
        ✦ CONVERGINDO... ✦
      </div>
    </div>
  );
};

// --- Creating Step (card form) ---
const CreatingStep: React.FC<{
  selectedCards: Card[];
  onCreated: (card: Partial<Card>) => void;
  onClose: () => void;
}> = ({ selectedCards, onCreated, onClose }) => {
  const [form, setForm] = useState<Partial<Card>>({
    name: '',
    type: 'ação',
    auraCost: 0,
    diceRoll: '1d20',
    damage: 0,
    description: `Fusão de: ${selectedCards.map(c => c.name).join(', ')}`,
    image: '',
  });

  const set = (p: Partial<Card>) => setForm(prev => ({ ...prev, ...p }));
  const types = ['ataque','reação','ação','reforço','vínculo','combinação','forma'] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 900, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.2em', textAlign: 'center', marginBottom: 4 }}>
        ✦ NOVA CARTA DA FUSÃO ✦
      </div>
      <div style={{ fontSize: 9, color: 'rgba(196,181,253,0.6)', textAlign: 'center', marginBottom: 8 }}>
        Fusão de: {selectedCards.map(c => c.name).join(' + ')}
      </div>

      {/* Name */}
      <div>
        <label style={{ fontSize: 9, fontWeight: 700, color: 'rgba(196,181,253,0.6)', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 4 }}>Nome da Carta</label>
        <input
          type="text" value={form.name || ''} onChange={e => set({ name: e.target.value })}
          placeholder="Nome da carta fusionada..."
          style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 10, padding: '10px 14px', color: 'white', fontSize: 13, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Type */}
      <div>
        <label style={{ fontSize: 9, fontWeight: 700, color: 'rgba(196,181,253,0.6)', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 4 }}>Tipo</label>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {types.map(t => (
            <button key={t} onClick={() => set({ type: t })}
              style={{
                padding: '4px 10px', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em',
                background: form.type === t ? 'rgba(139,92,246,0.5)' : 'rgba(0,0,0,0.3)',
                border: form.type === t ? '1px solid rgba(196,181,253,0.7)' : '1px solid rgba(100,80,180,0.25)',
                color: form.type === t ? '#c4b5fd' : 'rgba(150,140,180,0.5)',
              }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Dice + Damage row */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 9, fontWeight: 700, color: 'rgba(196,181,253,0.6)', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 4 }}>Dado</label>
          <input type="text" value={form.diceRoll || ''} onChange={e => set({ diceRoll: e.target.value })} placeholder="1d20"
            style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 10, padding: '8px 10px', color: 'white', fontSize: 12, fontWeight: 700, outline: 'none', textAlign: 'center', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 9, fontWeight: 700, color: 'rgba(196,181,253,0.6)', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 4 }}>Dano</label>
          <input type="number" min={0} value={form.damage ?? 0} onChange={e => set({ damage: Number(e.target.value) })}
            style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 10, padding: '8px 10px', color: 'white', fontSize: 12, fontWeight: 700, outline: 'none', textAlign: 'center', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 9, fontWeight: 700, color: 'rgba(196,181,253,0.6)', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 4 }}>Aura</label>
          <input type="number" min={0} value={form.auraCost ?? 0} onChange={e => set({ auraCost: Number(e.target.value) })}
            style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 10, padding: '8px 10px', color: 'white', fontSize: 12, fontWeight: 700, outline: 'none', textAlign: 'center', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* CD */}
      <div>
        <label style={{ fontSize: 9, fontWeight: 700, color: 'rgba(196,181,253,0.6)', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 4 }}>CD (Classe de Dificuldade)</label>
        <input type="number" min={0} value={form.dc ?? ''} onChange={e => set({ dc: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="Sem CD"
          style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 10, padding: '8px 12px', color: 'white', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Description */}
      <div>
        <label style={{ fontSize: 9, fontWeight: 700, color: 'rgba(196,181,253,0.6)', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 4 }}>Descrição</label>
        <textarea value={form.description || ''} onChange={e => set({ description: e.target.value })} rows={2}
          style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 10, padding: '8px 12px', color: 'white', fontSize: 11, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onClose}
          style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'rgba(30,12,12,0.9)', border: '1px solid rgba(220,38,38,0.3)', color: '#f87171', fontSize: 10, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          ✕ Cancelar
        </button>
        <button
          onClick={() => form.name && form.name.trim() && onCreated(form)}
          disabled={!form.name || !form.name.trim()}
          style={{
            flex: 2, padding: '10px', borderRadius: 10, fontSize: 11, fontWeight: 900, cursor: form.name?.trim() ? 'pointer' : 'not-allowed',
            background: form.name?.trim() ? 'linear-gradient(135deg,rgba(139,92,246,0.6),rgba(109,40,217,0.8))' : 'rgba(30,20,50,0.5)',
            border: form.name?.trim() ? '1.5px solid rgba(196,181,253,0.7)' : '1px solid rgba(100,80,180,0.2)',
            color: form.name?.trim() ? '#e9d5ff' : 'rgba(150,140,180,0.3)',
            textTransform: 'uppercase', letterSpacing: '0.15em',
            boxShadow: form.name?.trim() ? '0 0 20px rgba(139,92,246,0.4)' : 'none',
          }}>
          ✦ Criar Carta
        </button>
      </div>
    </div>
  );
};

// --- Reveal Step ---
const RevealStep: React.FC<{
  card: Card;
  onComplete: () => void;
}> = ({ card, onComplete }) => {
  useEffect(() => {
    const t = setTimeout(onComplete, 3500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 900, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.3em' }}>
        ✦ CARTA CRIADA! ✦
      </div>
      {/* Card flip reveal */}
      <div style={{
        width: 100, height: 140, position: 'relative',
        animation: 'fusion-card-reveal 1s cubic-bezier(0.34,1.56,0.64,1) both',
        filter: 'drop-shadow(0 0 20px rgba(196,181,253,0.8))',
      }}>
        {card.image
          ? <img src={card.image} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14, border: '3px solid rgba(196,181,253,0.8)' }} />
          : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,rgba(139,92,246,0.6),rgba(109,40,217,0.8))', borderRadius: 14, border: '3px solid rgba(196,181,253,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 32 }}>✦</span>
            </div>
        }
        {/* Shine effect */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%, rgba(196,181,253,0.2) 100%)',
          animation: 'fusion-card-shine 1.5s ease-in-out infinite',
        }} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 900, color: '#e9d5ff', letterSpacing: '0.1em' }}>{card.name}</div>
      <div style={{ fontSize: 9, color: 'rgba(196,181,253,0.5)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
        {card.type} · {card.diceRoll}{card.damage ? ` · ⚔${card.damage}` : ''}
      </div>
      <div style={{ fontSize: 10, color: 'rgba(196,181,253,0.7)', fontStyle: 'italic', maxWidth: 260, lineHeight: 1.4 }}>
        "{card.description}"
      </div>
      <div style={{ fontSize: 9, color: 'rgba(134,239,172,0.7)', letterSpacing: '0.1em', animation: 'fusion-text-flicker 0.6s ease-in-out infinite alternate' }}>
        Adicionada ao baralho — preparando uso em combate...
      </div>
    </div>
  );
};

// --- Main FusionOverlay ---
const FusionOverlay: React.FC<FusionOverlayProps> = ({
  step, selectedCards, actor, rolls, success, newCard, revealCard,
  cards, onRollComplete, onAnimComplete, onCardCreated, onRevealComplete, onClose,
}) => {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(5,3,15,0.92)', backdropFilter: 'blur(16px)',
    }}>
      {/* Background radial glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 50%, rgba(139,92,246,0.25) 0%, rgba(88,28,235,0.1) 40%, transparent 70%)',
        animation: step === 'animating' ? 'fusion-bg-pulse 0.8s ease-in-out infinite alternate' : 'none',
      }} />

      <div style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 480, margin: '0 auto',
        background: 'linear-gradient(160deg, rgba(18,10,35,0.98) 0%, rgba(10,6,25,0.98) 100%)',
        border: '2px solid rgba(139,92,246,0.5)',
        borderRadius: 24, padding: 28,
        boxShadow: '0 0 60px rgba(139,92,246,0.35), 0 0 120px rgba(88,28,235,0.2), inset 0 1px 0 rgba(196,181,253,0.08)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.25em', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ animation: 'spin-slow 4s linear infinite', display: 'inline-block' }}>✦</span>
            FUSÃO DE CARTAS
          </div>
          <div style={{ fontSize: 9, color: 'rgba(196,181,253,0.4)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            {actor?.name}
          </div>
        </div>

        {/* Step content */}
        {step === 'rolling' && (
          <RollingStep selectedCards={selectedCards} onComplete={onRollComplete} />
        )}
        {step === 'animating' && (
          <AnimatingStep selectedCards={selectedCards} onComplete={onAnimComplete} />
        )}
        {step === 'creating' && (
          <CreatingStep selectedCards={selectedCards} onCreated={onCardCreated} onClose={onClose} />
        )}
        {step === 'revealing' && revealCard && (
          <RevealStep card={revealCard} onComplete={onRevealComplete} />
        )}
      </div>

      <style>{`
        @keyframes fusion-dice-spin {
          0%,100% { transform: scale(1); }
          50% { transform: scale(1.1) rotate(10deg); }
        }
        @keyframes fusion-result-appear {
          0% { opacity:0; transform: scale(0.7); }
          100% { opacity:1; transform: scale(1); }
        }
        @keyframes fusion-card-whirl {
          0% { opacity:1; transform: rotate(0deg) translateY(0px) scale(1); }
          40% { opacity:1; transform: rotate(180deg) translateY(-20px) scale(0.9); }
          70% { opacity:1; transform: rotate(320deg) translateY(-40px) scale(0.7); }
          85% { opacity:0.5; transform: rotate(350deg) translateY(-60px) scale(0.4); }
          100% { opacity:0; transform: rotate(360deg) translateY(-80px) scale(0); }
        }
        @keyframes fusion-center-pulse {
          0% { transform: scale(0.8); opacity:0.6; }
          100% { transform: scale(1.3); opacity:1; }
        }
        @keyframes fusion-text-flicker {
          0% { opacity:0.6; }
          100% { opacity:1; }
        }
        @keyframes fusion-card-reveal {
          0% { opacity:0; transform: rotateY(90deg) scale(0.5); }
          50% { opacity:1; transform: rotateY(-10deg) scale(1.05); }
          100% { opacity:1; transform: rotateY(0deg) scale(1); }
        }
        @keyframes fusion-card-shine {
          0% { opacity:0; transform: translateX(-100%) skewX(-20deg); }
          50% { opacity:1; }
          100% { opacity:0; transform: translateX(200%) skewX(-20deg); }
        }
        @keyframes fusion-bg-pulse {
          0% { opacity:0.6; }
          100% { opacity:1; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default FusionOverlay;
