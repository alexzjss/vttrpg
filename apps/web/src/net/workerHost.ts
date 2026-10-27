import {
  Authority,
  actorAudience,
  audienceKey,
  createCampaign,
  type Audience,
  type CampaignState,
} from '@vtt/core';
import { LOAD_FAILED, type ClientMessage, type WorkerMessage } from './protocol';
import type { Session } from './transport';

export interface CampaignStore {
  load(): Promise<CampaignState | undefined>;
  save(s: CampaignState): Promise<void>;
}
export interface HostPort { postMessage(m: WorkerMessage): void }
export interface HostDeps { newId?: () => string }

interface PortEntry { port: HostPort; session: Session | null; audience: Audience | null }

const newCampaign = () => createCampaign('local', 'Campanha local');

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

/** Confere o formato mínimo de uma campanha salva; dado inválido nunca deve virar Authority. */
export function isValidCampaign(v: unknown): v is CampaignState {
  if (!isObject(v) || !isNum(v.revision) || !isObject(v.characters)) return false;
  if (v.audienceSeq !== undefined && !isObject(v.audienceSeq)) return false;
  if (!isObject(v.scene) || !isObject(v.scene.grid) || !isObject(v.scene.tokens)) return false;
  const g = v.scene.grid;
  if (!isNum(g.cols) || !isNum(g.rows) || !isNum(g.cellSize)) return false;
  return isObject(v.encounter);
}

/** Lógica do worker sem APIs de worker: testável com portas falsas. */
export function createWorkerHost(store: CampaignStore, deps: HostDeps = {}) {
  const newId = deps.newId ?? (() => crypto.randomUUID());
  const ports = new Set<PortEntry>();
  let authority: Authority | null = null;
  // Modo de falha: a campanha salva existe mas não pôde ser lida. Nada é salvo (para não
  // sobrescrever o dado) e toda requisição recebe `load_failed` até o mestre reiniciar.
  let failed = false;
  const ready = store
    .load()
    .then((saved) => {
      if (saved === undefined) authority = new Authority(newCampaign(), { newId });
      else if (isValidCampaign(saved)) authority = new Authority({ ...saved, audienceSeq: saved.audienceSeq ?? {} }, { newId });
      else {
        console.error('[workerHost] campanha salva com formato inválido');
        failed = true;
      }
    })
    .catch((e) => {
      console.error('[workerHost] falha ao carregar a campanha', e);
      failed = true;
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
    if (msg.t === 'disconnect') {
      ports.delete(entry);
      return;
    }
    if (msg.t === 'reset') {
      // M4: só uma sessão de mestre pode reiniciar a campanha.
      if (entry.session?.role !== 'gm') return;
      const fresh = new Authority(newCampaign(), { newId });
      authority = fresh;
      failed = false;
      for (const p of ports) {
        if (p.audience) p.port.postMessage({ t: 'snapshot', state: fresh.snapshotFor(p.audience) });
      }
      await persist(fresh.getState());
      return;
    }
    if (failed) {
      // Registra a sessão (para o mestre poder reiniciar), mas nunca a audiência.
      if (msg.t === 'connect') entry.session = msg.session;
      entry.port.postMessage({ t: 'error', reqId: msg.reqId, message: LOAD_FAILED });
      return;
    }
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
