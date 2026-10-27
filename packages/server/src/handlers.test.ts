import { describe, expect, it } from 'vitest';
import { createCampaign, defaultResources, type Character, type CampaignState } from '@vtt/core';
import type { Identity } from './auth';
import type { AuthAdmin } from './authAdmin';
import { slugFromName } from './handlers/campaigns';
import type { ApiRequest, ServerDeps } from './http';
import { MemoryStore } from './memoryStore';
import type { AccountRow, AccountsRepo, CampaignRow, CampaignsRepo } from './repos';
import { route } from './router';

const C1 = '00000000-0000-4000-8000-000000000001';
const C2 = '00000000-0000-4000-8000-000000000002';
const C3 = '00000000-0000-4000-8000-000000000003';
const GM_ID = 'gm-user';
const ANA_ID = 'ana-user';
const base = { portrait: '', fullBodyArt: '', tokenImage: '', speed: 5 };
const pc = (id: string, name: string): Character => ({
  id, kind: 'pc', name, hpVisibility: 'exact', resources: defaultResources(), ...base,
});
const npc: Character = { id: 'n1', kind: 'npc', name: 'Orc', hpVisibility: 'hidden', resources: defaultResources(), ...base };

function world() {
  const accounts: AccountRow[] = [
    { id: GM_ID, username: 'mestre', role: 'gm', campaignId: null, characterId: null, active: true },
    { id: ANA_ID, username: 'ana', role: 'player', campaignId: C1, characterId: 'p1', active: true },
  ];
  const campaigns: CampaignRow[] = [];
  const snapshots: Array<{ row: CampaignRow; state: unknown }> = [];
  const adminCalls: string[] = [];
  const users: Array<{ email: string; password: string; meta: Record<string, unknown> }> = [];
  const store = new MemoryStore();
  const state: CampaignState = createCampaign(C1, 'Mesa');
  state.characters = { p1: pc('p1', 'Ana'), p2: pc('p2', 'Bia'), n1: npc };
  store.seed(state);
  store.seed(createCampaign(C2, 'Outra'));
  const forced: { insert?: 'gm_exists' } = {};
  let n = 0;
  const reservedSlugs = new Set<string>();

  const db: AccountsRepo & CampaignsRepo = {
    getById: async (id) => accounts.find((a) => a.id === id) ?? null,
    getByUsername: async (u) => accounts.find((a) => a.username === u) ?? null,
    findPlayerByCharacter: async (c, ch) =>
      accounts.find((a) => a.role === 'player' && a.campaignId === c && a.characterId === ch) ?? null,
    listByCampaign: async (c) => accounts.filter((a) => a.campaignId === c),
    hasGm: async () => accounts.some((a) => a.role === 'gm'),
    insert: async (row) => {
      if (forced.insert) return forced.insert;
      accounts.push(row);
      return 'ok';
    },
    setActive: async (id, active) => { accounts.find((a) => a.id === id)!.active = active; },
    list: async () => campaigns,
    create: async (row, initial) => {
      if (reservedSlugs.has(row.slug)) return 'slug_taken';
      reservedSlugs.add(row.slug);
      campaigns.push(row);
      snapshots.push({ row, state: initial });
      return 'ok';
    },
  };
  const admin: AuthAdmin = {
    createUser: async (email, password, meta) => {
      users.push({ email, password, meta });
      return `user-${users.length}`;
    },
    updatePassword: async (id, pw) => { adminCalls.push(`pw:${id}:${pw}`); },
    setBanned: async (id, banned) => { adminCalls.push(`ban:${id}:${banned}`); },
    deleteUser: async (id) => { adminCalls.push(`del:${id}`); },
  };
  const identify: ServerDeps['identify'] = async (req) => {
    const id = (req.headers['authorization'] ?? '').replace('Bearer ', '');
    const row = accounts.find((a) => a.id === id);
    if (!row || !row.active) return null;
    const who: Identity = {
      userId: row.id, username: row.username, role: row.role,
      campaignId: row.campaignId, characterId: row.characterId, active: row.active,
    };
    return who;
  };
  const deps: ServerDeps = {
    env: { SUPABASE_URL: 'http://fake', SUPABASE_SECRET_KEY: 'k', SETUP_TOKEN: 'tok-123' },
    store, identify, admin, db, newId: () => `id${++n}`,
  };
  return { deps, accounts, campaigns, snapshots, adminCalls, users, reservedSlugs, store, forced };
}

