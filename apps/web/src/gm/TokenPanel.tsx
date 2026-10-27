import type { Id, ProjectedState, ResourceKey } from '@vtt/core';
import { ResourceEditor } from './ResourceEditor';
import type { Send } from './types';

const KEYS: ResourceKey[] = ['hp', 'aura', 'ammo'];

interface Props {
  state: ProjectedState;
  tokenId: Id | null;
  send: Send;
}

/** Coluna direita: o personagem do token selecionado. */
export function TokenPanel({ state, tokenId, send }: Props) {
  const token = tokenId ? state.scene.tokens[tokenId] : undefined;
  const character = token ? state.characters[token.characterId] : undefined;
  if (!token || !character) {
    return <p className="muted">Selecione um token no tabuleiro.</p>;
  }
  return (
    <section>
      <h3>{character.name}</h3>
      {token.hidden && <p className="muted">Token oculto dos jogadores.</p>}
      {character.resources &&
        KEYS.map((k) => (
          <ResourceEditor key={k} characterId={character.id} resource={k}
            pool={character.resources![k]} send={send} />
        ))}
      <div className="item-actions">
        <button type="button"
          onClick={() => void send({ type: 'setTokenHidden', tokenId: token.id, hidden: !token.hidden })}>
          {token.hidden ? 'Revelar token' : 'Ocultar token'}
        </button>
        <button type="button" onClick={() => void send({ type: 'removeToken', tokenId: token.id })}>
          Remover da cena
        </button>
      </div>
    </section>
  );
}
