import { createHash, timingSafeEqual } from 'node:crypto';
import { emailForUsername } from '@vtt/core';
import { json, type Handler } from '../http';
import { MIN_PASSWORD, USERNAME_RE } from './accounts';
import { badRequest, forbidden, isRecord } from './guard';

/** Comparação em tempo constante (compara os digests, que têm tamanho fixo). */
function tokenMatches(given: string, expected: string): boolean {
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Cria o primeiro GM. Sem Bearer: protegido pelo SETUP_TOKEN e por só valer uma vez. */
export const setup: Handler = async (req, deps) => {
  const expected = deps.env.SETUP_TOKEN;
  const b = req.body;
  if (!isRecord(b)) return badRequest();
  if (!expected || typeof b.token !== 'string' || !tokenMatches(b.token, expected)) return forbidden();
  if (await deps.db.hasGm()) return json(409, { error: 'already_setup' });

  const username = typeof b.username === 'string' ? b.username.trim().toLowerCase() : '';
  if (!USERNAME_RE.test(username)) return badRequest('invalid_username');
  if (typeof b.password !== 'string' || b.password.length < MIN_PASSWORD) return badRequest('weak_password');

  const userId = await deps.admin.createUser(emailForUsername(username), b.password, { account_role: 'gm' });
  let outcome;
  try {
    outcome = await deps.db.insert({
      id: userId, username, role: 'gm', campaignId: null, characterId: null, active: true,
    });
  } catch (err) {
    await deps.admin.deleteUser(userId).catch(() => undefined);
    throw err;
  }
  if (outcome !== 'ok') {
    await deps.admin.deleteUser(userId).catch(() => undefined);
    return json(409, { error: outcome });
  }
  return json(200, { ok: true, username });
};
