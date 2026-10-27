import type { Command, CommandResult, ProjectedState, ProjectedUpdate } from '@vtt/core';
import type { Session } from './transport';

export type ClientMessage =
  | { t: 'connect'; session: Session }
  | { t: 'command'; reqId: number; cmd: Command }
  | { t: 'resync' }
  | { t: 'reset' };

export type WorkerMessage =
  | { t: 'snapshot'; state: ProjectedState }
  | { t: 'result'; reqId: number; result: CommandResult }
  | { t: 'update'; update: ProjectedUpdate };
