import type { SupabaseClient } from '@supabase/supabase-js';
import { migrateState } from '@vtt/core';
import type { CampaignStore, CommitInput } from './store';

/** CampaignStore sobre o Supabase; o commit atômico é a função SQL `vtt_commit`. */
export function createSupabaseStore(client: SupabaseClient): CampaignStore {
  return {
    async load(campaignId) {
      const { data, error } = await client
        .from('snapshots')
        .select('revision,state')
        .eq('campaign_id', campaignId)
        .maybeSingle();
      if (error) throw new Error('store_failed');
      if (!data) return null;
      // A coluna `revision` é a autoritativa.
      const state = migrateState({ ...(data.state as object), revision: data.revision });
      if (!state) throw new Error('store_failed');
      return state;
    },

    async commit(input: CommitInput) {
      const { data, error } = await client.rpc('vtt_commit', {
        p_campaign: input.campaignId,
        p_expected: input.expectedRevision,
        p_state: input.state,
        p_actor: input.actor,
        p_command: input.command,
        p_events: input.events,
        p_broadcasts: input.broadcasts,
      });
      if (error) throw new Error('store_failed');
      if (data === true) return 'ok';
      if (data === false) return 'conflict';
      throw new Error('store_failed');
    },
  };
}
