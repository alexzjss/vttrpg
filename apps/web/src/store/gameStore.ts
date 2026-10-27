import { create } from 'zustand';
import {
  applyChanges,
  type Command,
  type CommandResult,
  type Cue,
  type ErrorCode,
  type ProjectedState,
  type ProjectedUpdate,
} from '@vtt/core';
import type { Session, Transport } from '../net/transport';

interface GameStore {
  status: 'idle' | 'connecting' | 'ready' | 'error';
  state: ProjectedState | null;
  cues: Array<{ id: number; cue: Cue }>;
  lastError: ErrorCode | null;
  connect(t: Transport, s: Session): Promise<void>;
  /** Solta assinaturas e zera o estado. Não fecha o transporte: quem o criou é dono dele. */
  disconnect(): void;
  send(cmd: Command): Promise<CommandResult>; // grava lastError se falhar
  takeCues(): Cue[]; // devolve e limpa a fila
}

export function createGameStore() {
  // Única conexão vigente. Um connect/resync/send de transporte superado é descartado.
  let currentTransport: Transport | null = null;
  let unsubscribe: (() => void) | null = null;
  let unsubscribeSnapshot: (() => void) | null = null;
  let resyncing = false;
  let cueId = 0;

  const dropSubscriptions = () => {
    unsubscribe?.();
    unsubscribeSnapshot?.();
    unsubscribe = null;
    unsubscribeSnapshot = null;
  };

  return create<GameStore>((set, get) => {
    async function resync(t: Transport) {
      if (resyncing) return;
      resyncing = true;
      try {
        const state = await t.resync();
        if (currentTransport === t) set({ state });
      } catch {
        if (currentTransport === t) set({ status: 'error' });
      } finally {
        resyncing = false;
      }
    }

    function onUpdate(t: Transport, u: ProjectedUpdate) {
      const { state } = get();
      if (!state || resyncing) return;
      if (u.revision !== state.revision + 1) {
        void resync(t); // lacuna: descarta os cues do update e refaz o estado
        return;
      }
      set({
        state: applyChanges(state, u.changes, u.revision),
        cues: [...get().cues, ...u.cues.map((cue) => ({ id: ++cueId, cue }))],
      });
    }

    return {
      status: 'idle',
      state: null,
      cues: [],
      lastError: null,
      async connect(t, s) {
        dropSubscriptions();
        currentTransport = t;
        set({ status: 'connecting', lastError: null });
        let state: ProjectedState;
        try {
          state = await t.connect(s);
        } catch {
          if (currentTransport === t) set({ status: 'error' });
          return;
        }
        if (currentTransport !== t) return; // superado por outro connect ou disconnect
        unsubscribe = t.onUpdate((u) => onUpdate(t, u));
        unsubscribeSnapshot = t.onSnapshot((snap) => {
          if (currentTransport === t) set({ state: snap, cues: [] });
        });
        set({ state, status: 'ready' });
      },
      disconnect() {
        dropSubscriptions();
        currentTransport = null;
        set({ status: 'idle', state: null, cues: [], lastError: null });
      },
      async send(cmd) {
        const t = currentTransport;
        if (!t) return { ok: false, error: 'not_found' };
        let result: CommandResult;
        try {
          result = await t.send(cmd);
        } catch (e) {
          if (currentTransport === t) set({ status: 'error' });
          throw e;
        }
        if (currentTransport === t && !result.ok) set({ lastError: result.error });
        return result;
      },
      takeCues() {
        const taken = get().cues.map((c) => c.cue);
        set({ cues: [] });
        return taken;
      },
    };
  });
}

export const useGame = createGameStore();
