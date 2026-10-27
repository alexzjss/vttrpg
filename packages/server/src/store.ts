import type { Actor, CampaignState, Command, GameEvent, ProjectedUpdate } from '@vtt/core';

export interface Broadcast { topic: string; payload: ProjectedUpdate }

export interface CommitInput {
  campaignId: string;
  /** Revisão lida no load; o commit só vale se o estado salvo ainda estiver nela. */
  expectedRevision: number;
  /** Novo estado, já com `revision` = expectedRevision + 1. */
  state: CampaignState;
  actor: Actor;
  command: Command;
  events: GameEvent[];
  broadcasts: Broadcast[];
}

export interface CampaignStore {
  load(campaignId: string): Promise<CampaignState | null>;
  commit(input: CommitInput): Promise<'ok' | 'conflict'>;
}
