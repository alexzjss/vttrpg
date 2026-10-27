import type { Command, ErrorCode } from './commands';
import { cuesFor } from './cues';
import { decide } from './decide';
import { diffProjection, type ProjectedUpdate } from './diff';
import type { Actor, CampaignState, Id } from './model';
import { audienceKey, project, type Audience, type ProjectedState } from './projection';
import { applyEvents } from './reducer';

export type CommandResult = { ok: true; revision: number } | { ok: false; error: ErrorCode };
export interface AudienceUpdate { audience: Audience; update: ProjectedUpdate }
export interface HandleOutput { result: CommandResult; updates: AudienceUpdate[] }

/** Autoridade síncrona: um comando por vez; produz updates projetados por audiência. */
export class Authority {
  private state: CampaignState;
  private readonly newId: () => Id;
  private readonly initialRevision: number;
  /** Última revisão entregue (snapshot ou update) a cada audiência. */
  private readonly lastDelivered = new Map<string, number>();

  constructor(state: CampaignState, deps: { newId: () => Id }) {
    this.state = state;
    this.newId = deps.newId;
    this.initialRevision = state.revision;
  }

  getState(): CampaignState {
    return this.state;
  }

  snapshotFor(audience: Audience): ProjectedState {
    this.lastDelivered.set(audienceKey(audience), this.state.revision);
    return project(this.state, audience);
  }

  handle(actor: Actor, cmd: Command): HandleOutput {
    const decision = decide(this.state, cmd, { actor, newId: this.newId });
    if (!decision.ok) return { result: { ok: false, error: decision.error }, updates: [] };
    if (decision.events.length === 0) {
      return { result: { ok: true, revision: this.state.revision }, updates: [] };
    }

    const before = this.state;
    const after: CampaignState = { ...applyEvents(before, decision.events), revision: before.revision + 1 };
    this.state = after;

    const updates: AudienceUpdate[] = [];
    for (const audience of knownAudiences(before, after)) {
      const projectedAfter = project(after, audience);
      const changes = diffProjection(project(before, audience), projectedAfter);
      const cues = cuesFor(decision.events, before, projectedAfter);
      if (changes.length === 0 && cues.length === 0) continue;
      const key = audienceKey(audience);
      const baseRevision = this.lastDelivered.get(key) ?? this.initialRevision;
      this.lastDelivered.set(key, after.revision);
      updates.push({ audience, update: { revision: after.revision, baseRevision, changes, cues } });
    }
    return { result: { ok: true, revision: after.revision }, updates };
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
