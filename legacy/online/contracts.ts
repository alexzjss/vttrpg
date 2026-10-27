export type CampaignRole = 'gm' | 'player';

export interface OnlineSession {
  accountId: string;
  campaignId: string;
  campaignSlug: string;
  username: string;
  role: CampaignRole;
  characterId: string | null;
  expiresAt: string;
}

export interface LoginInput { campaign: string; username: string; password: string }
export interface LoginResult { token: string; session: OnlineSession }

export type ActionRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'resolved';

export interface PlayerActionRequest {
  id: string;
  campaignId: string;
  encounterId: string;
  actorCharacterId: string;
  actionId: string;
  targetIds: string[];
  payload: Record<string, unknown>;
  status: ActionRequestStatus;
  createdAt: string;
  decidedAt: string | null;
}
