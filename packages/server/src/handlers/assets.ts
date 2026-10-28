import { json, type Handler } from '../http';
import { badCampaign, badRequest, isFailure, isRecord, isUuid, requireGm } from './guard';

export const MAX_ASSET_BYTES = 1_500_000;

const EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

const badAsset = () => badRequest('bad_asset');

export const uploadUrl: Handler = async (req, deps) => {
  const who = await requireGm(req, deps);
  if (isFailure(who)) return who;
  const body = isRecord(req.body) ? req.body : {};
  if (!isUuid(body.campaignId)) return badCampaign();
  const { contentType, bytes } = body;
  const ext = typeof contentType === 'string' ? EXTENSIONS[contentType] : undefined;
  if (!ext) return badAsset();
  if (typeof bytes !== 'number' || !Number.isInteger(bytes) || bytes <= 0 || bytes > MAX_ASSET_BYTES) {
    return badAsset();
  }
  const id = deps.newId();
  const path = `${body.campaignId}/${id}.${ext}`;
  const { token } = await deps.assets.createSignedUploadUrl(path);
  await deps.assets.insert({ id, campaignId: body.campaignId, path, kind: 'image', bytes });
  return json(200, { path, token, publicUrl: deps.assets.publicUrl(path) });
};

export const usage: Handler = async (req, deps) => {
  const who = await requireGm(req, deps);
  if (isFailure(who)) return who;
  const campaignId = req.query.campaignId;
  if (!isUuid(campaignId)) return badCampaign();
  return json(200, { bytes: await deps.assets.usage(campaignId) });
};
