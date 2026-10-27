import type { PlayerCampaignView } from './playerView';
import { TabSession } from './sessionTransport';

async function body(response: Response) {
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error || 'Falha na comunicação online.');
  return value;
}

export const PlayerOnline = {
  async state(): Promise<PlayerCampaignView> {
    const response = await fetch('/api/player/state', { credentials: 'same-origin', cache: 'no-store', headers: TabSession.headers() });
    return (await body(response)).view;
  },
  async move(x: number, y: number, expectedRevision: number): Promise<{ position: { x: number; y: number }; revision: number }> {
    const response = await fetch('/api/player/move', { method: 'POST', credentials: 'same-origin', headers: TabSession.headers({ 'content-type': 'application/json' }), body: JSON.stringify({ x, y, expectedRevision }) });
    return body(response);
  },
  async requestAction(actionId: string, targetIds: string[] = [], choiceTargetId?: string, destination?: { x: number; y: number }) {
    const response = await fetch('/api/player/actions', { method: 'POST', credentials: 'same-origin', headers: TabSession.headers({ 'content-type': 'application/json' }), body: JSON.stringify({ actionId, targetIds, choiceTargetId, destination }) });
    return body(response);
  },
  async actionRequests(): Promise<Array<{ id: string; action_id: string; status: string; created_at: string; decided_at: string | null; decision_note?: string | null }>> {
    const response = await fetch('/api/player/actions', { credentials: 'same-origin', cache: 'no-store', headers: TabSession.headers() });
    return (await body(response)).requests;
  },
};
