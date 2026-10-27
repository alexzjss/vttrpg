const KEY = 'vat_tab_session';

export const TabSession = {
  get: () => typeof window === 'undefined' ? null : window.sessionStorage.getItem(KEY),
  set: (token: string) => { if (typeof window !== 'undefined') window.sessionStorage.setItem(KEY, token); },
  clear: () => { if (typeof window !== 'undefined') window.sessionStorage.removeItem(KEY); },
  headers(extra: Record<string, string> = {}): Record<string, string> {
    const token = this.get();
    return { ...extra, ...(token ? { 'x-vat-session': token } : {}) };
  },
};
