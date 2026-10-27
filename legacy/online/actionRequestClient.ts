export interface PendingActionRequest { id: string; actor_character_id: string; action_id: string; actorName: string; actionName: string; targetNames: string[]; created_at: string }
async function body(response: Response) { const value = await response.json().catch(() => ({})); if (!response.ok) throw new Error(value.error || 'Falha na comunicação online.'); return value; }
export const OnlineActionRequests = {
  async list(): Promise<PendingActionRequest[]> { return (await body(await fetch('/api/admin/action-requests', { cache: 'no-store', headers: TabSession.headers() }))).requests; },
  async decide(id: string, status: 'approved' | 'rejected') { return body(await fetch('/api/admin/action-requests', { method: 'PATCH', headers: TabSession.headers({ 'content-type': 'application/json' }), body: JSON.stringify({ id, status }) })); },
};
import { TabSession } from './sessionTransport';
