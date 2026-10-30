import type { Command, ErrorCode } from './commands';
import { cuesFor } from './cues';
import { decide } from './decide';
import type { GameEvent } from './events';
import { diffProjection, type ProjectedUpdate } from './diff';
import type { Actor, CampaignState, Id } from './model';
import { audienceKey, project, type Audience, type ProjectedState } from './projection';
import { applyEvents } from './reducer';

export type CommandResult = { ok: true; revision: number } | { ok: false; error: ErrorCode };
export interface AudienceUpdate { audience: Audience; update: ProjectedUpdate }
export interface HandleOutput { result: CommandResult; updates: AudienceUpdate[]; events: GameEvent[] }

/** Autoridade síncrona: um comando por vez; produz updates projetados por audiência. */
export class Authority {
  private state: CampaignState;
  private readonly newId: () => Id;

  constructor(state: CampaignState, deps: { newId: () => Id }) {
    this.state = state;
    this.newId = deps.newId;
  }

  getState(): CampaignState {
    return this.state;
  }

  snapshotFor(audience: Audience): ProjectedState {
    return project(this.state, audience);
  }

  handle(actor: Actor, cmd: Command): HandleOutput {
    const decision = decide(this.state, cmd, { actor, newId: this.newId });
    if (!decision.ok) return { result: { ok: false, error: decision.error }, updates: [], events: [] };
    if (decision.events.length === 0) {
      return { result: { ok: true, revision: this.state.revision }, updates: [], events: [] };
    }

    const before = this.state;
    const after: CampaignState = { ...applyEvents(before, decision.events), revision: before.revision + 1 };

    const updates: AudienceUpdate[] = [];
    const audienceSeq = { ...before.audienceSeq };
    for (const audience of knownAudiences(before, after)) {
      const projectedAfter = project(after, audience);
      const changes = diffProjection(project(before, audience), projectedAfter);
      const cues = cuesFor(decision.events, before, projectedAfter);
      if (changes.length === 0 && cues.length === 0) continue;
      const key = audienceKey(audience);
      const seq = (audienceSeq[key] ?? 0) + 1;
      audienceSeq[key] = seq;
      updates.push({ audience, update: { seq, changes, cues } });
    }
    this.state = { ...after, audienceSeq };
    return { result: { ok: true, revision: after.revision }, updates, events: decision.events };
  }
}

/** GM + todo personagem `pc` existente antes ou depois do comando. */
function knownAudiences(before: CampaignState, after: CampaignState): Audience[] {
  const byKey = new Map<string, Audience>();
  const add = (a: Audience) => byKey.set(audienceKey(a), a);
  add({ kind: 'gm' });
  for (const state of [before, after]) {
    for (const c of Object.values(state.characters)) {
      if (c.kind === 'pc') add({ kind: 'player', characterId: c.id });
    }
  }
  return [...byKey.values()];
}
