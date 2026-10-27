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
    gm.send({ t: 'connect', session: GM });
    await flush();
    expect(gm.msgs[0]).toMatchObject({ t: 'snapshot', state: { name: 'Campanha local', revision: 0 } });
  });

  it('comando do gm gera result para quem enviou e update só para a audiência afetada', async () => {
    const { mkPort, flush } = setup();
    const gm = mkPort();
    const p1 = mkPort();
    const other = mkPort();
    gm.send({ t: 'connect', session: GM });
    gm.send({ t: 'command', reqId: 1, cmd: { type: 'createCharacter', input: mkChar('pc', 'Ana') } });
    gm.send({ t: 'command', reqId: 2, cmd: { type: 'createCharacter', input: mkChar('pc', 'Bia') } });
    p1.send({ t: 'connect', session: { role: 'player', characterId: 'id-1' } });
    other.send({ t: 'connect', session: { role: 'player', characterId: 'id-2' } });
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
    gm.send({ t: 'connect', session: GM });
    gm.send({ t: 'command', reqId: 1, cmd: { type: 'createCharacter', input: mkChar('pc', 'Ana') } });
    gm.send({ t: 'command', reqId: 2, cmd: { type: 'createCharacter', input: mkChar('npc', 'Orc') } });
    p1.send({ t: 'connect', session: { role: 'player', characterId: 'id-1' } });
    await flush();
    p1.msgs.length = 0;
    gm.send({ t: 'command', reqId: 3, cmd: { type: 'setResource', characterId: 'id-2', resource: 'hp', current: 1 } });
    await flush();
    expect(p1.msgs).toEqual([]);
  });

  it('save após comando aceito e não após rejeitado', async () => {
    const { store, mkPort, flush } = setup();
    const gm = mkPort();
    gm.send({ t: 'connect', session: GM });
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
    gm.send({ t: 'connect', session: GM });
    gm.send({ t: 'command', reqId: 1, cmd: { type: 'createCharacter', input: mkChar('pc', 'Ana') } });
    await flush();
    gm.msgs.length = 0;
    gm.send({ t: 'reset' });
    await flush();
    expect(gm.msgs[0]).toMatchObject({ t: 'snapshot', state: { revision: 0, characters: {} } });
  });
});
