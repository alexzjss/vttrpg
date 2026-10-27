import type { GameEvent } from './events';
import type { CampaignState, Cell, Id, ResourceKey } from './model';
import type { ProjectedState } from './projection';

export type Cue =
  | { type: 'token-moved'; tokenId: Id; from: Cell; to: Cell }
  | { type: 'turn-started'; tokenId: Id; round: number }
  | { type: 'resource-changed'; characterId: Id; resource: ResourceKey; delta: number };

/** Cues visíveis para a audiência de `after`; nunca revelam o que a projeção esconde. */
export function cuesFor(events: GameEvent[], before: CampaignState, after: ProjectedState): Cue[] {
  const cues: Cue[] = [];
  let turnCueDone = false;
  for (const ev of events) {
    switch (ev.type) {
      case 'tokenMoved':
        if (after.scene.tokens[ev.tokenId]) {
          cues.push({ type: 'token-moved', tokenId: ev.tokenId, from: ev.from, to: ev.to });
        }
        break;
      case 'turnAdvanced':
      case 'encounterStarted': {
        const tokenId = after.encounter.currentTokenId;
        if (!turnCueDone && tokenId !== null) {
          cues.push({ type: 'turn-started', tokenId, round: after.encounter.round });
          turnCueDone = true;
        }
        break;
      }
      case 'resourceSet': {
        const prev = before.characters[ev.characterId]?.resources[ev.resource];
        if (prev && after.characters[ev.characterId]?.resources != null) {
          cues.push({
            type: 'resource-changed', characterId: ev.characterId, resource: ev.resource,
            delta: ev.pool.current - prev.current,
          });
        }
        break;
      }
      default:
        break;
    }
  }
  return cues;
}
