import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuthAdmin {
  createUser(email: string, password: string, appMetadata: Record<string, unknown>): Promise<string>;
  updatePassword(userId: string, password: string): Promise<void>;
  setBanned(userId: string, banned: boolean): Promise<void>;
  /** Desfaz um createUser quando a gravação da conta falha depois. */
  deleteUser(userId: string): Promise<void>;
}

/** Duração longa o bastante para valer como "banido para sempre". */
const BAN_FOREVER = '876000h';

export function createAuthAdmin(client: SupabaseClient): AuthAdmin {
  const admin = client.auth.admin;
  return {
    async createUser(email, password, appMetadata) {
      const { data, error } = await admin.createUser({
        email, password, email_confirm: true, app_metadata: appMetadata,
      });
      if (error || !data.user) throw new Error('auth_admin_failed');
      return data.user.id;
    },
    async updatePassword(userId, password) {
      const { error } = await admin.updateUserById(userId, { password });
      if (error) throw new Error('auth_admin_failed');
    },
    async setBanned(userId, banned) {
      const { error } = await admin.updateUserById(userId, { ban_duration: banned ? BAN_FOREVER : 'none' });
      if (error) throw new Error('auth_admin_failed');
    },
    async deleteUser(userId) {
      const { error } = await admin.deleteUser(userId);
      if (error) throw new Error('auth_admin_failed');
    },
  };
}
