-- VTT online - esquema inicial.
-- Feito para ser colado inteiro no SQL Editor do Supabase de um projeto NOVO.
-- Tabelas, RLS, funcao atomica vtt_commit (grava + transmite via Realtime),
-- politica de leitura em realtime.messages e bucket de storage.
-- Idempotente quando barato (if not exists / on conflict do nothing).

-- ---------------------------------------------------------------- tabelas
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists public.accounts (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9][a-z0-9_-]{2,31}$'),
  role text not null check (role in ('gm', 'player')),
  campaign_id uuid references public.campaigns on delete cascade,
  character_id text,
  active boolean not null default true,
  created_at timestamptz default now(),
  check (role = 'gm' or (campaign_id is not null and character_id is not null))
);

create unique index if not exists accounts_player_character_uniq
  on public.accounts (campaign_id, character_id) where role = 'player';

create table if not exists public.snapshots (
  campaign_id uuid primary key references public.campaigns on delete cascade,
  revision int not null,
  state jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists public.events (
  id bigserial primary key,
  campaign_id uuid references public.campaigns on delete cascade,
  revision int not null,
  actor jsonb,
  command jsonb,
  events jsonb,
  created_at timestamptz default now(),
  unique (campaign_id, revision)
);

create table if not exists public.assets (
  id uuid primary key,
  campaign_id uuid references public.campaigns on delete cascade,
  path text not null,
  kind text check (kind in ('image', 'audio')),
  bytes int not null,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------------- RLS
-- Ligada e sem politicas: so o servidor (chave secreta / service_role) acessa.
alter table public.campaigns enable row level security;
alter table public.accounts  enable row level security;
alter table public.snapshots enable row level security;
alter table public.events    enable row level security;
alter table public.assets    enable row level security;

-- ------------------------------------------------------------ vtt_commit
-- Grava o novo estado se a revisao ainda for a esperada (controle otimista),
-- registra o evento e transmite cada broadcast no mesmo commit.
create or replace function public.vtt_commit(
  p_campaign uuid,
  p_expected int,
  p_state jsonb,
  p_actor jsonb,
  p_command jsonb,
  p_events jsonb,
  p_broadcasts jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int;
  v_elem jsonb;
begin
  update public.snapshots
     set state = p_state,
         revision = p_expected + 1,
         updated_at = now()
   where campaign_id = p_campaign
     and revision = p_expected;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return false;
  end if;

  insert into public.events (campaign_id, revision, actor, command, events)
  values (p_campaign, p_expected + 1, p_actor, p_command, p_events);

  for v_elem in select value from jsonb_array_elements(coalesce(p_broadcasts, '[]'::jsonb))
  loop
    perform realtime.send(v_elem->'payload', 'update', v_elem->>'topic', true);
  end loop;

  return true;
end;
$$;

revoke execute on function public.vtt_commit(uuid, int, jsonb, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.vtt_commit(uuid, int, jsonb, jsonb, jsonb, jsonb, jsonb)
  to service_role;

-- ------------------------------------------------- Realtime (canais privados)
-- Clientes so leem (nunca publicam): sem politica de insert.
drop policy if exists "vtt_read_own_topics" on realtime.messages;
create policy "vtt_read_own_topics"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and exists (
      select 1 from public.accounts a where a.id = auth.uid() and a.active
    )
    and (
      (
        (auth.jwt()->'app_metadata'->>'account_role') = 'gm'
        and realtime.topic() like 'campaign:%:gm'
      )
      or realtime.topic() = 'campaign:' || (auth.jwt()->'app_metadata'->>'campaign_id')
                            || ':player:' || (auth.jwt()->'app_metadata'->>'character_id')
    )
  );

-- ---------------------------------------------------------------- storage
-- Leitura publica; sem politica de escrita para anon/authenticated
-- (uploads apenas por URL assinada emitida pelo servidor).
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict do nothing;
