import type { Id, ProjectedCharacter, ProjectedState } from '@vtt/core';
import { useState } from 'react';
import { firstFreeCell } from './freeCell';
import type { Send } from './types';

interface Props {
  state: ProjectedState;
  send: Send;
  onNew(): void;
  onEdit(characterId: Id): void;
}

export function CharacterList({ state, send, onNew, onEdit }: Props) {
  const [error, setError] = useState<string | null>(null);
  const all = Object.values(state.characters);
  const onScene = new Set(Object.values(state.scene.tokens).map((t) => t.characterId));

  const place = (c: ProjectedCharacter) => {
    const cell = firstFreeCell(state.scene);
    if (!cell) return setError('Não há célula livre na cena.');
    setError(null);
    void send({ type: 'placeToken', characterId: c.id, cell });
  };
  const remove = (c: ProjectedCharacter) => {
    if (window.confirm(`Excluir ${c.name}?`)) void send({ type: 'deleteCharacter', characterId: c.id });
  };

  const group = (title: string, list: ProjectedCharacter[]) => (
    <section>
      <h3>{title}</h3>
      {list.length === 0 && <p className="muted">Ninguém por aqui.</p>}
      <ul className="plain-list">
        {list.map((c) => (
          <li key={c.id} className="character-item">
            <strong>{c.name}</strong>
            <div className="item-actions">
              <button type="button" disabled={onScene.has(c.id)} onClick={() => place(c)}
                aria-label={`Colocar ${c.name} na cena`}>Colocar na cena</button>
              <button type="button" onClick={() => onEdit(c.id)} aria-label={`Editar ${c.name}`}>Editar</button>
              <button type="button" onClick={() => remove(c)} aria-label={`Excluir ${c.name}`}>Excluir</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <div className="character-list">
      <button type="button" onClick={onNew}>Novo personagem</button>
      {error && <p role="alert" className="local-error">{error}</p>}
      {group('Jogadores', all.filter((c) => c.kind === 'pc'))}
      {group('NPCs', all.filter((c) => c.kind === 'npc'))}
    </div>
  );
}
