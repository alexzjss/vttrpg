import type { Actor, Command, CommandResult, ProjectedState, ProjectedUpdate } from '@vtt/core';
import { createLocalTransport } from './localTransport';

export type Session = Actor; // fase 2 troca por sess√£o autenticada

export interface Transport {
  connect(session: Session): Promise<ProjectedState>;
  onUpdate(listener: (u: ProjectedUpdate) => void): () => void;
  /** Snapshots n„o solicitados (ex.: reset da campanha). */
  onSnapshot(listener: (s: ProjectedState) => void): () => void;
  reset(): void;
  send(cmd: Command): Promise<CommandResult>;
  resync(): Promise<ProjectedState>;
  close(): void;
}

/** Fase 1: sempre local (SharedWorker). */
export function createTransport(): Transport {
  return createLocalTransport();
}
