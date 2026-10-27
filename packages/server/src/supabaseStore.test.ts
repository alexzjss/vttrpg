import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseStore } from './supabaseStore';
import { createServiceClient } from './supabaseClient';

interface Call { kind: string; args: unknown[] }

/** Client fake mínimo: grava a cadeia from/select/eq/maybeSingle e as chamadas rpc. */
function fakeClient(result: { data?: unknown; error?: unknown }) {
  const calls: Call[] = [];
  const reply = { data: result.data ?? null, error: result.error ?? null };
  const chain = {
    select: (...args: unknown[]) => { calls.push({ kind: 'select', args }); return chain; },
    eq: (...args: unknown[]) => { calls.push({ kind: 'eq', args }); return chain; },
    maybeSingle: async () => { calls.push({ kind: 'maybeSingle', args: [] }); return reply; },
  };
  const client = {
    from: (...args: unknown[]) => { calls.push({ kind: 'from', args }); return chain; },
    rpc: async (...args: unknown[]) => { calls.push({ kind: 'rpc', args }); return reply; },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const input = {
  campaignId: 'c1',
  expectedRevision: 4,
  state: { revision: 5 },
  actor: { kind: 'gm' },
  command: { type: 'x' },
  events: [{ type: 'e' }],
  broadcasts: [{ topic: 'campaign:c1:gm', payload: { a: 1 } }],
} as never;

describe('createSupabaseStore', () => {
  it('load seleciona em snapshots por campaign_id e usa a revisão da coluna', async () => {
    const { client, calls } = fakeClient({ data: { revision: 7, state: { campaignId: 'c1', revision: 3 } } });
    const state = await createSupabaseStore(client).load('c1');
    expect(calls.find((c) => c.kind === 'from')?.args).toEqual(['snapshots']);
    expect(calls.find((c) => c.kind === 'eq')?.args).toEqual(['campaign_id', 'c1']);
    expect(state).toEqual({ campaignId: 'c1', revision: 7 });
  });

  it('load devolve null quando não há snapshot', async () => {
    const { client } = fakeClient({});
    expect(await createSupabaseStore(client).load('c1')).toBeNull();
  });

  it('load lança store_failed em erro do client', async () => {
    const { client } = fakeClient({ error: { message: 'boom' } });
    await expect(createSupabaseStore(client).load('c1')).rejects.toThrow('store_failed');
  });

  it('commit chama rpc vtt_commit com os parâmetros exatos e mapeia true para ok', async () => {
    const { client, calls } = fakeClient({ data: true });
    expect(await createSupabaseStore(client).commit(input)).toBe('ok');
    expect(calls.find((c) => c.kind === 'rpc')?.args).toEqual([
      'vtt_commit',
      {
        p_campaign: 'c1',
        p_expected: 4,
        p_state: { revision: 5 },
        p_actor: { kind: 'gm' },
        p_command: { type: 'x' },
        p_events: [{ type: 'e' }],
        p_broadcasts: [{ topic: 'campaign:c1:gm', payload: { a: 1 } }],
      },
    ]);
  });

  it('commit mapeia false para conflict', async () => {
    const { client } = fakeClient({ data: false });
    expect(await createSupabaseStore(client).commit(input)).toBe('conflict');
  });

  it('commit lança store_failed em erro do client', async () => {
    const { client } = fakeClient({ error: { message: 'boom' } });
    await expect(createSupabaseStore(client).commit(input)).rejects.toThrow('store_failed');
  });
});

describe('createServiceClient', () => {
  it('lança erro claro sem SUPABASE_URL ou SUPABASE_SECRET_KEY', () => {
    expect(() => createServiceClient({ SUPABASE_SECRET_KEY: 'k' })).toThrow(/SUPABASE_URL/);
    expect(() => createServiceClient({ SUPABASE_URL: 'http://x.test' })).toThrow(/SUPABASE_SECRET_KEY/);
  });
});
