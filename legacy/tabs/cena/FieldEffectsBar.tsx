import React from 'react';
import { Radiation, X } from 'lucide-react';
import type { ActiveFieldEffect } from '../../utils/cena';

export interface FieldEffectsBarProps {
  effects: ActiveFieldEffect[];
  onDispel?: (id: string) => void;
}

const FieldEffectsBar: React.FC<FieldEffectsBarProps> = ({ effects, onDispel }) => {
  if (!effects.length) return null;
  return (
    <div className="cena-field-effects" role="list" aria-label="Efeitos de campo de batalha ativos">
      {effects.map(fe => (
        <div key={fe.id} className="cena-field-effect" role="listitem" title={fe.effect.description || fe.effect.name}>
          <Radiation size={13} />
          <span>{fe.effect.name}</span>
          <b>{fe.roundsRemaining == null ? '∞' : `${fe.roundsRemaining}R`}</b>
          {onDispel && <button aria-label={`Dissipar ${fe.effect.name}`} onClick={() => onDispel(fe.id)}><X size={11} /></button>}
        </div>
      ))}
    </div>
  );
};

export default FieldEffectsBar;
