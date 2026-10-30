import { describe, expect, it } from 'vitest';
import { actorFor, bearerToken, createIdentify, type Identity } from './auth';
import type { ApiRequest } from './http';
import type { AccountRow, AccountsRepo } from './repos';

const req = (authorization?: string): ApiRequest => ({
  method: 'GET', path: '/api/me', query: {}, headers: authorization ? { authorization } : {}, body: undefined,
});

const row = (over: Partial<AccountRow> = {}): AccountRow => ({
  id: 'u1', username: 'ana', role: 'player', campaignId: 'c1', characterId: 'p1', active: true, ...over,
});

function fakeClient(sub: string | null) {
  return {
    auth: {
      getClaims: async (token: string) =>
        sub && token === 'good'
          ? { data: { claims: { sub } }, error: null }
          : { data: null, error: new Error('invalid') },
    },
  } as never;
}

const repoWith = (rows: AccountRow[]): AccountsRepo =>
  ({ getById: async (id: string) => rows.find((r) => r.id === id) ?? null }) as unknown as AccountsRepo;

describe('bearerToken', () => {
  it('extrai o token e ignora formatos inválidos', () => {
    expect(bearerToken(req('Bearer abc'))).toBe('abc');
    expect(bearerToken(req('bearer abc'))).toBe('abc');
    expect(bearerToken(req('Basic abc'))).toBeNull();
    expect(bearerToken(req())).toBeNull();
  });
});

describe('identify', () => {
  it('token válido + conta ativa vira Identity', async () => {
    const identify = createIdentify(fakeClient('u1'), repoWith([row()]));
    expect(await identify(req('Bearer good'))).toEqual({
      userId: 'u1', username: 'ana', role: 'player', campaignId: 'c1', characterId: 'p1', active: true,
    });
  });

  it('sem header, token inválido, sem linha ou conta inativa dá null', async () => {
    const identify = createIdentify(fakeClient('u1'), repoWith([row()]));
    expect(await identify(req())).toBeNull();
    expect(await identify(req('Bearer bad'))).toBeNull();
    expect(await createIdentify(fakeClient('u9'), repoWith([row()]))(req('Bearer good'))).toBeNull();
    expect(await createIdentify(fakeClient('u1'), repoWith([row({ active: false })]))(req('Bearer good'))).toBeNull();
  });
});

describe('actorFor', () => {
  const gm: Identity = { userId: 'g', username: 'gm', role: 'gm', campaignId: null, characterId: null, active: true };
  const player: Identity = { userId: 'u1', username: 'ana', role: 'player', campaignId: 'c1', characterId: 'p1', active: true };

  it('GM atua em qualquer campanha', () => {
    expect(actorFor(gm, 'qualquer')).toEqual({ role: 'gm' });
  });

  it('jogador só na própria campanha, com o próprio personagem', () => {
    expect(actorFor(player, 'c1')).toEqual({ role: 'player', characterId: 'p1' });
    expect(actorFor(player, 'c2')).toBeNull();
  });
});
