import type { GameEvent } from './events';
import type { CampaignState, Encounter } from './model';

function removeFromOrder(enc: Encounter, tokenId: string): Encounter {
  const idx = enc.order.findIndex((e) => e.tokenId === tokenId);
  if (idx === -1) return enc;
  const order = enc.order.filter((e) => e.tokenId !== tokenId);
  let turnIndex = enc.turnIndex;
  if (idx < turnIndex) turnIndex -= 1;
  if (turnIndex >= order.length) turnIndex = 0;
  return { ...enc, order, turnIndex };
}

export function applyEvent(state: CampaignState, event: GameEvent): CampaignState {
  switch (event.type) {
    case 'characterCreated':
      return { ...state, characters: { ...state.characters, [event.character.id]: event.character } };
    case 'characterUpdated': {
      const c = state.characters[event.characterId];
      if (!c) return state;
      return { ...state, characters: { ...state.characters, [c.id]: { ...c, ...event.patch } } };
    }
    case 'characterDeleted': {
      const { [event.characterId]: _removed, ...characters } = state.characters;
      return { ...state, characters };
    }
    case 'resourceSet': {
      const c = state.characters[event.characterId];
      if (!c) return state;
      const resources = { ...c.resources, [event.resource]: event.pool };
      return { ...state, characters: { ...state.characters, [c.id]: { ...c, resources } } };
    }
    case 'tokenPlaced':
      return {
        ...state,
        scene: { ...state.scene, tokens: { ...state.scene.tokens, [event.token.id]: event.token } },
      };
    case 'tokenMoved': {
      const t = state.scene.tokens[event.tokenId];
      if (!t) return state;
      return {
        ...state,
        scene: { ...state.scene, tokens: { ...state.scene.tokens, [t.id]: { ...t, cell: event.to } } },
      };
    }
    case 'tokenRemoved': {
      const { [event.tokenId]: _removed, ...tokens } = state.scene.tokens;
      return {
        ...state,
        scene: { ...state.scene, tokens },
        encounter: removeFromOrder(state.encounter, event.tokenId),
      };
    }
    case 'tokenVisibilitySet': {
      const t = state.scene.tokens[event.tokenId];
      if (!t) return state;
      return {
        ...state,
        scene: { ...state.scene, tokens: { ...state.scene.tokens, [t.id]: { ...t, hidden: event.hidden } } },
      };
    }
    case 'gridUpdated':
      return { ...state, scene: { ...state.scene, grid: event.grid, background: event.background } };
    case 'encounterStarted':
      return { ...state, encounter: { active: true, round: 1, turnIndex: 0, order: event.order } };
    case 'turnAdvanced':
      return { ...state, encounter: { ...state.encounter, turnIndex: event.turnIndex, round: event.round } };
    case 'initiativeReordered':
      return { ...state, encounter: { ...state.encounter, order: event.order } };
    case 'encounterEnded':
      return { ...state, encounter: { active: false, round: 0, turnIndex: 0, order: [] } };
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

export function applyEvents(state: CampaignState, events: readonly GameEvent[]): CampaignState {
  return events.reduce(applyEvent, state);
}
