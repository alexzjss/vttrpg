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
  const snapshotWaiters = new Map<number, { resolve: (s: ProjectedState) => void; reject: (e: Error) => void }>();
  const pending = new Map<number, { resolve: (r: CommandResult) => void; reject: (e: Error) => void }>();
  let nextReq = 1;

  port.onmessage = (ev: MessageEvent<WorkerMessage>) => {
    const msg = ev.data;
    if (msg.t === 'snapshot') {
      if (msg.reqId === undefined) snapshotListeners.forEach((l) => l(msg.state));
      else {
        snapshotWaiters.get(msg.reqId)?.resolve(msg.state);
        snapshotWaiters.delete(msg.reqId);
      }
    } else if (msg.t === 'result') {
      pending.get(msg.reqId)?.resolve(msg.result);
      pending.delete(msg.reqId);
    } else if (msg.t === 'error') {
      const err = new Error(msg.message);
      snapshotWaiters.get(msg.reqId)?.reject(err);
      snapshotWaiters.delete(msg.reqId);
      pending.get(msg.reqId)?.reject(err);
      pending.delete(msg.reqId);
    } else listeners.forEach((l) => l(msg.update));
  };
  port.start();

  const post = (m: ClientMessage) => port.postMessage(m);
  // A aba fechada sem close() (navegação, fechamento) também precisa sair do worker.
  // Página no bfcache (persisted) pode voltar: a conexão deve continuar viva.
  const onPageHide = (event: Event) => {
    if ((event as PageTransitionEvent).persisted) return;
    post({ t: 'disconnect' });
  };
  globalThis.addEventListener?.('pagehide', onPageHide);
  const awaitSnapshot = (build: (reqId: number) => ClientMessage) =>
    new Promise<ProjectedState>((resolve, reject) => {
      const reqId = nextReq++;
      snapshotWaiters.set(reqId, { resolve, reject });
      post(build(reqId));
    });

  return {
    connect: (session: Session) => awaitSnapshot((reqId) => ({ t: 'connect', reqId, session: session.actor })),
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
      return new Promise<CommandResult>((resolve, reject) => {
        pending.set(reqId, { resolve, reject });
        post({ t: 'command', reqId, cmd });
      });
    },
    close() {
      globalThis.removeEventListener?.('pagehide', onPageHide);
      post({ t: 'disconnect' });
      port.close();
      listeners.clear();
      snapshotListeners.clear();
      const err = new Error('transport closed');
      snapshotWaiters.forEach((w) => w.reject(err));
      snapshotWaiters.clear();
      pending.forEach((w) => w.reject(err));
      pending.clear();
    },
  };
}
