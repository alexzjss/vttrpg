import {
  Authority, project, type Actor, type Audience, type Command, type CommandResult, type ProjectedState,
} from '@vtt/core';
import { containsDataUrl } from './imageGuard';
import type { CampaignStore } from './store';
import { topicFor } from './topics';

const MAX_ATTEMPTS = 3;

/** Carrega, decide e grava; em conflito de revisão recarrega e tenta de novo (até 3 tentativas). */
export async function processCommand(
  store: CampaignStore,
  campaignId: string,
  actor: Actor,
  cmd: Command,
  newId: () => string,
): Promise<CommandResult> {
  if (containsDataUrl(cmd)) return { ok: false, error: 'invalid_value' };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const state = await store.load(campaignId);
    if (!state) return { ok: false, error: 'not_found' };

    const authority = new Authority(state, { newId });
    const out = authority.handle(actor, cmd);
    if (!out.result.ok || out.events.length === 0) return out.result;

    const outcome = await store.commit({
      campaignId,
      expectedRevision: state.revision,
      state: authority.getState(),
      actor,
      command: cmd,
      events: out.events,
      broadcasts: out.updates.map((u) => ({ topic: topicFor(campaignId, u.audience), payload: u.update })),
    });
    if (outcome === 'ok') return out.result;
  }
  return { ok: false, error: 'conflict' };
}

export function audienceOf(actor: Actor): Audience {
  return actor.role === 'gm' ? { kind: 'gm' } : { kind: 'player', characterId: actor.characterId };
}

export async function readState(
  store: CampaignStore,
  campaignId: string,
  actor: Actor,
): Promise<ProjectedState | null> {
  const state = await store.load(campaignId);
  return state ? project(state, audienceOf(actor)) : null;
}
