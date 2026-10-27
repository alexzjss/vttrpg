import type { ProjectedState } from '@vtt/core';

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');

/** Faixa sobreposta no topo: ordem de iniciativa em combate, nome da cena fora dele. */
export function TurnStrip({ state }: { state: ProjectedState }) {
  const { encounter, scene, characters } = state;
  if (!encounter.active) {
    return (
      <div className="turn-strip">
        <div className="turn-strip-body"><span className="turn-strip-scene">{scene.name}</span></div>
      </div>
    );
  }
  return (
    <div className="turn-strip">
      <div className="turn-strip-body">
        <span className="turn-strip-round">Rodada {encounter.round}</span>
        <ul className="turn-strip-list">
          {encounter.order.map((entry) => {
            const token = scene.tokens[entry.tokenId];
            const character = token ? characters[token.characterId] : undefined;
            if (!character) return null;
            const current = entry.tokenId === encounter.currentTokenId;
            return (
              <li key={entry.tokenId} className={current ? 'turn-item current' : 'turn-item'}
                aria-current={current ? 'true' : undefined}>
                {character.portrait ? (
                  <img className="turn-portrait" src={character.portrait} alt="" />
                ) : (
                  <span className="turn-portrait turn-initials" aria-hidden="true">{initials(character.name)}</span>
                )}
                <span className="turn-name">{character.name}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