const call = (
  deps: ServerDeps, method: string, path: string, as: string | null,
  opts: { query?: Record<string, string>; body?: unknown } = {},
) => {
  const req: ApiRequest = {
    method, path, query: opts.query ?? {}, headers: as ? { authorization: `Bearer ${as}` } : {}, body: opts.body,
  };
  return route(req, deps);
};

describe('identidade e /api/me', () => {
  it('sem token 401; com token devolve o perfil', async () => {
    const { deps } = world();
    expect(await call(deps, 'GET', '/api/me', null)).toEqual({ status: 401, body: { error: 'unauthorized' } });
    expect(await call(deps, 'GET', '/api/me', ANA_ID)).toEqual({
      status: 200, body: { username: 'ana', role: 'player', campaignId: C1, characterId: 'p1' },
    });
  });

  it('conta inativa recebe 401', async () => {
    const w = world();
    w.accounts.find((a) => a.id === ANA_ID)!.active = false;
    expect((await call(w.deps, 'GET', '/api/me', ANA_ID)).status).toBe(401);
    expect((await call(w.deps, 'GET', '/api/state', ANA_ID, { query: { campaignId: C1 } })).status).toBe(401);
  });
});

describe('GET /api/state', () => {
  it('jogador vê a própria campanha, projetada (sem NPC oculto)', async () => {
    const { deps } = world();
    const res = await call(deps, 'GET', '/api/state', ANA_ID, { query: { campaignId: C1 } });
    expect(res.status).toBe(200);
    const text = JSON.stringify(res.body);
    expect(text).toContain('Ana');
    expect(text).not.toContain('Orc');
  });

  it('jogador pedindo outra campanha recebe 403', async () => {
    const { deps } = world();
    expect(await call(deps, 'GET', '/api/state', ANA_ID, { query: { campaignId: C2 } })).toEqual({
      status: 403, body: { error: 'forbidden' },
    });
  });

  it('GM lê qualquer campanha; inexistente dá 404; sem campaignId dá 400', async () => {
    const { deps } = world();
    expect((await call(deps, 'GET', '/api/state', GM_ID, { query: { campaignId: C2 } })).status).toBe(200);
    expect((await call(deps, 'GET', '/api/state', GM_ID, { query: { campaignId: C3 } })).status).toBe(404);
    expect((await call(deps, 'GET', '/api/state', GM_ID)).status).toBe(400);
  });
});

describe('POST /api/command', () => {
  it('type fora da lista dá 400 bad_command', async () => {
    const { deps } = world();
    const res = await call(deps, 'POST', '/api/command', GM_ID, {
      body: { campaignId: C1, command: { type: 'dropTables' } },
    });
    expect(res).toEqual({ status: 400, body: { error: 'bad_command' } });
    expect((await call(deps, 'POST', '/api/command', GM_ID, { body: { campaignId: C1 } })).status).toBe(400);
  });

  it('jogador mandando startEncounter recebe 200 {ok:false,error:not_gm}', async () => {
    const { deps } = world();
    const res = await call(deps, 'POST', '/api/command', ANA_ID, {
      body: { campaignId: C1, command: { type: 'startEncounter', entries: [] } },
    });
    expect(res).toEqual({ status: 200, body: { ok: false, error: 'not_gm' } });
  });

  it('jogador em outra campanha recebe 403; sem token 401', async () => {
    const { deps } = world();
    const body = { campaignId: C2, command: { type: 'nextTurn' } };
    expect((await call(deps, 'POST', '/api/command', ANA_ID, { body })).status).toBe(403);
    expect((await call(deps, 'POST', '/api/command', null, { body })).status).toBe(401);
  });

  it('GM executa um comando e o resultado vem em 200', async () => {
    const { deps } = world();
    const res = await call(deps, 'POST', '/api/command', GM_ID, {
      body: { campaignId: C1, command: { type: 'nextTurn' } },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: false, error: 'no_encounter' });
  });
});

