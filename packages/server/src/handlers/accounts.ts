import { emailForUsername } from '@vtt/core';
import { json, type Handler } from '../http';
import { badRequest, forbidden, isFailure, isRecord, requireGm } from './guard';

export const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{2,31}$/;
export const MIN_PASSWORD = 6;

export const listAccounts: Handler = async (req, deps) => {
  const who = await requireGm(req, deps);
  if (isFailure(who)) return who;
  const campaignId = req.query.campaignId;
  if (!campaignId) return badRequest();
  const rows = await deps.db.listByCampaign(campaignId);
  return json(200, {
    accounts: rows.map((a) => ({ id: a.id, username: a.username, characterId: a.characterId, active: a.active })),
  });
};

export const createAccount: Handler = async (req, deps) => {
  const who = await requireGm(req, deps);
  if (isFailure(who)) return who;
  const b = req.body;
  if (!isRecord(b) || typeof b.campaignId !== 'string' || typeof b.characterId !== 'string') return badRequest();
  const username = typeof b.username === 'string' ? b.username.trim().toLowerCase() : '';
  if (!USERNAME_RE.test(username)) return badRequest('invalid_username');
  if (typeof b.password !== 'string' || b.password.length < MIN_PASSWORD) return badRequest('weak_password');
  const { campaignId, characterId, password } = { campaignId: b.campaignId, characterId: b.characterId, password: b.password };

  const campaign = await deps.store.load(campaignId);
  if (!campaign) return json(404, { error: 'not_found' });
  if (campaign.characters[characterId]?.kind !== 'pc') return badRequest('invalid_character');

  if (await deps.db.getByUsername(username)) return json(409, { error: 'username_taken' });
  if (await deps.db.findPlayerByCharacter(campaignId, characterId)) return json(409, { error: 'character_taken' });

  const userId = await deps.admin.createUser(emailForUsername(username), password, {
    account_role: 'player', campaign_id: campaignId, character_id: characterId,
  });
  let outcome;
  try {
    outcome = await deps.db.insert({ id: userId, username, role: 'player', campaignId, characterId, active: true });
  } catch (err) {
    await deps.admin.deleteUser(userId).catch(() => undefined);
    throw err;
  }
  if (outcome !== 'ok') {
    await deps.admin.deleteUser(userId).catch(() => undefined);
    return json(409, { error: outcome });
  }
  return json(200, { account: { id: userId, username, characterId, active: true } });
};

export const patchAccount: Handler = async (req, deps) => {
  const who = await requireGm(req, deps);
  if (isFailure(who)) return who;
  const b = req.body;
  if (!isRecord(b) || typeof b.id !== 'string') return badRequest();
  if (b.active !== undefined && typeof b.active !== 'boolean') return badRequest();
  if (b.password !== undefined && (typeof b.password !== 'string' || b.password.length < MIN_PASSWORD)) {
    return badRequest('weak_password');
  }
  const target = await deps.db.getById(b.id);
  if (!target) return json(404, { error: 'not_found' });
  if (target.role === 'gm') return forbidden();

  if (typeof b.password === 'string') await deps.admin.updatePassword(target.id, b.password);
  if (typeof b.active === 'boolean') {
    await deps.admin.setBanned(target.id, !b.active);
    await deps.db.setActive(target.id, b.active);
  }
  return json(200, { ok: true });
};
