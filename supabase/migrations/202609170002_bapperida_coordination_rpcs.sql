-- Transactional BAPPERIDA recommendation and evaluation operations.

create or replace function public.bapperida_actor_allowed(p_actor_id uuid, p_opd_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles profile
    join public.master_opd opd on opd.id = profile.opd_id
    where profile.id = p_actor_id
      and profile.status = 'AKTIF'
      and profile.role = 'INTERVENSI'
      and profile.opd_id = p_opd_id
      and opd.kode_opd = 'BAPPERIDA'
  );
$$;

create or replace function public.bapperida_save_recommendation(
  p_recommendation_id uuid,
  p_expected_version integer,
  p_actor_id uuid,
  p_actor_opd_id uuid,
  p_category text,
  p_finding text,
  p_recommendation text,
  p_recipient_opd_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.bapperida_recommendations%rowtype;
  new_id uuid;
  new_version integer;
  event_kind text;
begin
  if not public.bapperida_actor_allowed(p_actor_id, p_actor_opd_id) then
    raise exception using errcode = '42501', message = 'BAPPERIDA_ACTOR_REQUIRED';
  end if;
  if p_category not in ('CAPAIAN_JALUR', 'SEBARAN_WILAYAH', 'RE_ENTRY', 'INTEGRASI_DATA', 'ANGGARAN', 'OUTCOME')
     or length(trim(coalesce(p_finding, ''))) not between 10 and 3000
     or length(trim(coalesce(p_recommendation, ''))) not between 10 and 3000
     or coalesce(cardinality(p_recipient_opd_ids), 0) = 0
     or exists (
       select 1 from unnest(p_recipient_opd_ids) recipient_id
       where not exists (select 1 from public.master_opd where id = recipient_id and kode_opd <> 'BAPPERIDA')
     ) then
    raise exception using errcode = '23514', message = 'INVALID_RECOMMENDATION_INPUT';
  end if;

  if p_recommendation_id is null then
    insert into public.bapperida_recommendations (
      category, finding, recommendation, status, created_by, updated_by
    ) values (
      p_category, trim(p_finding), trim(p_recommendation), 'DRAFT', p_actor_id, p_actor_id
    ) returning id, version into new_id, new_version;
    event_kind := 'DRAFT_SAVED';
  else
    select * into current_row from public.bapperida_recommendations
    where id = p_recommendation_id for update;
    if not found then raise exception using errcode = 'P0002', message = 'RECOMMENDATION_NOT_FOUND'; end if;
    if current_row.status not in ('DRAFT', 'PERLU_REVISI') then
      raise exception using errcode = '23505', message = 'RECOMMENDATION_NOT_EDITABLE';
    end if;
    if p_expected_version is null or current_row.version <> p_expected_version then
      raise exception using errcode = '40001', message = 'RECOMMENDATION_VERSION_CONFLICT';
    end if;
    update public.bapperida_recommendations set
      category = p_category,
      finding = trim(p_finding),
      recommendation = trim(p_recommendation),
      version = version + 1,
      updated_by = p_actor_id
    where id = current_row.id
    returning id, version into new_id, new_version;
    event_kind := case when current_row.status = 'PERLU_REVISI' then 'REVISION_SAVED' else 'DRAFT_SAVED' end;
  end if;

  delete from public.bapperida_recommendation_recipients where recommendation_id = new_id;
  insert into public.bapperida_recommendation_recipients(recommendation_id, opd_id)
  select new_id, recipient_id from (select distinct unnest(p_recipient_opd_ids) recipient_id) recipients;
  insert into public.bapperida_recommendation_events(
    recommendation_id, event_type, from_status, to_status, version, actor_user_id
  ) values (
    new_id, event_kind, current_row.status, coalesce(current_row.status, 'DRAFT'), new_version, p_actor_id
  );
  return jsonb_build_object('recommendationId', new_id, 'status', coalesce(current_row.status, 'DRAFT'), 'version', new_version);
end;
$$;

create or replace function public.bapperida_submit_recommendation(
  p_recommendation_id uuid,
  p_expected_version integer,
  p_actor_id uuid,
  p_actor_opd_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.bapperida_recommendations%rowtype;
  new_version integer;
begin
  if not public.bapperida_actor_allowed(p_actor_id, p_actor_opd_id) then
    raise exception using errcode = '42501', message = 'BAPPERIDA_ACTOR_REQUIRED';
  end if;
  select * into current_row from public.bapperida_recommendations
  where id = p_recommendation_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'RECOMMENDATION_NOT_FOUND'; end if;
  if current_row.status not in ('DRAFT', 'PERLU_REVISI') then
    raise exception using errcode = '23505', message = 'RECOMMENDATION_NOT_SUBMITTABLE';
  end if;
  if p_expected_version is null or current_row.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'RECOMMENDATION_VERSION_CONFLICT';
  end if;
  if not exists (
    select 1 from public.bapperida_recommendation_recipients where recommendation_id = current_row.id
  ) then raise exception using errcode = '23514', message = 'RECOMMENDATION_RECIPIENT_REQUIRED'; end if;

  update public.bapperida_recommendations set
    status = 'MENUNGGU_PERSETUJUAN',
    submitted_at = now(),
    version = version + 1,
    updated_by = p_actor_id
  where id = current_row.id returning version into new_version;
  insert into public.bapperida_recommendation_events(
    recommendation_id, event_type, from_status, to_status, version, actor_user_id
  ) values (
    current_row.id,
    case when current_row.status = 'PERLU_REVISI' then 'RESUBMITTED' else 'SUBMITTED' end,
    current_row.status, 'MENUNGGU_PERSETUJUAN', new_version, p_actor_id
  );
  return jsonb_build_object('recommendationId', current_row.id, 'status', 'MENUNGGU_PERSETUJUAN', 'version', new_version);
end;
$$;

create or replace function public.bapperida_publish_evaluation_snapshot(
  p_actor_id uuid,
  p_actor_opd_id uuid,
  p_period date,
  p_intervention_path text,
  p_independent_citizens integer,
  p_program_success_rate numeric,
  p_reentry_citizens integer,
  p_welfare_index numeric,
  p_path_distribution jsonb,
  p_desil_distribution jsonb,
  p_source_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare snapshot_id uuid;
begin
  if not public.bapperida_actor_allowed(p_actor_id, p_actor_opd_id) then
    raise exception using errcode = '42501', message = 'BAPPERIDA_ACTOR_REQUIRED';
  end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date
     or (p_intervention_path is not null and p_intervention_path not in ('PEKERJA', 'WIRAUSAHA', 'PENGUATAN_DASAR', 'AKSELERASI_SEKTORAL'))
     or p_independent_citizens < 0 or p_reentry_citizens < 0
     or p_program_success_rate not between 0 and 100 or p_welfare_index not between 0 and 100
     or jsonb_typeof(coalesce(p_path_distribution, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_desil_distribution, '{}'::jsonb)) <> 'object'
     or length(trim(coalesce(p_source_digest, ''))) not between 8 and 128 then
    raise exception using errcode = '23514', message = 'INVALID_EVALUATION_SNAPSHOT';
  end if;
  insert into public.bapperida_evaluation_snapshots(
    period, intervention_path, independent_citizens, program_success_rate,
    reentry_citizens, welfare_index, path_distribution, desil_distribution,
    source_digest, status, published_at, created_by
  ) values (
    p_period, p_intervention_path, p_independent_citizens, p_program_success_rate,
    p_reentry_citizens, p_welfare_index, coalesce(p_path_distribution, '{}'::jsonb),
    coalesce(p_desil_distribution, '{}'::jsonb), trim(p_source_digest), 'PUBLISHED', now(), p_actor_id
  ) on conflict (period, intervention_path) do update set
    independent_citizens = excluded.independent_citizens,
    program_success_rate = excluded.program_success_rate,
    reentry_citizens = excluded.reentry_citizens,
    welfare_index = excluded.welfare_index,
    path_distribution = excluded.path_distribution,
    desil_distribution = excluded.desil_distribution,
    source_digest = excluded.source_digest,
    status = 'PUBLISHED', published_at = now(), created_by = excluded.created_by
  returning id into snapshot_id;
  return jsonb_build_object('snapshotId', snapshot_id, 'status', 'PUBLISHED');
end;
$$;

revoke all on function public.bapperida_actor_allowed(uuid, uuid) from public, anon, authenticated;
revoke all on function public.bapperida_save_recommendation(uuid, integer, uuid, uuid, text, text, text, uuid[]) from public, anon, authenticated;
revoke all on function public.bapperida_submit_recommendation(uuid, integer, uuid, uuid) from public, anon, authenticated;
revoke all on function public.bapperida_publish_evaluation_snapshot(uuid, uuid, date, text, integer, numeric, integer, numeric, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.bapperida_actor_allowed(uuid, uuid) to service_role;
grant execute on function public.bapperida_save_recommendation(uuid, integer, uuid, uuid, text, text, text, uuid[]) to service_role;
grant execute on function public.bapperida_submit_recommendation(uuid, integer, uuid, uuid) to service_role;
grant execute on function public.bapperida_publish_evaluation_snapshot(uuid, uuid, date, text, integer, numeric, integer, numeric, jsonb, jsonb, text) to service_role;
