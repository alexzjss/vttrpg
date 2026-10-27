export interface OnlineConfig { supabaseUrl: string; supabasePublishableKey: string }

export function getOnlineConfig(): OnlineConfig | null {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabaseUrl || !supabasePublishableKey || supabaseUrl.includes('your-project')) return null;
  return { supabaseUrl: supabaseUrl.replace(/\/$/, ''), supabasePublishableKey };
}

export const isOnlineConfigured = (): boolean => getOnlineConfig() !== null;
