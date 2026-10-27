export interface CampaignAccount {
  id: string;
  username: string;
  role: 'gm' | 'player';
  character_id: string | null;
  active: boolean;
  created_at: string;
}

async function request<T>(init?: RequestInit): Promise<T> {
  const response = await fetch('/api/admin/accounts', {
    ...init, credentials: 'include', headers: TabSession.headers({ 'content-type': 'application/json', ...(init?.headers as Record<string, string> ?? {}) }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Falha ao administrar acessos.');
  return body as T;
}

export const OnlineAccounts = {
  list: () => request<{ accounts: CampaignAccount[] }>(),
  create: (input: { username: string; password: string; characterId: string }) => request<{ account: CampaignAccount }>({ method: 'POST', body: JSON.stringify(input) }),
};
import { TabSession } from './sessionTransport';
