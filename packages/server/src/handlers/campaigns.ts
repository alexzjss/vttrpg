import { createCampaign } from '@vtt/core';
import { json, type Handler } from '../http';
import { badRequest, isFailure, isRecord, requireGm } from './guard';

const MAX_NAME = 80;
const MAX_SLUG = 49;
const SLUG_ATTEMPTS = 5;

/** Minúsculas, ASCII, hífens; 3 a 40 caracteres (deixa folga para o sufixo aleatório). */
export function slugFromName(name: string): string {
  const base = name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40).replace(/-+$/g, '');
  return base.length >= 3 ? base : 'campanha';
}

export const listCampaigns: Handler = async (req, deps) => {
  const who = await requireGm(req, deps);
  if (isFailure(who)) return who;
  return json(200, { campaigns: await deps.db.list() });
};

export const createCampaignHandler: Handler = async (req, deps) => {
  const who = await requireGm(req, deps);
  if (isFailure(who)) return who;
  const name = isRecord(req.body) && typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!name || name.length > MAX_NAME) return badRequest('invalid_name');

  const id = deps.newId();
  const base = slugFromName(name);
  const initial = createCampaign(id, name);
  for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt++) {
    const suffix = attempt === 0 ? '' : `-${deps.newId().replace(/-/g, '').slice(0, 4)}`;
    const slug = `${base}${suffix}`.slice(0, MAX_SLUG);
    const campaign = { id, name, slug };
    if ((await deps.db.create(campaign, initial)) === 'ok') return json(200, { campaign });
  }
  return json(409, { error: 'slug_taken' });
};
