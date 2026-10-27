import type { Id, ProjectedState } from '@vtt/core';
import { ResourceBar } from './ResourceBar';
import { Silhouette } from './Silhouette';

interface Props {
  state: ProjectedState;
  meId: Id | null;
}

/** Outros personagens jogadores: retrato pequeno, nome e barras de HP e Aura. */
export function AlliesPanel({ state, meId }: Props) {
  const allies = Object.values(state.characters).filter((c) => c.kind === 'pc' && c.id !== meId);
  return (
    <section className="allies-panel">
      <h3>Aliados</h3>
      {allies.length === 0 && <p className="muted">Nenhum aliado na mesa.</p>}
      <ul className="plain-list">
        {allies.map((c) => (
          <li key={c.id} className="ally-card">
            <div className="ally-head">
              {c.portrait ? (
                <img className="ally-portrait" src={c.portrait} alt={`Retrato de ${c.name}`} />
              ) : (
                <Silhouette className="ally-portrait" />
              )}
              <strong>{c.name}</strong>
            </div>
            {c.resources && (
              <>
                <ResourceBar label="HP" pool={c.resources.hp} />
                <ResourceBar label="Aura" pool={c.resources.aura} />
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
