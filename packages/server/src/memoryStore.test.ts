import { describe, expect, it } from 'vitest';
import { createCampaign } from '@vtt/core';
import { MemoryStore } from './memoryStore';

describe('MemoryStore.load', () => {
  it('migra um estado v1 semeado para v2', async () => {
    const { version: _v, settings: _s, log: _l, requests: _r, ...v1 } = createCampaign('c1', 'Mesa');
    const store = new MemoryStore();
    store.seed(v1 as never);
    expect(await store.load('c1')).toMatchObject({ version: 2, settings: { requireApproval: false } });
  });
  it('lança store_failed quando o estado é malformado', async () => {
    const store = new MemoryStore();
    store.seed({ campaignId: 'c1' } as never);
    await expect(store.load('c1')).rejects.toThrow('store_failed');
  });
  it('devolve null quando não existe', async () => {
    expect(await new MemoryStore().load('x')).toBeNull();
  });
});
