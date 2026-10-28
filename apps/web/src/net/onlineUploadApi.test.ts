import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createOnlineUploadApi } from './onlineUploadApi';

afterEach(() => vi.unstubAllGlobals());

function fakeSupabase(uploadError: Error | null = null) {
  const uploadToSignedUrl = vi.fn(async () => ({ error: uploadError }));
  const from = vi.fn(() => ({ uploadToSignedUrl }));
  const supabase = {
    auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'tk' } } })) },
    storage: { from },
  } as unknown as SupabaseClient;
  return { supabase, from, uploadToSignedUrl };
}

describe('createOnlineUploadApi', () => {
  it('pede a URL assinada com Bearer', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ path: 'p', token: 't', publicUrl: 'u' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const body = { campaignId: 'c', contentType: 'image/webp', bytes: 5 };
    const r = await createOnlineUploadApi(fakeSupabase().supabase).requestUploadUrl(body);
    expect(r).toEqual({ path: 'p', token: 't', publicUrl: 'u' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/assets/upload-url');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tk' });
    expect(init.body).toBe(JSON.stringify(body));
  });

  it('envia ao bucket assets e propaga erro do Storage', async () => {
    const f = fakeSupabase();
    const blob = new Blob(['x']);
    await createOnlineUploadApi(f.supabase).uploadToSignedUrl('p', 't', blob);
    expect(f.from).toHaveBeenCalledWith('assets');
    expect(f.uploadToSignedUrl).toHaveBeenCalledWith('p', 't', blob);
    const bad = fakeSupabase(new Error('falhou'));
    await expect(createOnlineUploadApi(bad.supabase).uploadToSignedUrl('p', 't', blob)).rejects.toThrow('falhou');
  });
});