describe('campanhas', () => {
  it('só GM lista e cria (jogador 403)', async () => {
    const { deps } = world();
    expect((await call(deps, 'GET', '/api/campaigns', ANA_ID)).status).toBe(403);
    expect((await call(deps, 'POST', '/api/campaigns', ANA_ID, { body: { name: 'X' } })).status).toBe(403);
    expect((await call(deps, 'GET', '/api/campaigns', null)).status).toBe(401);
  });

  it('cria campanha + snapshot inicial de revisão 0 e lista', async () => {
    const w = world();
    const res = await call(w.deps, 'POST', '/api/campaigns', GM_ID, { body: { name: '  A Maldição de Strahd  ' } });
    expect(res.status).toBe(200);
    const { campaign } = res.body as { campaign: CampaignRow };
    expect(campaign).toMatchObject({ name: 'A Maldição de Strahd', slug: 'a-maldicao-de-strahd' });
    const snap = w.snapshots[0]!.state as CampaignState;
    expect(snap.campaignId).toBe(campaign.id);
    expect(snap.revision).toBe(0);
    expect((await call(w.deps, 'GET', '/api/campaigns', GM_ID)).body).toEqual({ campaigns: [campaign] });
    expect((await call(w.deps, 'POST', '/api/campaigns', GM_ID, { body: { name: '  ' } })).status).toBe(400);
  });

  it('colisão de slug acrescenta sufixo aleatório curto', async () => {
    const w = world();
    w.reservedSlugs.add('mesa');
    const res = await call(w.deps, 'POST', '/api/campaigns', GM_ID, { body: { name: 'Mesa' } });
    const { campaign } = res.body as { campaign: CampaignRow };
    expect(campaign.slug).toMatch(/^mesa-[a-z0-9]{1,4}$/);
  });

  it('slugFromName gera ASCII com hífens entre 3 e 49 caracteres', () => {
    expect(slugFromName('Ação & Sombras!')).toBe('acao-sombras');
    expect(slugFromName('!!')).toBe('campanha');
    expect(slugFromName('x'.repeat(100)).length).toBeLessThanOrEqual(40);
  });
});

