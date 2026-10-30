import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { CORE_VERSION } from '@vtt/core';
import { MAX_BODY_BYTES, type ServerEnv } from './http';
import { createDeps } from './deps';
import { toNodeHandler } from './nodeAdapter';

let server: Server | undefined;

async function start(env: ServerEnv = {}): Promise<string> {
  const s = createServer(toNodeHandler(() => createDeps(env)));
  server = s;
  await new Promise<void>((resolve) => s.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
}

const configured: ServerEnv = { SUPABASE_URL: 'http://fake.local', SUPABASE_SECRET_KEY: 'fake-secret' };

afterEach(async () => {
  const s = server;
  server = undefined;
  if (s) await new Promise((resolve) => s.close(resolve));
});

describe('api http', () => {
  it('rota desconhecida dá 404', async () => {
    const base = await start(configured);
    const res = await fetch(`${base}/api/nada`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('health dá 200 com a versão do core, mesmo sem configuração', async () => {
    const base = await start();
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, core: CORE_VERSION });
  });

  it('sem Supabase configurado, o resto responde 503', async () => {
    const base = await start();
    const res = await fetch(`${base}/api/nada`);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'online_not_configured' });
  });

  it('JSON inválido dá 400', async () => {
    const base = await start(configured);
    const res = await fetch(`${base}/api/health`, { method: 'POST', body: '{oops' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_json' });
  });

  it('corpo acima de 1 MB dá 413', async () => {
    const base = await start(configured);
    const res = await fetch(`${base}/api/health`, {
      method: 'POST',
      body: JSON.stringify({ x: 'a'.repeat(MAX_BODY_BYTES) }),
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'too_large' });
  });
});
