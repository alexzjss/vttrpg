import type { Session } from '../net/transport';

const KEY = 'vtt.session'; // sessionStorage: cada aba tem a sua sessão

function isSession(v: unknown): v is Session {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as { role?: unknown; characterId?: unknown };
  if (s.role === 'gm') return true;
  return s.role === 'player' && typeof s.characterId === 'string';
}

export function getSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) ? parsed : null;
  } catch {
    return null; // storage bloqueado ou JSON corrompido
  }
}

export function setSession(s: Session): void {
  sessionStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession(): void {
  sessionStorage.removeItem(KEY);
}

/**
 * Abre a mesa em nova aba sem noopener: o navegador copia o sessionStorage
 * para a aba nova (um link target=_blank comum não copia).
 */
export function abrirMesa(): void {
  window.open('/mesa', '_blank');
}
