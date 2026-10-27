create or replace function public.save_campaign_snapshot(
  p_campaign_id uuid, p_expected_revision bigint, p_snapshot_version integer, p_data jsonb
)
returns table(revision bigint, updated_at timestamptz)
language plpgsql security invoker set search_path = public
as $$
declare v_current bigint;
begin
  select s.revision into v_current from public.campaign_snapshots s
  where s.campaign_id = p_campaign_id for update;
  if not found then
    if p_expected_revision <> 0 then raise exception 'revision_conflict'; end if;
    return query insert into public.campaign_snapshots(campaign_id, snapshot_version, data, revision)
      values (p_campaign_id, p_snapshot_version, p_data, 1)
      returning campaign_snapshots.revision, campaign_snapshots.updated_at;
    return;
  end if;
  if v_current <> p_expected_revision then raise exception 'revision_conflict'; end if;
  return query update public.campaign_snapshots
    set snapshot_version = p_snapshot_version, data = p_data,
        revision = campaign_snapshots.revision + 1, updated_at = now()
    where campaign_id = p_campaign_id
    returning campaign_snapshots.revision, campaign_snapshots.updated_at;
end;
$$;

revoke all on function public.save_campaign_snapshot(uuid,bigint,integer,jsonb) from public, anon, authenticated;
grant execute on function public.save_campaign_snapshot(uuid,bigint,integer,jsonb) to service_role;
