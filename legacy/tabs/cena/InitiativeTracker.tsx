import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Character } from '../../types';

export interface InitiativeTrackerProps {
  round: number;
  participants: Character[];
  activeId: string | null;
  initiativeById?: Record<string, number>;
  onEditParticipant?: (id: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
}

const InitiativeTracker: React.FC<InitiativeTrackerProps> = ({ round, participants, activeId, initiativeById = {}, onEditParticipant, onPrev, onNext }) => (
  <section className="cena-initiative" aria-label="Ordem de turnos">
    <header className="cena-initiative__head">
      <div><span>ORDEM DE TURNOS · RODADA</span><strong>{round}</strong></div>
      <div className="cena-initiative__nav">
        {onPrev && <button aria-label="Turno anterior" onClick={onPrev}><ChevronLeft size={15} /></button>}
        {onNext && <button aria-label="Próximo turno" onClick={onNext}><ChevronRight size={15} /></button>}
      </div>
    </header>
    <div className="cena-initiative__list">
      {participants.map((participant, index) => {
        const isActive = participant.id === activeId;
        const down = participant.currentHp <= 0;
        return (
          <div key={participant.id} className={`cena-turn-card ${isActive ? 'is-active' : ''} ${down ? 'is-down' : ''}`} onDoubleClick={() => onEditParticipant?.(participant.id)} title={`${participant.name} · duplo clique para editar`}>
            <strong className="cena-turn-card__number">{initiativeById[participant.id] ?? '—'}</strong>
            <div className="cena-turn-card__portrait" style={participant.icon ? { backgroundImage: `url(${participant.icon})` } : undefined}>
              {!participant.icon && participant.name.charAt(0).toUpperCase()}
            </div>
            <div className="cena-turn-card__name"><span>{isActive ? 'AGORA' : index === 1 ? 'A SEGUIR' : 'AGUARDA'}</span><strong>{participant.name.toUpperCase()}</strong></div>
          </div>
        );
      })}
    </div>
  </section>
);

export default InitiativeTracker;
