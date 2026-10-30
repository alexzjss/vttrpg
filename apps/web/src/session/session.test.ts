import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, getSession, setSession } from './session';

describe('session', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('grava e lê a sessão', () => {
    expect(setSession({ mode: 'local', actor: { role: 'gm' } })).toBe(true);
    expect(getSession()).toEqual({ mode: 'local', actor: { role: 'gm' } });
    clearSession();
    expect(getSession()).toBeNull();
  });

  it('setSession devolve false quando o storage não deixa gravar', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(setSession({ mode: 'local', actor: { role: 'gm' } })).toBe(false);
  });

  it('getSession trata o formato antigo {role} como inválido', () => {
    sessionStorage.setItem('vtt.session', '{"role":"gm"}');
    expect(getSession()).toBeNull();
  });

  it('guarda e lê sessão online', () => {
    const s = { mode: 'online', actor: { role: 'gm' }, campaignId: 'c1', username: 'ana' } as const;
    expect(setSession(s)).toBe(true);
    expect(getSession()).toEqual(s);
  });

  it('getSession rejeita sessão online sem campanha', () => {
    sessionStorage.setItem('vtt.session', '{"mode":"online","actor":{"role":"gm"},"username":"a"}');
    expect(getSession()).toBeNull();
  });

  it('getSession ignora valor corrompido', () => {
    sessionStorage.setItem('vtt.session', '{"role":"player"}');
    expect(getSession()).toBeNull();
  });
});
