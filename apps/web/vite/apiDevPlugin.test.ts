// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createDeps } from '../../../packages/server/src/deps';
import { createDevDepsProvider } from './apiDevPlugin';

const keys = ['env', 'store', 'identify', 'admin', 'db', 'assets', 'newId'];

describe('createDevDepsProvider', () => {
  it('monta ServerDeps completos com createDeps e reaproveita o cache', async () => {
    let loads = 0;
    const provider = createDevDepsProvider(
      async () => {
        loads++;
        return { createDeps };
      },
      { SUPABASE_URL: 'http://fake.invalid', SUPABASE_SECRET_KEY: 'fake-secret', SETUP_TOKEN: 'fake' },
    );
    const deps = (await provider()) as Record<string, unknown>;
    for (const k of keys) expect(deps).toHaveProperty(k);
    expect(await provider()).toBe(deps);
    expect(loads).toBe(1);
  });

  it('sem Supabase devolve stubs com todas as chaves', async () => {
    const provider = createDevDepsProvider(async () => ({ createDeps }), {});
    const deps = (await provider()) as Record<string, unknown>;
    for (const k of keys) expect(deps).toHaveProperty(k);
  });
});
