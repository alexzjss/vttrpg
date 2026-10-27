import { describe, expect, it } from 'vitest';
import { hashPassword, parseCookies, tokenHash, verifyPassword } from './security';

describe('online security', () => {
  it('protege e valida senhas sem armazenar texto puro', () => {
    const credentials = hashPassword('senha-segura');
    expect(credentials.hash).not.toContain('senha-segura');
    expect(verifyPassword('senha-segura', credentials.salt, credentials.hash)).toBe(true);
    expect(verifyPassword('senha-errada', credentials.salt, credentials.hash)).toBe(false);
  });

  it('gera hash estável do token e interpreta cookies', () => {
    expect(tokenHash('abc')).toBe(tokenHash('abc'));
    expect(parseCookies('theme=dark; vat_session=a%20b')).toEqual({ theme: 'dark', vat_session: 'a b' });
  });

  it('recusa senha curta', () => expect(() => hashPassword('curta')).toThrow(/8 caracteres/));
});
