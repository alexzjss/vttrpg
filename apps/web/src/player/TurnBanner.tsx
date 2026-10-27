import type { Id, ProjectedState } from '@vtt/core';
import type { Send } from '../gm/types';

interface Props {
  state: ProjectedState;
  meId: Id | null;
  send: Send;
}

/** Quem está jogando agora: o dono do token em currentTokenId, ou "alguém oculto". */
export function TurnBanner({ state, meId, send }: Props) {
  const { encounter, scene, characters } = state;
  if (!encounter.active) {
    return (
      <section className="turn-banner">
        <p className="turn-title">Fora de combate</p>
      </section>
    );
  }

  const tokenId = encounter.currentTokenId;
  const ownerId = tokenId !== null ? scene.tokens[tokenId]?.characterId : undefined;
  const round = <p className="turn-round">{`Rodada ${encounter.round}`}</p>;

  if (ownerId !== undefined && ownerId === meId) {
    return (
      <section className="turn-banner turn-mine">
        <p className="turn-title">Seu turno!</p>
        {round}
        <button type="button" onClick={() => void send({ type: 'nextTurn' })}>Encerrar turno</button>
      </section>
    );
  }

  const ownerName = ownerId !== undefined ? characters[ownerId]?.name : undefined;
  return (
    <section className="turn-banner">
      <p className="turn-title">{ownerName ? `Turno de ${ownerName}` : 'Turno de alguém oculto'}</p>
      {round}
    </section>
  );
}
