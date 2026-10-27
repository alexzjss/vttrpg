import type { AppSnapshot } from '../utils/database';
import { TabSession } from './sessionTransport';

async function responseJson(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Falha na comunicação online.');
  return body;
}
export interface StoredSnapshot { snapshot_version: number; data: AppSnapshot; revision: number; updated_at: string }
export const OnlineCampaign = {
  load: async (): Promise<StoredSnapshot | null> => {
    const response = await fetch('/api/campaign/snapshot', { credentials: 'include', cache: 'no-store', headers: TabSession.headers() });
    return (await responseJson(response)).snapshot ?? null;
  },
  save: async (data: AppSnapshot, expectedRevision: number) => {
    const response = await fetch('/api/campaign/snapshot', { method: 'PUT', credentials: 'include', headers: TabSession.headers({ 'content-type': 'application/json' }), body: JSON.stringify({ data, snapshotVersion: data.version, expectedRevision }) });
    return responseJson(response) as Promise<{ revision: number; updatedAt: string }>;
  },
};
