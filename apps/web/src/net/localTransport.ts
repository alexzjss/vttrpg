import type { Command, CommandResult, ProjectedState, ProjectedUpdate } from '@vtt/core';
import type { ClientMessage, WorkerMessage } from './protocol';
import type { Session, Transport } from './transport';

export function createLocalTransport(): Transport {
  const worker = new SharedWorker(new URL('./localWorker.ts', import.meta.url), {
    type: 'module',
    name: 'vtt-authority',
  });
  const port = worker.port;
  const listeners = new Set<(u: ProjectedUpdate) => void>();
  const snapshotListeners = new Set<(s: ProjectedState) => void>();
  const snapshotWaiters = new Map<number, (s: ProjectedState) => void>();
  const pending = new Map<number, (r: CommandResult) => void>();
  let nextReq = 1;

  port.onmessage = (ev: MessageEvent<WorkerMessage>) => {
    const msg = ev.data;
    if (msg.t === 'snapshot') {
      if (msg.reqId === undefined) snapshotListeners.forEach((l) => l(msg.state));
      else {
        snapshotWaiters.get(msg.reqId)?.(msg.state);
        snapshotWaiters.delete(msg.reqId);
      }
    } else if (msg.t === 'result') {
      pending.get(msg.reqId)?.(msg.result);
      pending.delete(msg.reqId);
    } else listeners.forEach((l) => l(msg.update));
  };
  port.start();

  const post = (m: ClientMessage) => port.postMessage(m);
  const awaitSnapshot = (build: (reqId: number) => ClientMessage) =>
    new Promise<ProjectedState>((resolve) => {
      const reqId = nextReq++;
      snapshotWaiters.set(reqId, resolve);
      post(build(reqId));
    });

  return {
    connect: (session: Session) => awaitSnapshot((reqId) => ({ t: 'connect', reqId, session })),
    resync: () => awaitSnapshot((reqId) => ({ t: 'resync', reqId })),
    onUpdate(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onSnapshot(listener) {
      snapshotListeners.add(listener);
      return () => snapshotListeners.delete(listener);
    },
    reset: () => post({ t: 'reset' }),
    send(cmd: Command) {
      const reqId = nextReq++;
      return new Promise<CommandResult>((resolve) => {
        pending.set(reqId, resolve);
        post({ t: 'command', reqId, cmd });
      });
    },
    close() {
      port.close();
      listeners.clear();
    },
  };
}
