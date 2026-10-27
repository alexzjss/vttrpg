import type { Command, CommandResult, ProjectedState, ProjectedUpdate } from '@vtt/core';
import type { Session } from './transport';

/** Mensagem de erro do worker quando a campanha salva não pôde ser lida. */
export const LOAD_FAILED = 'load_failed';

export type ClientMessage =
  | { t: 'connect'; reqId: number; session: Session }
  | { t: 'command'; reqId: number; cmd: Command }
  | { t: 'resync'; reqId: number }
  | { t: 'reset' }
  | { t: 'disconnect' };

export type WorkerMessage =
  | { t: 'snapshot'; state: ProjectedState; reqId?: number }
  | { t: 'result'; reqId: number; result: CommandResult }
  | { t: 'update'; update: ProjectedUpdate }
  | { t: 'error'; reqId: number; message: string };
