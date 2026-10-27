create extension if not exists pgcrypto;

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,48}$'),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaign_accounts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  username text not null check (username ~ '^[a-z0-9][a-z0-9_-]{2,31}$'),
  password_salt text not null,
  password_hash text not null,
  role text not null check (role in ('gm', 'player')),
  character_id text,
  active boolean not null default true,
  session_version integer not null default 1,
  created_at timestamptz not null default now(),
  unique (campaign_id, username),
  check ((role = 'gm') or (character_id is not null))
);

create unique index one_player_per_character on public.campaign_accounts(campaign_id, character_id)
  where character_id is not null and role = 'player';

create table public.campaign_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.campaign_accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index campaign_sessions_account_idx on public.campaign_sessions(account_id);
create index campaign_sessions_expiry_idx on public.campaign_sessions(expires_at);

create table public.campaign_snapshots (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  snapshot_version integer not null,
  data jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

create table public.action_requests (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  encounter_id text not null,
  account_id uuid not null references public.campaign_accounts(id),
  actor_character_id text not null,
  action_id text not null,
  target_ids jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled','resolved')),
  decided_by uuid references public.campaign_accounts(id),
  decision_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index action_requests_pending_idx on public.action_requests(campaign_id, status, created_at);

alter table public.campaigns enable row level security;
alter table public.campaign_accounts enable row level security;
alter table public.campaign_sessions enable row level security;
alter table public.campaign_snapshots enable row level security;
alter table public.action_requests enable row level security;
revoke all on all tables in schema public from anon, authenticated;
