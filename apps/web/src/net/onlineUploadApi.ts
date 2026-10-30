import type { SupabaseClient } from '@supabase/supabase-js';
import { createApi } from './api';
import type { UploadApi } from './uploadImage';

export const ASSETS_BUCKET = 'assets';

/** Liga o upload de imagens à API (URL assinada) e ao Storage do Supabase. */
export function createOnlineUploadApi(supabase: SupabaseClient): UploadApi {
  const api = createApi(async () => (await supabase.auth.getSession()).data.session?.access_token ?? null);
  return {
    requestUploadUrl: (body) =>
      api.post<{ path: string; token: string; publicUrl: string }>('/api/assets/upload-url', body),
    async uploadToSignedUrl(path, token, blob) {
      const { error } = await supabase.storage.from(ASSETS_BUCKET).uploadToSignedUrl(path, token, blob);
      if (error) throw error;
    },
  };
}
