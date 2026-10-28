import type { Actor } from '@vtt/core';
import type { Session } from '../net/transport';

const KEY = 'vtt.session'; // sessionStorage: cada aba tem a sua sessão

function isActor(v: unknown): v is Actor {
  if (typeof v !== 'object' || v === null) return false;
  const a = v as { role?: unknown; characterId?: unknown };
  if (a.role === 'gm') return true;
  return a.role === 'player' && typeof a.characterId === 'string';
}

// Formato antigo da Fase 1 ({role}) cai em false: a pessoa entra de novo.
function isSession(v: unknown): v is Session {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as { mode?: unknown; actor?: unknown; campaignId?: unknown; username?: unknown };
  if (!isActor(s.actor)) return false;
  if (s.mode === 'local') return true;
  return s.mode === 'online' && typeof s.campaignId === 'string' && typeof s.username === 'string';
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

/** Devolve false se o navegador não deixou gravar (storage bloqueado ou cheio). */
export function setSession(s: Session): boolean {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // storage indisponível: nada a limpar
  }
}

/**
 * Abre a mesa em nova aba sem noopener: o navegador copia o sessionStorage
 * para a aba nova (um link target=_blank comum não copia).
 */
export function openTableWindow(): void {
  window.open('/mesa', '_blank');
}
