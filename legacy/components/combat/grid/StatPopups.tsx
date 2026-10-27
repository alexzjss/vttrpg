import React from 'react';
import { StatPopup } from '../../../types';

interface StatPopupsProps {
  popups: StatPopup[];
}

const StatPopups: React.FC<StatPopupsProps> = ({ popups }) => (
  <>
    {popups.map((popup, pi) => {
      const isDmg = popup.type === 'hp' && popup.delta < 0;
      const isHeal = popup.type === 'hp' && popup.delta > 0;
      const color = popup.type === 'hp'
        ? (popup.delta < 0 ? '#f87171' : '#4ade80')
        : popup.type === 'aura'
        ? (popup.delta < 0 ? '#fbbf24' : '#a78bfa')
        : (popup.delta < 0 ? '#fb923c' : '#67e8f9');
      const anim = isDmg ? 'statPopup-dmg 1.9s ease forwards'
        : isHeal ? 'statPopup-heal 1.9s ease forwards'
        : 'statPopup 1.8s ease forwards';
      const fsize = isDmg ? 17 : isHeal ? 15 : 13;
      const glow = isDmg
        ? '0 0 12px rgba(239,68,68,0.8),0 2px 8px rgba(0,0,0,1)'
        : isHeal
        ? '0 0 10px rgba(74,222,128,0.7),0 2px 8px rgba(0,0,0,1)'
        : '0 2px 8px rgba(0,0,0,1)';
      return (
        <div key={popup.id} style={{
          position: 'absolute',
          top: -28 - pi * 8,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: "'JetBrains Mono',monospace",
          fontWeight: isDmg ? 900 : 700,
          fontStyle: isDmg ? 'italic' : 'normal',
          fontSize: fsize,
          color,
          textShadow: glow,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          animation: anim,
          zIndex: 99 + pi,
          letterSpacing: isDmg ? '-0.02em' : '0',
        }}>
          {popup.delta > 0 ? '+' : ''}{popup.delta}
          {popup.type === 'hp' ? '♥' : popup.type === 'aura' ? '⚡' : '🎯'}
        </div>
      );
    })}
  </>
);

export default StatPopups;
