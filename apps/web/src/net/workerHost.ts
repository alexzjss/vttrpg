import {
  Authority,
  actorAudience,
  audienceKey,
  createCampaign,
  type Audience,
  type CampaignState,
} from '@vtt/core';
import type { ClientMessage, WorkerMessage } from './protocol';
import type { Session } from './transport';

export interface CampaignStore {
  load(): Promise<CampaignState | undefined>;
  save(s: CampaignState): Promise<void>;
}
export interface HostPort { postMessage(m: WorkerMessage): void }
export interface HostDeps { newId?: () => string }

interface PortEntry { port: HostPort; session: Session | null; audience: Audience | null }

const newCampaign = () => createCampaign('local', 'Campanha local');

/** Lógica do worker sem APIs de worker: testável com portas falsas. */
export function createWorkerHost(store: CampaignStore, deps: HostDeps = {}) {
  const newId = deps.newId ?? (() => crypto.randomUUID());
  const ports = new Set<PortEntry>();
  let authority: Authority | null = null;
  const ready = store.load().then((saved) => {
    authority = new Authority(saved ?? newCampaign(), { newId });
  });

  async function process(entry: PortEntry, msg: ClientMessage): Promise<void> {
    await ready;
    const auth = authority!;
    switch (msg.t) {
      case 'connect':
        entry.session = msg.session;
        entry.audience = actorAudience(msg.session);
        entry.port.postMessage({ t: 'snapshot', state: auth.snapshotFor(entry.audience) });
        return;
      case 'resync':
        if (entry.audience) entry.port.postMessage({ t: 'snapshot', state: auth.snapshotFor(entry.audience) });
        return;
      case 'reset': {
        const fresh = new Authority(newCampaign(), { newId });
        authority = fresh;
        await store.save(fresh.getState());
        for (const p of ports) {
          if (p.audience) p.port.postMessage({ t: 'snapshot', state: fresh.snapshotFor(p.audience) });
        }
        return;
      }
      case 'command': {
        if (!entry.session) {
          entry.port.postMessage({ t: 'result', reqId: msg.reqId, result: { ok: false, error: 'not_found' } });
          return;
        }
        const { result, updates } = auth.handle(entry.session, msg.cmd);
        if (result.ok && updates.length > 0) await store.save(auth.getState());
        entry.port.postMessage({ t: 'result', reqId: msg.reqId, result });
        for (const { audience, update } of updates) {
          const key = audienceKey(audience);
          for (const p of ports) {
            if (p.audience && audienceKey(p.audience) === key) p.port.postMessage({ t: 'update', update });
          }
        }
      }
    }
  }

  return {
    attach(port: HostPort): (msg: ClientMessage) => void {
      const entry: PortEntry = { port, session: null, audience: null };
      ports.add(entry);
      // Encadeia para preservar a ordem das mensagens de cada porta.
      let chain: Promise<void> = Promise.resolve();
      return (msg) => {
        chain = chain.then(() => process(entry, msg)).catch(() => undefined);
      };
    },
  };
}
