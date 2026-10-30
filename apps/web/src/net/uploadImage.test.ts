import { describe, expect, it } from 'vitest';
import { createUploadSink } from './imageSink';
import { uploadImage, type UploadApi } from './uploadImage';

function fakeApi() {
  const calls: unknown[] = [];
  const api: UploadApi = {
    requestUploadUrl: async (body) => {
      calls.push(['request', body]);
      return { path: 'c1/a.webp', token: 'tok', publicUrl: 'http://x/c1/a.webp' };
    },
    uploadToSignedUrl: async (path, token, blob) => {
      calls.push(['upload', path, token, blob]);
    },
  };
  return { api, calls };
}

const file = new File(['raw'], 'a.png', { type: 'image/png' });
const blob = new Blob(['webp-data'], { type: 'image/webp' });

describe('uploadImage', () => {
  it('comprime, pede a URL, envia o blob e devolve a URL pública', async () => {
    const { api, calls } = fakeApi();
    const url = await uploadImage(file, 'c1', api, async () => blob);
    expect(url).toBe('http://x/c1/a.webp');
    expect(calls).toEqual([
      ['request', { campaignId: 'c1', contentType: 'image/webp', bytes: blob.size }],
      ['upload', 'c1/a.webp', 'tok', blob],
    ]);
  });

  it('não envia nada se o pedido da URL falhar', async () => {
    const { api, calls } = fakeApi();
    api.requestUploadUrl = async () => {
      throw new Error('bad_asset');
    };
    await expect(uploadImage(file, 'c1', api, async () => blob)).rejects.toThrow('bad_asset');
    expect(calls).toEqual([]);
  });
});

describe('createUploadSink', () => {
  it('é um ImageSink que usa a campanha informada', () => {
    const { api } = fakeApi();
    expect(typeof createUploadSink('c1', api)).toBe('function');
  });
});
