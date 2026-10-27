import {
  Authority,
  actorAudience,
  audienceKey,
  createCampaign,
  type CampaignState,
  type Command,
  type CommandResult,
  type ProjectedState,
  type ProjectedUpdate,
} from '@vtt/core';
import type { Session, Transport } from './transport';

export interface FakeTransport extends Transport {
  sent: Command[];
  resyncCalls: number;
  authority: Authority;
  /** Entrega um update arbitrário ao listener (para simular perdas/saltos). */
  push(u: ProjectedUpdate): void;
}

/** Simula uma aba: Authority em memória; connect(session) permite entrar como qualquer sessão. */
export function createFakeTransport(initial?: CampaignState): FakeTransport {
  let n = 0;
  const authority = new Authority(initial ?? createCampaign('test', 'Campanha de teste'), {
    newId: () => `id-${++n}`,
  });
  const listeners = new Set<(u: ProjectedUpdate) => void>();
  let session: Session | null = null;

  const snapshot = (): ProjectedState => {
    if (!session) throw new Error('not connected');
    return authority.snapshotFor(actorAudience(session));
  };
  const push = (u: ProjectedUpdate) => listeners.forEach((l) => l(u));

  const t: FakeTransport = {
    sent: [],
    resyncCalls: 0,
    authority,
    push,
    async connect(s) {
      session = s;
      return snapshot();
    },
    onUpdate(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async send(cmd): Promise<CommandResult> {
      t.sent.push(cmd);
      if (!session) return { ok: false, error: 'not_found' };
      const { result, updates } = authority.handle(session, cmd);
      const mine = audienceKey(actorAudience(session));
      for (const { audience, update } of updates) if (audienceKey(audience) === mine) push(update);
      return result;
    },
    async resync() {
      t.resyncCalls++;
      return snapshot();
    },
    close() {
      listeners.clear();
    },
  };
  return t;
}
