import { actorFor } from '../auth';
import { readState } from '../commands';
import { json, type Handler } from '../http';
import { badCampaign, forbidden, isFailure, isUuid, requireIdentity } from './guard';

export const state: Handler = async (req, deps) => {
  const who = await requireIdentity(req, deps);
  if (isFailure(who)) return who;
  const campaignId = req.query.campaignId;
  if (!isUuid(campaignId)) return badCampaign();
  const actor = actorFor(who, campaignId);
  if (!actor) return forbidden();
  const projected = await readState(deps.store, campaignId, actor);
  if (!projected) return json(404, { error: 'not_found' });
  return json(200, { state: projected });
};