describe('contas', () => {
  const body = (over: Record<string, unknown> = {}) => ({
    campaignId: C1, username: 'Bia', password: 'segredo1', characterId: 'p2', ...over,
  });

  it('só GM; jogador recebe 403', async () => {
    const { deps } = world();
    expect((await call(deps, 'GET', '/api/accounts', ANA_ID, { query: { campaignId: C1 } })).status).toBe(403);
    expect((await call(deps, 'POST', '/api/accounts', ANA_ID, { body: body() })).status).toBe(403);
    expect((await call(deps, 'PATCH', '/api/accounts', ANA_ID, { body: { id: ANA_ID, active: false } })).status).toBe(403);
  });

  it('lista sem campos de senha', async () => {
    const { deps } = world();
    const res = await call(deps, 'GET', '/api/accounts', GM_ID, { query: { campaignId: C1 } });
    expect(res.body).toEqual({ accounts: [{ id: ANA_ID, username: 'ana', characterId: 'p1', active: true }] });
    expect(JSON.stringify(res.body)).not.toMatch(/password|senha/i);
  });

  it('cria jogador com app_metadata exato e e-mail sintético', async () => {
    const w = world();
    const res = await call(w.deps, 'POST', '/api/accounts', GM_ID, { body: body() });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ account: { id: 'user-1', username: 'bia', characterId: 'p2', active: true } });
    expect(JSON.stringify(res.body)).not.toContain('segredo1');
    expect(w.users[0]).toEqual({
      email: 'bia@vtt.local', password: 'segredo1',
      meta: { account_role: 'player', campaign_id: C1, character_id: 'p2' },
    });
  });

  it('valida senha, usuário, campanha e personagem', async () => {
    const { deps } = world();
    expect((await call(deps, 'POST', '/api/accounts', GM_ID, { body: body({ password: '12345' }) })).status).toBe(400);
    expect((await call(deps, 'POST', '/api/accounts', GM_ID, { body: body({ username: 'a b' }) })).status).toBe(400);
    expect((await call(deps, 'POST', '/api/accounts', GM_ID, { body: body({ campaignId: C3 }) })).status).toBe(404);
    expect((await call(deps, 'POST', '/api/accounts', GM_ID, { body: body({ characterId: 'n1' }) })).status).toBe(400);
    expect((await call(deps, 'POST', '/api/accounts', GM_ID, { body: body({ characterId: 'zzz' }) })).status).toBe(400);
    expect((await call(deps, 'POST', '/api/accounts', GM_ID, { body: body({ campaignId: C2, characterId: 'p1' }) })).status).toBe(400);
  });

  it('usuário em uso e PC já com conta dão 409', async () => {
    const w = world();
    expect(await call(w.deps, 'POST', '/api/accounts', GM_ID, { body: body({ username: 'ana' }) })).toEqual({
      status: 409, body: { error: 'username_taken' },
    });
    expect(await call(w.deps, 'POST', '/api/accounts', GM_ID, { body: body({ characterId: 'p1' }) })).toEqual({
      status: 409, body: { error: 'character_taken' },
    });
    expect(w.users).toHaveLength(0);
  });

  it('active:false bane e desativa; reativar desbane; senha vai ao admin', async () => {
    const w = world();
    expect((await call(w.deps, 'PATCH', '/api/accounts', GM_ID, { body: { id: ANA_ID, active: false } })).status).toBe(200);
    expect(w.accounts.find((a) => a.id === ANA_ID)!.active).toBe(false);
    expect((await call(w.deps, 'GET', '/api/me', ANA_ID)).status).toBe(401);
    await call(w.deps, 'PATCH', '/api/accounts', GM_ID, { body: { id: ANA_ID, active: true, password: 'novasenha' } });
    expect(w.adminCalls).toEqual([`ban:${ANA_ID}:true`, `pw:${ANA_ID}:novasenha`, `ban:${ANA_ID}:false`]);
    expect(w.accounts.find((a) => a.id === ANA_ID)!.active).toBe(true);
  });

  it('PATCH valida: senha curta 400, id desconhecido 404, conta GM 403', async () => {
    const { deps } = world();
    expect((await call(deps, 'PATCH', '/api/accounts', GM_ID, { body: { id: ANA_ID, password: 'abc' } })).status).toBe(400);
    expect((await call(deps, 'PATCH', '/api/accounts', GM_ID, { body: { id: 'nope', active: false } })).status).toBe(404);
    expect((await call(deps, 'PATCH', '/api/accounts', GM_ID, { body: { id: GM_ID, active: false } })).status).toBe(403);
  });
});

