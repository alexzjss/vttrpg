import type { SupabaseClient } from '@supabase/supabase-js';
import {
  actorAudience,
  topicFor,
  type Command,
  type CommandResult,
  type ProjectedState,
  type ProjectedUpdate,
} from '@vtt/core';
import { createApi, type Api } from './api';
import { getSupabase } from './supabase';
import type { Session, Transport } from './transport';

export const SUBSCRIBE_TIMEOUT_MS = 10_000;
export const CONNECT_FAILED_MESSAGE = 'Não foi possível conectar à mesa.';

interface Deps {
  supabase?: SupabaseClient | null;
  api?: Api;
}

type Channel = ReturnType<SupabaseClient['channel']>;

/** Realtime (canal privado por audiência) para receber; HTTP para estado e comandos. */
export function createOnlineTransport(deps: Deps = {}): Transport {
  const supabase = deps.supabase === undefined ? getSupabase() : deps.supabase;
  const listeners = new Set<(u: ProjectedUpdate) => void>();
  const snapshotListeners = new Set<(s: ProjectedState) => void>();
  let channel: Channel | null = null;
  let authSub: { unsubscribe(): void } | null = null;
  let subscribeTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  let campaignId = '';
  let api: Api | null = deps.api ?? null;
  // Updates recebidos antes de existir ouvinte (o store só registra depois do connect).
  let buffered: ProjectedUpdate[] | null = [];

  const requireClient = (): SupabaseClient => {
    if (!supabase) throw new Error(CONNECT_FAILED_MESSAGE);
    return supabase;
  };
  const requireApi = (): Api => {
    if (!api) throw new Error('Transporte online usado antes de conectar.');
    return api;
  };
  const fetchState = async (): Promise<ProjectedState> => {
    const { state } = await requireApi().get<{ state: ProjectedState }>(
      `/api/state?campaignId=${encodeURIComponent(campaignId)}`,
    );
    return state;
  };
  const dispatch = (u: ProjectedUpdate) => {
    if (buffered && listeners.size === 0) buffered.push(u);
    else listeners.forEach((l) => l(u));
  };

  function subscribe(client: SupabaseClient, topic: string): Promise<void> {
    const ch = client.channel(topic, { config: { private: true } });
    channel = ch;
    ch.on('broadcast', { event: 'update' }, ({ payload }) => dispatch(payload as ProjectedUpdate));
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        if (subscribeTimer) clearTimeout(subscribeTimer);
        subscribeTimer = null;
        fn();
      };
      subscribeTimer = setTimeout(
        () => settle(() => reject(new Error(CONNECT_FAILED_MESSAGE))),
        SUBSCRIBE_TIMEOUT_MS,
      );
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') settle(resolve);
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          settle(() => reject(new Error(CONNECT_FAILED_MESSAGE)));
        }
      });
    });
  }

  function releaseChannel() {
    if (subscribeTimer) clearTimeout(subscribeTimer);
    subscribeTimer = null;
    authSub?.unsubscribe();
    authSub = null;
    if (channel && supabase) void supabase.removeChannel(channel);
    channel = null;
  }

  const abortIfClosed = () => {
    if (!closed) return;
    releaseChannel();
    throw new Error(CONNECT_FAILED_MESSAGE);
  };

  return {
    async connect(session: Session) {
      if (session.mode !== 'online') throw new Error(CONNECT_FAILED_MESSAGE);
      const client = requireClient();
      campaignId = session.campaignId;
      api ??= createApi(async () => (await client.auth.getSession()).data.session?.access_token ?? null);
      const { data } = await client.auth.getSession();
      abortIfClosed();
      const token = data.session?.access_token;
      if (!token) throw new Error(CONNECT_FAILED_MESSAGE);
      client.realtime.setAuth(token);
      const { data: sub } = client.auth.onAuthStateChange((event, s) => {
        if (event === 'TOKEN_REFRESHED' && s) client.realtime.setAuth(s.access_token);
      });
      authSub = sub.subscription;
      try {
        await subscribe(client, topicFor(campaignId, actorAudience(session.actor)));
        abortIfClosed();
        // Assinou antes de buscar: o que chegar durante o GET fica no buffer até o store ouvir.
        const state = await fetchState();
        abortIfClosed();
        return state;
      } catch (e) {
        releaseChannel();
        throw e;
      }
    },
    onUpdate(listener) {
      listeners.add(listener);
      if (buffered) {
        const pending = buffered;
        buffered = null;
        pending.forEach((u) => listener(u));
      }
      return () => listeners.delete(listener);
    },
    onSnapshot(listener) {
      snapshotListeners.add(listener);
      return () => snapshotListeners.delete(listener);
    },
    reset() {
      // sem reset remoto nesta fase
    },
    send(cmd: Command): Promise<CommandResult> {
      return requireApi().post<CommandResult>('/api/command', { campaignId, command: cmd });
    },
    resync: fetchState,
    close() {
      closed = true;
      releaseChannel();
    },
  };
}
