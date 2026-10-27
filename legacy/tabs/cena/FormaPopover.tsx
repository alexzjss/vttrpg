import React from 'react';
import type { FormAvailability } from '../../utils/arsenalState';

interface FormaPopoverProps {
  forms: FormAvailability[];
  onActivate: (formId: string) => void;
  onRevert: () => void;
  onClose: () => void;
}

const auraCost = (card: FormAvailability['card']): number =>
  (card.auraConsumed?.flat ?? 0);

const FormaPopover: React.FC<FormaPopoverProps> = ({ forms, onActivate, onRevert, onClose }) => {
  const hasActive = forms.some(f => f.isActive);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="cena-forma-popover" role="menu" aria-label="Selecionar forma" onPointerDown={e => e.stopPropagation()}>
      <div className="cena-forma-popover__head">FORMAS</div>
      {forms.map(({ card, ok, reason, isActive }) => (
        <button
          key={card.id}
          role="menuitem"
          className={`cena-forma-popover__item${ok ? '' : ' is-blocked'}${isActive ? ' is-active' : ''}`}
          disabled={!ok && !isActive}
          onClick={() => { if (isActive) onRevert(); else if (ok) onActivate(card.id); }}
        >
          <span className="cena-forma-popover__icon" style={{ ['--forma-color' as string]: card.form?.color ?? '#f59e0b', backgroundImage: card.form?.iconOverride ? `url(${card.form.iconOverride})` : undefined }} />
          <span className="cena-forma-popover__body">
            <strong>{card.name}</strong>
            <small>{isActive ? 'Ativa · toque para reverter' : ok ? `${auraCost(card)} aura${card.form?.durationRounds ? ` · ${card.form.durationRounds} rodadas` : ''}` : reason}</small>
          </span>
        </button>
      ))}
      {hasActive && <button className="cena-forma-popover__revert" onClick={onRevert}>Reverter forma</button>}
    </div>
  );
};

export default FormaPopover;
