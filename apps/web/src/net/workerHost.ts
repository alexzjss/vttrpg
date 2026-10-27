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
  const ready = store
    .load()
    .catch((e) => {
      console.error('[workerHost] falha ao carregar a campanha; usando uma nova', e);
      return undefined;
    })
    .then((saved) => {
      authority = new Authority(saved ?? newCampaign(), { newId });
    });

  const persist = async (s: CampaignState) => {
    try {
      await store.save(s);
    } catch (e) {
      console.error('[workerHost] falha ao salvar a campanha', e);
    }
  };

  async function process(entry: PortEntry, msg: ClientMessage): Promise<void> {
    await ready;
    const auth = authority!;
    switch (msg.t) {
      case 'connect':
      case 'resync': {
        try {
          if (msg.t === 'connect') {
            entry.session = msg.session;
            entry.audience = actorAudience(msg.session);
          }
          if (!entry.audience) throw new Error('not connected');
          entry.port.postMessage({ t: 'snapshot', state: auth.snapshotFor(entry.audience), reqId: msg.reqId });
        } catch (e) {
          console.error('[workerHost] erro em connect/resync', e);
          entry.port.postMessage({ t: 'error', reqId: msg.reqId, message: e instanceof Error ? e.message : String(e) });
        }
        return;
      }
      case 'reset': {
        const fresh = new Authority(newCampaign(), { newId });
        authority = fresh;
        for (const p of ports) {
          if (p.audience) p.port.postMessage({ t: 'snapshot', state: fresh.snapshotFor(p.audience) });
        }
        await persist(fresh.getState());
        return;
      }
      case 'command': {
        if (!entry.session) {
          entry.port.postMessage({ t: 'result', reqId: msg.reqId, result: { ok: false, error: 'not_found' } });
          return;
        }
        let out: ReturnType<Authority['handle']>;
        try {
          out = auth.handle(entry.session, msg.cmd);
        } catch (e) {
          console.error('[workerHost] erro ao tratar comando', e);
          entry.port.postMessage({ t: 'result', reqId: msg.reqId, result: { ok: false, error: 'invalid_value' } });
          return;
        }
        const { result, updates } = out;
        entry.port.postMessage({ t: 'result', reqId: msg.reqId, result });
        for (const { audience, update } of updates) {
          const key = audienceKey(audience);
          for (const p of ports) {
            if (p.audience && audienceKey(p.audience) === key) p.port.postMessage({ t: 'update', update });
          }
        }
        if (result.ok && updates.length > 0) await persist(auth.getState());
      }
    }
  }

  // Uma única fila serial para todas as portas: ordem global dos comandos.
  let chain: Promise<void> = Promise.resolve();
  const enqueue = (entry: PortEntry, msg: ClientMessage) => {
    chain = chain.then(() => process(entry, msg)).catch((e) => console.error('[workerHost] erro', e));
  };

  return {
    attach(port: HostPort): (msg: ClientMessage) => void {
      const entry: PortEntry = { port, session: null, audience: null };
      ports.add(entry);
      return (msg) => enqueue(entry, msg);
    },
  };
}
