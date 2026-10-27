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
  send(cmd: Command): Promise<CommandResult>; // grava lastError se falhar
  takeCues(): Cue[]; // devolve e limpa a fila
}

export function createGameStore() {
  let transport: Transport | null = null;
  let unsubscribe: (() => void) | null = null;
  let unsubscribeSnapshot: (() => void) | null = null;
  let resyncing = false;
  let cueId = 0;

  return create<GameStore>((set, get) => {
    async function resync(t: Transport) {
      if (resyncing) return;
      resyncing = true;
      try {
        set({ state: await t.resync() });
      } catch {
        set({ status: 'error' });
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
        unsubscribe?.();
        unsubscribeSnapshot?.();
        transport = t;
        set({ status: 'connecting', lastError: null });
        try {
          const state = await t.connect(s);
          unsubscribe = t.onUpdate((u) => onUpdate(t, u));
          unsubscribeSnapshot = t.onSnapshot((snap) => set({ state: snap, cues: [] }));
          set({ state, status: 'ready' });
        } catch {
          set({ status: 'error' });
        }
      },
      async send(cmd) {
        if (!transport) return { ok: false, error: 'not_found' };
        let result: CommandResult;
        try {
          result = await transport.send(cmd);
        } catch (e) {
          set({ status: 'error' });
          throw e;
        }
        if (!result.ok) set({ lastError: result.error });
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
