import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProjectedState, ProjectedUpdate } from '@vtt/core';
import { createOnlineTransport } from './onlineTransport';
import type { Api } from './api';
import type { Session } from './transport';

const CAMPAIGN = '11111111-1111-4111-8111-111111111111';
const gm: Session = { mode: 'online', actor: { role: 'gm' }, campaignId: CAMPAIGN, username: 'ana' };
const player: Session = {
  mode: 'online',
  actor: { role: 'player', characterId: 'c1' },
  campaignId: CAMPAIGN,
  username: 'bia',
};
const STATE = { seq: 3 } as unknown as ProjectedState;

function fakes(opts: { subscribeStatus?: string | null; token?: string | null } = {}) {
  const log: string[] = [];
  let broadcast: ((m: { payload: unknown }) => void) | null = null;
  let authCb: ((event: string, s: { access_token: string } | null) => void) | null = null;
  const unsubscribe = vi.fn();
  const channelFn = vi.fn((topic: string, config: unknown) => {
    log.push('channel');
    const ch = {
      topic,
      config,
      on: vi.fn((_t: string, _f: { event: string }, h: (m: { payload: unknown }) => void) => {
        broadcast = h;
        return ch;
      }),
      subscribe: vi.fn((cb: (s: string) => void) => {
        log.push('subscribe');
        const status = opts.subscribeStatus === undefined ? 'SUBSCRIBED' : opts.subscribeStatus;
        if (status) cb(status);
        return ch;
      }),
    };
    return ch;
  });
  const removeChannel = vi.fn();
  const setAuth = vi.fn();
  const supabase = {
    channel: channelFn,
    removeChannel,
    realtime: { setAuth },
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: opts.token === null ? null : { access_token: opts.token ?? 'tok1' } },
      })),
      onAuthStateChange: vi.fn((cb: typeof authCb) => {
        authCb = cb;
        return { data: { subscription: { unsubscribe } } };
      }),
    },
  } as unknown as SupabaseClient;
  const api: Api = {
    get: vi.fn(async (path: string) => {
      log.push(`get ${path}`);
      return { state: STATE };
    }) as Api['get'],
    post: vi.fn(async () => ({ ok: true })) as Api['post'],
    patch: vi.fn() as Api['patch'],
  };
  return {
    supabase, api, log, channelFn, removeChannel, setAuth, unsubscribe,
    emit: (payload: unknown) => broadcast?.({ payload }),
    auth: (event: string, token: string | null) => authCb?.(event, token ? { access_token: token } : null),
  };
}

describe('OnlineTransport', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('define a auth, assina o canal privado e só então busca o estado', async () => {
    const f = fakes();
    const t = createOnlineTransport({ supabase: f.supabase, api: f.api });
    await expect(t.connect(gm)).resolves.toBe(STATE);
    expect(f.setAuth).toHaveBeenCalledWith('tok1');
    expect(f.channelFn).toHaveBeenCalledWith(`campaign:${CAMPAIGN}:gm`, { config: { private: true } });
    expect(f.log).toEqual(['channel', 'subscribe', `get /api/state?campaignId=${CAMPAIGN}`]);
  });

  it('jogador assina o canal do próprio personagem', async () => {
    const f = fakes();
    await createOnlineTransport({ supabase: f.supabase, api: f.api }).connect(player);
    expect(f.channelFn.mock.calls[0][0]).toBe(`campaign:${CAMPAIGN}:player:c1`);
  });

  it('repassa os broadcasts update aos ouvintes', async () => {
    const f = fakes();
    const t = createOnlineTransport({ supabase: f.supabase, api: f.api });
    const got: ProjectedUpdate[] = [];
    t.onUpdate((u) => got.push(u));
    await t.connect(gm);
    const update = { seq: 4 } as unknown as ProjectedUpdate;
    f.emit(update);
    expect(got).toEqual([update]);
  });

  it('send posta campaignId e comando; resync busca o estado de novo', async () => {
    const f = fakes();
    const t = createOnlineTransport({ supabase: f.supabase, api: f.api });
    await t.connect(gm);
    const command = { type: 'nextTurn' } as never;
    await t.send(command);
    expect(f.api.post).toHaveBeenCalledWith('/api/command', { campaignId: CAMPAIGN, command });
    await expect(t.resync()).resolves.toBe(STATE);
    expect(f.api.get).toHaveBeenCalledTimes(2);
  });

  it('TOKEN_REFRESHED atualiza a auth do Realtime', async () => {
    const f = fakes();
    await createOnlineTransport({ supabase: f.supabase, api: f.api }).connect(gm);
    f.auth('TOKEN_REFRESHED', 'tok2');
    expect(f.setAuth).toHaveBeenLastCalledWith('tok2');
    f.auth('SIGNED_IN', 'tok3');
    expect(f.setAuth).toHaveBeenCalledTimes(2);
  });

  it('rejeita quando a assinatura não conclui em 10 s e não busca o estado', async () => {
    const f = fakes({ subscribeStatus: null });
    const t = createOnlineTransport({ supabase: f.supabase, api: f.api });
    const assertion = expect(t.connect(gm)).rejects.toThrow('Não foi possível conectar à mesa.');
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(f.api.get).not.toHaveBeenCalled();
    expect(f.removeChannel).toHaveBeenCalledTimes(1);
  });

  it('rejeita quando o canal dá erro', async () => {
    const f = fakes({ subscribeStatus: 'CHANNEL_ERROR' });
    const t = createOnlineTransport({ supabase: f.supabase, api: f.api });
    await expect(t.connect(gm)).rejects.toThrow('Não foi possível conectar à mesa.');
    expect(f.api.get).not.toHaveBeenCalled();
  });

  it('rejeita sem sessão de autenticação ou sem cliente Supabase', async () => {
    const f = fakes({ token: null });
    await expect(createOnlineTransport({ supabase: f.supabase, api: f.api }).connect(gm)).rejects.toThrow();
    await expect(createOnlineTransport({ supabase: null }).connect(gm)).rejects.toThrow();
  });

  it('close remove o canal e cancela a inscrição de auth', async () => {
    const f = fakes();
    const t = createOnlineTransport({ supabase: f.supabase, api: f.api });
    await t.connect(gm);
    t.close();
    expect(f.removeChannel).toHaveBeenCalledTimes(1);
    expect(f.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
