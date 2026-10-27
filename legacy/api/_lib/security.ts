import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  if (password.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
  return { salt, hash: scryptSync(password, salt, KEY_LENGTH).toString('hex') };
}

export function verifyPassword(password: string, salt: string, expectedHex: string): boolean {
  const actual = scryptSync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const newSessionToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

export function parseCookies(header?: string): Record<string, string> {
  return Object.fromEntries((header ?? '').split(';').map(v => v.trim()).filter(Boolean).map(v => {
    const at = v.indexOf('=');
    return [decodeURIComponent(v.slice(0, at)), decodeURIComponent(v.slice(at + 1))];
  }));
}

export function sessionCookie(token: string, maxAge = 60 * 60 * 24 * 7): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `vat_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}
