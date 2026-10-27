import { isWellFormedCommand } from '@vtt/core';
import { actorFor } from '../auth';
import { processCommand } from '../commands';
import { json, type Handler } from '../http';
import { badCampaign, badRequest, forbidden, isFailure, isRecord, isUuid, requireIdentity } from './guard';

export const command: Handler = async (req, deps) => {
  const who = await requireIdentity(req, deps);
  if (isFailure(who)) return who;
  const body = req.body;
  if (!isRecord(body)) return badRequest();
  const campaignId = body.campaignId;
  if (!isUuid(campaignId)) return badCampaign();
  const cmd = body.command;
  if (!isWellFormedCommand(cmd)) return badRequest('bad_command');
  const actor = actorFor(who, campaignId);
  if (!actor) return forbidden();
  return json(200, await processCommand(deps.store, campaignId, actor, cmd, deps.newId));
};
