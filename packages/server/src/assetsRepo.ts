import type { SupabaseClient } from '@supabase/supabase-js';

export interface AssetRow {
  id: string;
  campaignId: string;
  path: string;
  kind: string;
  bytes: number;
}

export interface AssetsDep {
  insert(row: AssetRow): Promise<void>;
  /** Soma dos bytes das imagens da campanha. */
  usage(campaignId: string): Promise<number>;
  createSignedUploadUrl(path: string): Promise<{ token: string }>;
  publicUrl(path: string): string;
}

const BUCKET = 'assets';

export function createAssetsDep(client: SupabaseClient): AssetsDep {
  return {
    async insert(row) {
      const { error } = await client.from('assets').insert({
        id: row.id, campaign_id: row.campaignId, path: row.path, kind: row.kind, bytes: row.bytes,
      });
      if (error) throw new Error('db_failed');
    },
    async usage(campaignId) {
      const { data, error } = await client.from('assets').select('bytes').eq('campaign_id', campaignId);
      if (error) throw new Error('db_failed');
      return (data as Array<{ bytes: number }>).reduce((sum, r) => sum + r.bytes, 0);
    },
    async createSignedUploadUrl(path) {
      const { data, error } = await client.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error || !data) throw new Error('storage_failed');
      return { token: data.token };
    },
    publicUrl: (path) => client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
  };
}
