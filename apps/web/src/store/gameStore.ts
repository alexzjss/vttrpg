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
import { LOAD_FAILED, SESSION_CHANGED_MESSAGE } from '../net/protocol';
import type { Session, Transport } from '../net/transport';

/** Fila de cues sem consumidor (ex.: aba sem tabletop) não cresce sem limite. */
const MAX_CUES = 50;

interface GameStore {
  status: 'idle' | 'connecting' | 'ready' | 'error';
  state: ProjectedState | null;
  cues: Array<{ id: number; cue: Cue }>;
  lastError: ErrorCode | null;
  /** A campanha salva não pôde ser lida (worker em modo de falha). */
  loadFailed: boolean;
  /** O token compartilhado entre abas não bate com a sessão desta aba. */
  sessionChanged: boolean;
  connect(t: Transport, s: Session): Promise<void>;
  /** Solta assinaturas e zera o estado. Não fecha o transporte: quem o criou é dono dele. */
  disconnect(): void;
  /** Reinicia a campanha (só o mestre); se a conexão falhou, reconecta em seguida. */
  resetCampaign(): Promise<void>;
  send(cmd: Command): Promise<CommandResult>; // grava lastError se falhar
  takeCues(): Cue[]; // devolve e limpa a fila
}

const isLoadFailed = (e: unknown) => e instanceof Error && e.message === LOAD_FAILED;
const isSessionChanged = (e: unknown) => e instanceof Error && e.message === SESSION_CHANGED_MESSAGE;
const failure = (e: unknown) => ({ status: 'error' as const, loadFailed: isLoadFailed(e), sessionChanged: isSessionChanged(e) });

export function createGameStore() {
  // Única conexão vigente. Um connect/resync/send de transporte superado é descartado.
  let currentTransport: Transport | null = null;
  let currentSession: Session | null = null;
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
      } catch (e) {
        if (currentTransport === t) set(failure(e));
      } finally {
        resyncing = false;
      }
    }

    function onUpdate(t: Transport, u: ProjectedUpdate) {
      const { state } = get();
      if (!state || resyncing) return;
      if (u.seq <= state.seq) return; // já refletido (ex.: snapshot mais novo)
      if (u.seq !== state.seq + 1) {
        void resync(t); // lacuna real: descarta os cues do update e refaz o estado
        return;
      }
      const cues = [...get().cues, ...u.cues.map((cue) => ({ id: ++cueId, cue }))];
      set({
        state: applyChanges(state, u.changes, u.seq),
        cues: cues.length > MAX_CUES ? cues.slice(cues.length - MAX_CUES) : cues,
      });
    }

    return {
      status: 'idle',
      state: null,
      cues: [],
      lastError: null,
      loadFailed: false,
      sessionChanged: false,
      async connect(t, s) {
        dropSubscriptions();
        currentTransport = t;
        currentSession = s;
        set({ status: 'connecting', lastError: null, loadFailed: false, sessionChanged: false });
        let state: ProjectedState;
        try {
          state = await t.connect(s);
        } catch (e) {
          if (currentTransport === t) set(failure(e));
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
        currentSession = null;
        set({ status: 'idle', state: null, cues: [], lastError: null, loadFailed: false, sessionChanged: false });
      },
      async resetCampaign() {
        const t = currentTransport;
        const s = currentSession;
        if (!t || !s) return;
        t.reset(); // mensagens de uma porta são serializadas: o connect abaixo vê a campanha nova
        if (get().status === 'error') await get().connect(t, s);
      },
      async send(cmd) {
        const t = currentTransport;
        if (!t) return { ok: false, error: 'not_found' };
        let result: CommandResult;
        try {
          result = await t.send(cmd);
        } catch (e) {
          if (currentTransport === t) set(failure(e));
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
