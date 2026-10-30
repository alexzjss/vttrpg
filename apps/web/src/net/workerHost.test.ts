import { describe, expect, it, vi } from 'vitest';
import { createCampaign, type Character, type CampaignState } from '@vtt/core';
import type { WorkerMessage } from './protocol';
import { createWorkerHost } from './workerHost';
import { v2Fields } from '../../../../packages/core/src/testing';


const GM = { role: 'gm' } as const;
const mkChar = (kind: 'pc' | 'npc', name: string): Omit<Character, 'id'> => ({
  kind, name, portrait: '', fullBodyArt: '', tokenImage: '', speed: 6, ...v2Fields(),
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
    expect(gm.msgs[0]).toMatchObject({ t: 'snapshot', state: { name: 'Campanha local', seq: 0 } });
  });

  it('estado salvo sem audienceSeq (Fase 1) é aceito e começa em seq 0', async () => {
    const { audienceSeq: _a, ...legacy } = createCampaign('local', 'Antiga');
    const store = { load: vi.fn(async () => legacy as unknown as CampaignState), save: vi.fn(async (_s: CampaignState) => {}) };
    const msgs: WorkerMessage[] = [];
    const send = createWorkerHost(store).attach({ postMessage: (m) => msgs.push(m) });
    send({ t: 'connect', reqId: 1, session: GM });
    await new Promise((r) => setTimeout(r, 0));
    expect(msgs[0]).toMatchObject({ t: 'snapshot', state: { name: 'Antiga', seq: 0 } });
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
    expect(gm.msgs[0]).toMatchObject({ t: 'snapshot', state: { seq: 0, characters: {} } });
  });

  describe('falha ao carregar', () => {
    const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {});
    const failing = (load: () => Promise<CampaignState | undefined>) => {
      const store = { load, save: vi.fn(async (_s: CampaignState) => {}) };
      const host = createWorkerHost(store, { newId: () => 'x' });
      const msgs: WorkerMessage[] = [];
      const send = host.attach({ postMessage: (m) => msgs.push(m) });
      return { store, msgs, send };
    };
    const wait = () => new Promise((r) => setTimeout(r, 0));

    it('load que rejeita: connect, resync e comando recebem load_failed e nada é salvo', async () => {
      const err = quiet();
      const { store, msgs, send } = failing(async () => { throw new Error('idb'); });
      send({ t: 'connect', reqId: 1, session: GM });
      send({ t: 'resync', reqId: 2 });
      send({ t: 'command', reqId: 3, cmd: { type: 'createCharacter', input: mkChar('pc', 'Ana') } });
      await wait();
      expect(msgs).toEqual([
        { t: 'error', reqId: 1, message: 'load_failed' },
        { t: 'error', reqId: 2, message: 'load_failed' },
        { t: 'error', reqId: 3, message: 'load_failed' },
      ]);
      expect(store.save).not.toHaveBeenCalled();
      err.mockRestore();
    });

    it('formato inválido também entra em modo de falha, sem sobrescrever', async () => {
      const err = quiet();
      const { store, msgs, send } = failing(async () => ({ revision: 'x' }) as unknown as CampaignState);
      send({ t: 'connect', reqId: 1, session: GM });
      await wait();
      expect(msgs[0]).toEqual({ t: 'error', reqId: 1, message: 'load_failed' });
      expect(store.save).not.toHaveBeenCalled();
      err.mockRestore();
    });

    it('reset só vale para sessão de mestre; limpa o modo de falha e salva a campanha nova', async () => {
      const err = quiet();
      const { store, msgs, send } = failing(async () => { throw new Error('idb'); });
      send({ t: 'reset' }); // sem sessão
      send({ t: 'connect', reqId: 1, session: { role: 'player', characterId: 'p' } });
      send({ t: 'reset' }); // jogador
      await wait();
      expect(store.save).not.toHaveBeenCalled();
      send({ t: 'connect', reqId: 2, session: GM });
      send({ t: 'reset' });
      send({ t: 'connect', reqId: 3, session: GM });
      await wait();
      expect(store.save).toHaveBeenCalledTimes(1);
      expect(msgs[msgs.length - 1]).toMatchObject({ t: 'snapshot', reqId: 3, state: { seq: 0 } });
      err.mockRestore();
    });
  });

  it('reset de jogador é ignorado', async () => {
    const { mkPort, store, flush } = setup();
    const p = mkPort();
    p.send({ t: 'connect', reqId: 1, session: { role: 'player', characterId: 'x' } });
    p.send({ t: 'reset' });
    await flush();
    expect(p.msgs.map((m) => m.t)).toEqual(['snapshot']);
    expect(store.save).not.toHaveBeenCalled();
  });

  it('disconnect remove a porta: ela não recebe mais updates', async () => {
    const { mkPort, flush } = setup();
    const a = mkPort();
    const b = mkPort();
    a.send({ t: 'connect', reqId: 1, session: GM });
    b.send({ t: 'connect', reqId: 1, session: GM });
    await flush();
    b.send({ t: 'disconnect' });
    a.send({ t: 'command', reqId: 2, cmd: { type: 'createCharacter', input: mkChar('pc', 'Ana') } });
    await flush();
    expect(a.msgs.map((m) => m.t)).toEqual(['snapshot', 'result', 'update']);
    expect(b.msgs.map((m) => m.t)).toEqual(['snapshot']);
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
      const revs = port.msgs.flatMap((m) => (m.t === 'update' ? [m.update.seq] : []));
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

describe('carga de estado salvo (migração)', () => {
  const v1 = () => {
    const { version: _v, settings: _s, log: _l, requests: _r, ...rest } = createCampaign('local', 'Antiga');
    return { ...rest, revision: 4 };
  };

  it('carrega um estado v1 salvo e passa a salvar v2', async () => {
    const store = { load: vi.fn(async () => v1() as unknown as CampaignState), save: vi.fn(async (_s: CampaignState) => {}) };
    const msgs: WorkerMessage[] = [];
    const send = createWorkerHost(store, { newId: () => 'id-1' }).attach({ postMessage: (m) => msgs.push(m) });
    send({ t: 'connect', reqId: 1, session: GM });
    send({ t: 'command', reqId: 2, cmd: { type: 'createCharacter', input: mkChar('pc', 'Ana') } });
    await new Promise((r) => setTimeout(r, 0));
    expect(msgs[0]).toMatchObject({ t: 'snapshot', state: { name: 'Antiga' } });
    expect(store.save).toHaveBeenCalledTimes(1);
    const saved = store.save.mock.calls[0]![0];
    expect(saved).toMatchObject({ version: 2, revision: 5, settings: { requireApproval: false }, log: [], requests: {} });
    expect(Object.values(saved.characters)[0]).toMatchObject({ conditions: [], actions: [], cooldowns: {} });
  });

  it('formato inválido cai no caminho load_failed e nada é salvo', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = { load: vi.fn(async () => ({ revision: 'x' }) as unknown as CampaignState), save: vi.fn(async (_s: CampaignState) => {}) };
    const msgs: WorkerMessage[] = [];
    const send = createWorkerHost(store).attach({ postMessage: (m) => msgs.push(m) });
    send({ t: 'connect', reqId: 1, session: GM });
    await new Promise((r) => setTimeout(r, 0));
    expect(msgs[0]).toMatchObject({ t: 'error', reqId: 1 });
    expect(store.save).not.toHaveBeenCalled();
    err.mockRestore();
  });
});