describe('POST /api/setup', () => {
  const fresh = () => {
    const w = world();
    w.accounts.splice(0, w.accounts.length);
    return w;
  };
  const sb = (over: Record<string, unknown> = {}) => ({ token: 'tok-123', username: 'Mestre', password: 'segredo1', ...over });

  it('token errado ou ausente dá 403 e não cria nada', async () => {
    const w = fresh();
    expect((await call(w.deps, 'POST', '/api/setup', null, { body: sb({ token: 'errado' }) })).status).toBe(403);
    expect((await call(w.deps, 'POST', '/api/setup', null, { body: sb({ token: undefined }) })).status).toBe(403);
    w.deps.env.SETUP_TOKEN = undefined;
    expect((await call(w.deps, 'POST', '/api/setup', null, { body: sb({ token: '' }) })).status).toBe(403);
    expect(w.users).toHaveLength(0);
  });

  it('cria o GM com claims exatas e não roda duas vezes', async () => {
    const w = fresh();
    const res = await call(w.deps, 'POST', '/api/setup', null, { body: sb() });
    expect(res).toEqual({ status: 200, body: { ok: true, username: 'mestre' } });
    expect(w.users[0]).toEqual({ email: 'mestre@vtt.local', password: 'segredo1', meta: { account_role: 'gm' } });
    expect(w.accounts[0]).toMatchObject({ role: 'gm', username: 'mestre', campaignId: null });
    expect(await call(w.deps, 'POST', '/api/setup', null, { body: sb({ username: 'outro' }) })).toEqual({
      status: 409, body: { error: 'already_setup' },
    });
    expect(w.users).toHaveLength(1);
  });

  it('valida usuário e senha', async () => {
    const w = fresh();
    expect((await call(w.deps, 'POST', '/api/setup', null, { body: sb({ password: '123' }) })).status).toBe(400);
    expect((await call(w.deps, 'POST', '/api/setup', null, { body: sb({ username: '!' }) })).status).toBe(400);
  });
});

describe('configuração do roteador', () => {
  it('sem Supabase tudo menos health dá 503, inclusive setup', async () => {
    const { deps } = world();
    deps.env = {};
    expect((await call(deps, 'POST', '/api/setup', null, { body: {} })).status).toBe(503);
    expect((await call(deps, 'GET', '/api/me', ANA_ID)).status).toBe(503);
    expect((await call(deps, 'GET', '/api/health', null)).status).toBe(200);
  });
});

describe('payloads malformados', () => {
  it('moveToken com cell não numérica ou ausente dá 400 bad_command e nada é gravado', async () => {
    const w = world();
    for (const to of [{ col: 'x', row: 1 }, undefined]) {
      const res = await call(w.deps, 'POST', '/api/command', ANA_ID, {
        body: { campaignId: C1, command: { type: 'moveToken', tokenId: 't', to } },
      });
      expect(res).toEqual({ status: 400, body: { error: 'bad_command' } });
    }
    expect(w.store.commits).toHaveLength(0);
  });

  it('campaignId que não é UUID dá 400 bad_campaign', async () => {
    const { deps } = world();
    const bad = { error: 'bad_campaign' };
    expect(await call(deps, 'GET', '/api/state', GM_ID, { query: { campaignId: "x' or 1=1" } })).toEqual({ status: 400, body: bad });
    expect(await call(deps, 'POST', '/api/command', GM_ID, {
      body: { campaignId: 'c1', command: { type: 'nextTurn' } },
    })).toEqual({ status: 400, body: bad });
    expect(await call(deps, 'GET', '/api/accounts', GM_ID, { query: { campaignId: 'c1' } })).toEqual({ status: 400, body: bad });
    expect((await call(deps, 'POST', '/api/accounts', GM_ID, {
      body: { campaignId: 'c1', username: 'bia', password: 'segredo1', characterId: 'p2' },
    })).body).toEqual(bad);
  });

  it('setup: violação do índice de GM único vira 409 already_setup e desfaz o usuário', async () => {
    const w = world();
    w.accounts.splice(0, w.accounts.length);
    w.forced.insert = 'gm_exists';
    const res = await call(w.deps, 'POST', '/api/setup', null, {
      body: { token: 'tok-123', username: 'mestre', password: 'segredo1' },
    });
    expect(res).toEqual({ status: 409, body: { error: 'already_setup' } });
    expect(w.adminCalls).toEqual(['del:user-1']);
  });
});
