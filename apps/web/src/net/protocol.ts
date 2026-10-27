import type { Command, CommandResult, ProjectedState, ProjectedUpdate } from '@vtt/core';
import type { Session } from './transport';

export type ClientMessage =
  | { t: 'connect'; reqId: number; session: Session }
  | { t: 'command'; reqId: number; cmd: Command }
  | { t: 'resync'; reqId: number }
  | { t: 'reset' };

export type WorkerMessage =
  | { t: 'snapshot'; state: ProjectedState; reqId?: number }
  | { t: 'result'; reqId: number; result: CommandResult }
  | { t: 'update'; update: ProjectedUpdate }
  | { t: 'error'; reqId: number; message: string };
