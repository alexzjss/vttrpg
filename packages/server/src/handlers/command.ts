import { COMMAND_TYPES, type Command } from '@vtt/core';
import { actorFor } from '../auth';
import { processCommand } from '../commands';
import { json, type Handler } from '../http';
import { badRequest, forbidden, isFailure, isRecord, requireIdentity } from './guard';

export const command: Handler = async (req, deps) => {
  const who = await requireIdentity(req, deps);
  if (isFailure(who)) return who;
  const body = req.body;
  if (!isRecord(body) || typeof body.campaignId !== 'string' || !body.campaignId) return badRequest();
  const cmd = body.command;
  if (!isRecord(cmd) || typeof cmd.type !== 'string' || !(COMMAND_TYPES as readonly string[]).includes(cmd.type)) {
    return badRequest('bad_command');
  }
  const actor = actorFor(who, body.campaignId);
  if (!actor) return forbidden();
  const result = await processCommand(deps.store, body.campaignId, actor, cmd as unknown as Command, deps.newId);
  return json(200, result);
};
