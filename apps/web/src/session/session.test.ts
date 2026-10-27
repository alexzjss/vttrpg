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
    expect(setSession({ role: 'gm' })).toBe(true);
    expect(getSession()).toEqual({ role: 'gm' });
    clearSession();
    expect(getSession()).toBeNull();
  });

  it('setSession devolve false quando o storage não deixa gravar', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(setSession({ role: 'gm' })).toBe(false);
  });

  it('getSession ignora valor corrompido', () => {
    sessionStorage.setItem('vtt.session', '{"role":"player"}');
    expect(getSession()).toBeNull();
  });
});
