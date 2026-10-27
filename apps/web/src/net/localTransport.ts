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
  const snapshotWaiters: Array<(s: ProjectedState) => void> = [];
  const pending = new Map<number, (r: CommandResult) => void>();
  let nextReq = 1;

  port.onmessage = (ev: MessageEvent<WorkerMessage>) => {
    const msg = ev.data;
    if (msg.t === 'snapshot') snapshotWaiters.shift()?.(msg.state);
    else if (msg.t === 'result') {
      pending.get(msg.reqId)?.(msg.result);
      pending.delete(msg.reqId);
    } else listeners.forEach((l) => l(msg.update));
  };
  port.start();

  const post = (m: ClientMessage) => port.postMessage(m);
  const awaitSnapshot = (m: ClientMessage) =>
    new Promise<ProjectedState>((resolve) => {
      snapshotWaiters.push(resolve);
      post(m);
    });

  return {
    connect: (session: Session) => awaitSnapshot({ t: 'connect', session }),
    resync: () => awaitSnapshot({ t: 'resync' }),
    onUpdate(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
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
