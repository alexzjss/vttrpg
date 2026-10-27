import type { ProjectedCharacter } from '@vtt/core';
import { Silhouette } from './Silhouette';

interface Props {
  character: ProjectedCharacter;
}

/** Coluna esquerda: arte de corpo inteiro, com retrato e silhueta como fallback. */
export function CharacterSheet({ character }: Props) {
  const art = character.fullBodyArt || character.portrait;
  return (
    <section className="character-sheet">
      <div className="sheet-art">
        {art ? (
          <img src={art} alt={`Arte de ${character.name}`} />
        ) : (
          <Silhouette className="sheet-silhouette" />
        )}
      </div>
      <h2 className="sheet-name">{character.name}</h2>
    </section>
  );
}
