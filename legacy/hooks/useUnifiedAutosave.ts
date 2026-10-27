import { useCallback, useEffect, useRef } from 'react';
import type { AppSnapshot } from '../utils/database';
import { DatabaseService } from '../utils/database';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface Options {
  enabled: boolean;
  snapshot: AppSnapshot | null;
  onStatus: (status: AutosaveStatus) => void;
  debounceMs?: number;
  safetyIntervalMs?: number;
  saveOnChange?: boolean;
}

/**
 * Persiste sempre o snapshot mais recente, serializa gravações concorrentes e
 * faz flush por alteração, intervalo de segurança e saída da página.
 */
export function useUnifiedAutosave({
  enabled,
  snapshot,
  onStatus,
  debounceMs = 1400,
  safetyIntervalMs = 30_000,
  saveOnChange = true,
}: Options) {
  const latest = useRef(snapshot);
  const revision = useRef(0);
  const savedRevision = useRef(-1);
  const inFlight = useRef<Promise<void> | null>(null);
  const statusTimer = useRef<number | null>(null);

  useEffect(() => {
    latest.current = snapshot;
    revision.current += 1;
  }, [snapshot]);

  const setTransientStatus = useCallback((status: AutosaveStatus) => {
    onStatus(status);
    if (statusTimer.current !== null) window.clearTimeout(statusTimer.current);
    if (status === 'saved' || status === 'error') {
      statusTimer.current = window.setTimeout(() => onStatus('idle'), status === 'saved' ? 2200 : 3200);
    }
  }, [onStatus]);

  const flush = useCallback(async (force = false) => {
    if (!enabled || !latest.current) return;
    if (inFlight.current) {
      await inFlight.current;
      if (!force && savedRevision.current === revision.current) return;
    }
    if (!force && savedRevision.current === revision.current) return;

    const task = (async () => {
      setTransientStatus('saving');
      try {
        do {
          const targetRevision = revision.current;
          const current = latest.current;
          if (!current) return;
          await DatabaseService.saveFullSnapshot({ ...current, savedAt: new Date().toISOString() }, { notify: false });
          savedRevision.current = targetRevision;
        } while (savedRevision.current !== revision.current);
        setTransientStatus('saved');
      } catch (error) {
        console.error('[Autosave] Erro:', error);
        setTransientStatus('error');
        throw error;
      }
    })();
    inFlight.current = task;
    try { await task; } finally { if (inFlight.current === task) inFlight.current = null; }
  }, [enabled, setTransientStatus]);

  useEffect(() => {
    if (!saveOnChange || !enabled || !snapshot) return;
    const timer = window.setTimeout(() => { void flush().catch(() => {}); }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [saveOnChange, enabled, snapshot, debounceMs, flush]);

  useEffect(() => {
    if (!enabled) return;
    const interval = window.setInterval(() => { void flush().catch(() => {}); }, safetyIntervalMs);
    const onVisibility = () => { if (document.visibilityState === 'hidden') void flush().catch(() => {}); };
    const onPageHide = () => { void flush().catch(() => {}); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      if (statusTimer.current !== null) window.clearTimeout(statusTimer.current);
    };
  }, [enabled, safetyIntervalMs, flush]);

  return { saveNow: () => flush(true) };
}
