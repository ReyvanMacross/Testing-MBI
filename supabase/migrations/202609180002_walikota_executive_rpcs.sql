-- Transactional executive review of recommendations submitted by Bapperida.

create or replace function public.walikota_actor_allowed(p_actor_id uuid, p_opd_id uuid)
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
      and profile.role = 'WALIKOTA'
      and profile.opd_id = p_opd_id
      and opd.kode_opd = 'WALIKOTA'
  );
$$;

create or replace function public.walikota_review_recommendation(
  p_recommendation_id uuid,
  p_expected_version integer,
  p_actor_id uuid,
  p_actor_opd_id uuid,
  p_action text,
  p_priority_level text,
  p_leader_note text,
  p_dispositions jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.bapperida_recommendations%rowtype;
  v_decision_id uuid;
  new_recommendation_version integer;
  new_status text;
  event_kind text;
begin
  if not public.walikota_actor_allowed(p_actor_id, p_actor_opd_id) then
    raise exception using errcode = '42501', message = 'WALIKOTA_ACTOR_REQUIRED';
  end if;
  if p_action not in ('APPROVE', 'REQUEST_REVISION')
     or p_priority_level not in ('NORMAL', 'TINGGI', 'MENDESAK')
     or length(trim(coalesce(p_leader_note, ''))) not between 10 and 2000
     or jsonb_typeof(coalesce(p_dispositions, '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '23514', message = 'INVALID_EXECUTIVE_REVIEW';
  end if;
  if p_action = 'REQUEST_REVISION' and jsonb_array_length(coalesce(p_dispositions, '[]'::jsonb)) > 0 then
    raise exception using errcode = '23514', message = 'REVISION_CANNOT_DISPOSE';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_dispositions, '[]'::jsonb)) as item("opdId" uuid, instruction text, "dueDate" date)
    where item."opdId" is null
      or length(trim(coalesce(item.instruction, ''))) not between 10 and 2000
      or (item."dueDate" is not null and item."dueDate" < (clock_timestamp() at time zone 'Asia/Jakarta')::date)
      or not exists (
        select 1 from public.master_opd opd
        where opd.id = item."opdId" and opd.kode_opd not in ('BAPPERIDA', 'WALIKOTA')
      )
  ) then
    raise exception using errcode = '23514', message = 'INVALID_DISPOSITION';
  end if;

  select * into current_row
  from public.bapperida_recommendations
  where id = p_recommendation_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'RECOMMENDATION_NOT_FOUND'; end if;
  if current_row.status <> 'MENUNGGU_PERSETUJUAN' then
    raise exception using errcode = '23505', message = 'RECOMMENDATION_NOT_REVIEWABLE';
  end if;
  if p_expected_version is null or current_row.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'RECOMMENDATION_VERSION_CONFLICT';
  end if;

  new_status := case when p_action = 'APPROVE' then 'DITINDAKLANJUTI' else 'PERLU_REVISI' end;
  event_kind := case when p_action = 'APPROVE' then 'APPROVED' else 'REVISION_REQUESTED' end;

  insert into public.walikota_decisions (
    recommendation_id, recommendation_version, action, priority_level,
    leader_note, resulting_status, decided_by
  ) values (
    current_row.id, current_row.version, p_action, p_priority_level,
    trim(p_leader_note), new_status, p_actor_id
  ) returning id into v_decision_id;

  insert into public.walikota_dispositions(decision_id, target_opd_id, instruction, due_date)
  select v_decision_id, item."opdId", trim(item.instruction), item."dueDate"
  from jsonb_to_recordset(coalesce(p_dispositions, '[]'::jsonb)) as item("opdId" uuid, instruction text, "dueDate" date);

  update public.bapperida_recommendations set
    status = new_status,
    mayor_note = trim(p_leader_note),
    version = version + 1,
    completed_at = case when p_action = 'APPROVE' then now() else null end,
    updated_by = p_actor_id
  where id = current_row.id
  returning version into new_recommendation_version;

  insert into public.walikota_decision_events(
    decision_id, recommendation_id, event_type, from_status, to_status,
    note, recommendation_version, actor_user_id
  ) values (
    v_decision_id, current_row.id, event_kind, current_row.status, new_status,
    trim(p_leader_note), new_recommendation_version, p_actor_id
  );
  if jsonb_array_length(coalesce(p_dispositions, '[]'::jsonb)) > 0 then
    insert into public.walikota_decision_events(
      decision_id, recommendation_id, event_type, from_status, to_status,
      note, recommendation_version, actor_user_id
    ) values (
      v_decision_id, current_row.id, 'DISPOSITION_ISSUED', new_status, new_status,
      trim(p_leader_note), new_recommendation_version, p_actor_id
    );
  end if;

  return jsonb_build_object(
    'decisionId', v_decision_id,
    'recommendationId', current_row.id,
    'status', new_status,
    'version', new_recommendation_version,
    'dispositionCount', jsonb_array_length(coalesce(p_dispositions, '[]'::jsonb))
  );
exception
  when unique_violation then
    raise exception using errcode = '40001', message = 'RECOMMENDATION_VERSION_CONFLICT';
end;
$$;

revoke all on function public.walikota_actor_allowed(uuid, uuid) from public, anon, authenticated;
revoke all on function public.walikota_review_recommendation(uuid, integer, uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.walikota_actor_allowed(uuid, uuid) to service_role;
grant execute on function public.walikota_review_recommendation(uuid, integer, uuid, uuid, text, text, text, jsonb) to service_role;
