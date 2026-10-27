import { json, type Handler } from '../http';
import { isFailure, requireIdentity } from './guard';

export const me: Handler = async (req, deps) => {
  const who = await requireIdentity(req, deps);
  if (isFailure(who)) return who;
  return json(200, {
    username: who.username, role: who.role, campaignId: who.campaignId, characterId: who.characterId,
  });
};
