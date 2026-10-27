import type { LoginInput, LoginResult, OnlineSession } from './contracts';
import { TabSession } from './sessionTransport';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: TabSession.headers({ 'content-type': 'application/json', ...(init?.headers as Record<string, string> ?? {}) }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Não foi possível concluir a solicitação.');
  return body as T;
}

export const OnlineAuth = {
  login: async (input: LoginInput) => { const result = await request<LoginResult>('/api/auth/login', { method: 'POST', body: JSON.stringify(input) }); TabSession.set(result.token); return result; },
  session: () => request<{ session: OnlineSession | null }>('/api/auth/session'),
  logout: async () => { try { return await request<{ ok: true }>('/api/auth/logout', { method: 'POST', body: '{}' }); } finally { TabSession.clear(); } },
};
