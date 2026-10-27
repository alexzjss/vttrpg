import { describe, expect, it, vi } from 'vitest';
import type { Character, CampaignState } from '@vtt/core';
import type { WorkerMessage } from './protocol';
import { createWorkerHost } from './workerHost';

const GM = { role: 'gm' } as const;
const mkChar = (kind: 'pc' | 'npc', name: string): Omit<Character, 'id'> => ({
  kind, name, portrait: '', fullBodyArt: '', tokenImage: '', speed: 6,
  hpVisibility: kind === 'pc' ? 'exact' : 'hidden',
  resources: { hp: { current: 10, max: 10 }, aura: { current: 5, max: 5 }, ammo: { current: 0, max: 0 } },
});

function setup() {
  const store = {
    load: vi.fn(async (): Promise<CampaignState | undefined> => undefined),
    save: vi.fn(async (_s: CampaignState) => {}),
  };
  let n = 0;
  const host = createWorkerHost(store, { newId: () => `id-${++n}` });
  const mkPort = () => {
    const msgs: WorkerMessage[] = [];
    const send = host.attach({ postMessage: (m) => msgs.push(m) });
    return { msgs, send };
  };
  const flush = () => new Promise((r) => setTimeout(r, 0));
  return { store, mkPort, flush };
}

describe('workerHost', () => {
  it('connect devolve snapshot da audiência', async () => {
    const { mkPort, flush } = setup();
    const gm = mkPort();
    gm.send({ t: 'connect', reqId: 1, session: GM });
    await flush();
    expect(gm.msgs[0]).toMatchObject({ t: 'snapshot', state: { name: 'Campanha local', revision: 0 } });
  });

  it('comando do gm gera result para quem enviou e update só para a audiência afetada', async () => {
    const { mkPort, flush } = setup();
    const gm = mkPort();
    const p1 = mkPort();
    const other = mkPort();
    gm.send({ t: 'connect', reqId: 1, session: GM });
    gm.send({ t: 'command', reqId: 1, cmd: { type: 'createCharacter', input: mkChar('pc', 'Ana') } });
    gm.send({ t: 'command', reqId: 2, cmd: { type: 'createCharacter', input: mkChar('pc', 'Bia') } });
    p1.send({ t: 'connect', reqId: 1, session: { role: 'player', characterId: 'id-1' } });
    other.send({ t: 'connect', reqId: 1, session: { role: 'player', characterId: 'id-2' } });
    await flush();
    gm.msgs.length = 0; p1.msgs.length = 0; other.msgs.length = 0;
    gm.send({ t: 'command', reqId: 3, cmd: { type: 'setResource', characterId: 'id-1', resource: 'hp', current: 3 } });
    await flush();
    expect(gm.msgs.map((m) => m.t)).toEqual(['result', 'update']);
    expect(gm.msgs[0]).toMatchObject({ t: 'result', reqId: 3, result: { ok: true } });
    expect(p1.msgs.map((m) => m.t)).toEqual(['update']);
    expect(other.msgs.map((m) => m.t)).toEqual(['update']); // outro PC vê o recurso exato; nenhum recebe result
  });

  it('jogador não recebe update de NPC oculto', async () => {
    const { mkPort, flush } = setup();
    const gm = mkPort();
    const p1 = mkPort();
    gm.send({ t: 'connect', reqId: 1, session: GM });
    gm.send({ t: 'command', reqId: 1, cmd: { type: 'createCharacter', input: mkChar('pc', 'Ana') } });
    gm.send({ t: 'command', reqId: 2, cmd: { type: 'createCharacter', input: mkChar('npc', 'Orc') } });
    p1.send({ t: 'connect', reqId: 1, session: { role: 'player', characterId: 'id-1' } });
    await flush();
    p1.msgs.length = 0;
    gm.send({ t: 'command', reqId: 3, cmd: { type: 'setResource', characterId: 'id-2', resource: 'hp', current: 1 } });
    await flush();
    expect(p1.msgs).toEqual([]);
  });

  it('save após comando aceito e não após rejeitado', async () => {
    const { store, mkPort, flush } = setup();
    const gm = mkPort();
    gm.send({ t: 'connect', reqId: 1, session: GM });
    gm.send({ t: 'command', reqId: 1, cmd: { type: 'deleteCharacter', characterId: 'x' } });
    await flush();
    expect(gm.msgs[1]).toMatchObject({ t: 'result', result: { ok: false } });
    expect(store.save).not.toHaveBeenCalled();
    gm.send({ t: 'command', reqId: 2, cmd: { type: 'createCharacter', input: mkChar('pc', 'Ana') } });
    await flush();
    expect(store.save).toHaveBeenCalledTimes(1);
  });

  it('reset recria a campanha e manda snapshot a todas as portas', async () => {
    const { mkPort, flush } = setup();
    const gm = mkPort();
    gm.send({ t: 'connect', reqId: 1, session: GM });
    gm.send({ t: 'command', reqId: 1, cmd: { type: 'createCharacter', input: mkChar('pc', 'Ana') } });
    await flush();
    gm.msgs.length = 0;
    gm.send({ t: 'reset' });
    await flush();
    expect(gm.msgs[0]).toMatchObject({ t: 'snapshot', state: { revision: 0, characters: {} } });
  });

  it('falha em load ainda responde ao connect com campanha nova', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = { load: async () => { throw new Error('idb'); }, save: async () => {} };
    const host = createWorkerHost(store, { newId: () => 'x' });
    const msgs: WorkerMessage[] = [];
    host.attach({ postMessage: (m) => msgs.push(m) })({ t: 'connect', reqId: 7, session: GM });
    await new Promise((r) => setTimeout(r, 0));
    expect(msgs[0]).toMatchObject({ t: 'snapshot', reqId: 7, state: { revision: 0 } });
    err.mockRestore();
  });

  it('falha em save não bloqueia result e updates', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = { load: async () => undefined, save: async () => { throw new Error('idb'); } };
    const host = createWorkerHost(store, { newId: () => 'x' });
    const msgs: WorkerMessage[] = [];
    const send = host.attach({ postMessage: (m) => msgs.push(m) });
    send({ t: 'connect', reqId: 1, session: GM });
    send({ t: 'command', reqId: 2, cmd: { type: 'createCharacter', input: mkChar('pc', 'Ana') } });
    send({ t: 'command', reqId: 3, cmd: { type: 'createCharacter', input: mkChar('pc', 'Bia') } });
    await new Promise((r) => setTimeout(r, 0));
    expect(msgs.map((m) => m.t)).toEqual(['snapshot', 'result', 'update', 'result', 'update']);
    err.mockRestore();
  });

  it('comandos de duas portas são processados em ordem, com revisões crescentes por porta', async () => {
    const { mkPort, store } = setup();
    store.save.mockImplementation(() => new Promise((r) => setTimeout(r, 5)));
    const a = mkPort();
    const b = mkPort();
    a.send({ t: 'connect', reqId: 1, session: GM });
    b.send({ t: 'connect', reqId: 1, session: GM });
    for (let i = 0; i < 3; i++) {
      a.send({ t: 'command', reqId: 10 + i, cmd: { type: 'createCharacter', input: mkChar('pc', `A${i}`) } });
      b.send({ t: 'command', reqId: 20 + i, cmd: { type: 'createCharacter', input: mkChar('pc', `B${i}`) } });
    }
    await new Promise((r) => setTimeout(r, 80));
    for (const port of [a, b]) {
      const revs = port.msgs.flatMap((m) => (m.t === 'update' ? [m.update.revision] : []));
      expect(revs).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });

  it('reset vai como snapshot sem reqId', async () => {
    const { mkPort, flush } = setup();
    const gm = mkPort();
    gm.send({ t: 'connect', reqId: 1, session: GM });
    gm.send({ t: 'reset' });
    await flush();
    expect(gm.msgs[1]).toMatchObject({ t: 'snapshot' });
    expect((gm.msgs[1] as { reqId?: number }).reqId).toBeUndefined();
  });

  it('resync antes de connect recebe resposta de erro', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { mkPort, flush } = setup();
    const p = mkPort();
    p.send({ t: 'resync', reqId: 4 });
    await flush();
    expect(p.msgs[0]).toMatchObject({ t: 'error', reqId: 4 });
    err.mockRestore();
  });
});
