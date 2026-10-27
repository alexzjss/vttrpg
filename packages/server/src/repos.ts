import type { SupabaseClient } from '@supabase/supabase-js';

export interface AccountRow {
  id: string;
  username: string;
  role: 'gm' | 'player';
  campaignId: string | null;
  characterId: string | null;
  active: boolean;
}

export type InsertAccountResult = 'ok' | 'username_taken' | 'character_taken';

export interface AccountsRepo {
  getById(id: string): Promise<AccountRow | null>;
  getByUsername(username: string): Promise<AccountRow | null>;
  findPlayerByCharacter(campaignId: string, characterId: string): Promise<AccountRow | null>;
  listByCampaign(campaignId: string): Promise<AccountRow[]>;
  hasGm(): Promise<boolean>;
  insert(row: AccountRow): Promise<InsertAccountResult>;
  setActive(id: string, active: boolean): Promise<void>;
}

export interface CampaignRow { id: string; name: string; slug: string }

export interface CampaignsRepo {
  list(): Promise<CampaignRow[]>;
  /** Grava a campanha e o snapshot inicial (revisão 0); 'slug_taken' se o slug já existe. */
  create(row: CampaignRow, initialState: unknown): Promise<'ok' | 'slug_taken'>;
}

const UNIQUE_VIOLATION = '23505';
const ACCOUNT_COLUMNS = 'id,username,role,campaign_id,character_id,active';

interface DbAccount {
  id: string; username: string; role: 'gm' | 'player';
  campaign_id: string | null; character_id: string | null; active: boolean;
}

function toRow(r: DbAccount): AccountRow {
  return {
    id: r.id, username: r.username, role: r.role,
    campaignId: r.campaign_id, characterId: r.character_id, active: r.active,
  };
}

export function createAccountsRepo(client: SupabaseClient): AccountsRepo {
  async function byColumn(column: string, value: string): Promise<AccountRow | null> {
    const { data, error } = await client
      .from('accounts').select(ACCOUNT_COLUMNS).eq(column, value).limit(1).maybeSingle();
    if (error) throw new Error('db_failed');
    return data ? toRow(data as DbAccount) : null;
  }

  return {
    getById: (id) => byColumn('id', id),
    getByUsername: (username) => byColumn('username', username),
    async findPlayerByCharacter(campaignId, characterId) {
      const { data, error } = await client
        .from('accounts').select(ACCOUNT_COLUMNS)
        .eq('campaign_id', campaignId).eq('character_id', characterId).eq('role', 'player')
        .limit(1).maybeSingle();
      if (error) throw new Error('db_failed');
      return data ? toRow(data as DbAccount) : null;
    },
    async listByCampaign(campaignId) {
      const { data, error } = await client
        .from('accounts').select(ACCOUNT_COLUMNS).eq('campaign_id', campaignId).order('username');
      if (error) throw new Error('db_failed');
      return (data as DbAccount[]).map(toRow);
    },
    async hasGm() {
      const { data, error } = await client.from('accounts').select('id').eq('role', 'gm').limit(1);
      if (error) throw new Error('db_failed');
      return data.length > 0;
    },
    async insert(row) {
      const { error } = await client.from('accounts').insert({
        id: row.id, username: row.username, role: row.role,
        campaign_id: row.campaignId, character_id: row.characterId, active: row.active,
      });
      if (!error) return 'ok';
      if (error.code !== UNIQUE_VIOLATION) throw new Error('db_failed');
      return `${error.message} ${error.details ?? ''}`.includes('username') ? 'username_taken' : 'character_taken';
    },
    async setActive(id, active) {
      const { error } = await client.from('accounts').update({ active }).eq('id', id);
      if (error) throw new Error('db_failed');
    },
  };
}

export function createCampaignsRepo(client: SupabaseClient): CampaignsRepo {
  return {
    async list() {
      const { data, error } = await client.from('campaigns').select('id,name,slug').order('created_at');
      if (error) throw new Error('db_failed');
      return data as CampaignRow[];
    },
    async create(row, initialState) {
      const ins = await client.from('campaigns').insert({ id: row.id, name: row.name, slug: row.slug });
      if (ins.error) {
        if (ins.error.code === UNIQUE_VIOLATION) return 'slug_taken';
        throw new Error('db_failed');
      }
      const snap = await client.from('snapshots').insert({ campaign_id: row.id, revision: 0, state: initialState });
      if (snap.error) {
        await client.from('campaigns').delete().eq('id', row.id);
        throw new Error('db_failed');
      }
      return 'ok';
    },
  };
}
