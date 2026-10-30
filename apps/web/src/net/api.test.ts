import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApi } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('createApi', () => {
  it('envia Bearer e corpo JSON', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const api = createApi(async () => 'tk');
    await expect(api.post('/api/x', { a: 1 })).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledWith('/api/x', {
      method: 'POST',
      headers: { Authorization: 'Bearer tk', 'Content-Type': 'application/json' },
      body: '{"a":1}',
    });
  });

  it('GET sem token não envia Authorization; erro vira ApiError com o código', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    const api = createApi(async () => null);
    await expect(api.get('/api/y')).rejects.toEqual(new ApiError(403, 'forbidden'));
    expect(fetchMock).toHaveBeenCalledWith('/api/y', { method: 'GET', headers: {}, body: undefined });
  });
});
