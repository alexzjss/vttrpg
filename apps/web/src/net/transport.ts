import type { Actor, Command, CommandResult, ProjectedState, ProjectedUpdate } from '@vtt/core';
import { createLocalTransport } from './localTransport';
import { createOnlineTransport } from './onlineTransport';

export type Session =
  | { mode: 'local'; actor: Actor }
  | { mode: 'online'; actor: Actor; campaignId: string; username: string };

export interface Transport {
  connect(session: Session): Promise<ProjectedState>;
  onUpdate(listener: (u: ProjectedUpdate) => void): () => void;
  /** Snapshots não solicitados (ex.: reset da campanha). */
  onSnapshot(listener: (s: ProjectedState) => void): () => void;
  reset(): void;
  send(cmd: Command): Promise<CommandResult>;
  resync(): Promise<ProjectedState>;
  close(): void;
}

/** Local (SharedWorker) ou online (Supabase Realtime + HTTP), conforme a sessão. */
export function createTransport(session: Session): Transport {
  return session.mode === 'online' ? createOnlineTransport() : createLocalTransport();
}
