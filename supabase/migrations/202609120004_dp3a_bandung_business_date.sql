-- Samakan tanggal realisasi progress dengan hari kerja Kota Bandung.

create or replace function public.dp3a_update_case_progress(
  p_case_id uuid,
  p_actor_id uuid,
  p_actor_opd_id uuid,
  p_progress_percent integer,
  p_verification_status text,
  p_realized_amount bigint,
  p_evaluation_note text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i public.dp3a_cases%rowtype;
  r public.referral_mbi%rowtype;
  bandung_business_date date := (clock_timestamp() at time zone 'Asia/Jakarta')::date;
begin
  if not public.dp3a_actor_allowed(p_actor_id, p_actor_opd_id) then
    raise exception using errcode = '42501', message = 'DP3A_ACTOR_REQUIRED';
  end if;
  if p_progress_percent not between 1 and 99
     or p_verification_status not in ('MENUNGGU', 'LULUS', 'DITOLAK')
     or p_realized_amount not between 0 and 1000000000000
     or length(trim(coalesce(p_evaluation_note, ''))) not between 10 and 2000 then
    raise exception using errcode = '23514', message = 'INVALID_PROGRESS_INPUT';
  end if;

  select * into i from public.dp3a_cases where id = p_case_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'CASE_NOT_FOUND'; end if;
  select * into r from public.referral_mbi where id = i.referral_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'REFERRAL_NOT_FOUND'; end if;
  if r.target_opd_id <> p_actor_opd_id or r.jalur <> 'PENGUATAN_DASAR' then
    raise exception using errcode = '42501', message = 'TARGET_OPD_REQUIRED';
  end if;
  if r.status <> 'DIPROSES' or i.case_status = 'SELESAI' then
    raise exception using errcode = '23505', message = 'CASE_ALREADY_COMPLETED';
  end if;
  if bandung_business_date < i.start_date then
    raise exception using errcode = '23514', message = 'PROGRESS_BEFORE_START';
  end if;
  if p_realized_amount > i.planned_budget then
    raise exception using errcode = '23514', message = 'REALIZATION_EXCEEDS_BUDGET';
  end if;

  update public.dp3a_cases
  set case_status = 'PENDAMPINGAN',
      verification_status = p_verification_status,
      progress_percent = p_progress_percent,
      evaluation_note = trim(p_evaluation_note),
      updated_by = p_actor_id
  where id = p_case_id;

  insert into public.dp3a_realisasi_layanan(
    case_id, support_item, realized_amount, realization_date, notes, created_by, updated_by
  ) values (
    p_case_id, i.support_item, p_realized_amount, bandung_business_date,
    trim(p_evaluation_note), p_actor_id, p_actor_id
  )
  on conflict(case_id) do update
  set realized_amount = excluded.realized_amount,
      realization_date = excluded.realization_date,
      notes = excluded.notes,
      updated_by = p_actor_id,
      updated_at = now();

  insert into public.dp3a_case_events(
    case_id, event_type, progress_percent, verification_status, note, actor_user_id
  ) values (
    p_case_id, 'PROGRESS_UPDATED', p_progress_percent, p_verification_status,
    trim(p_evaluation_note), p_actor_id
  );
  return jsonb_build_object('caseId', p_case_id, 'referralId', r.id, 'status', 'DIPROSES');
end;
$$;

revoke all on function public.dp3a_update_case_progress(uuid,uuid,uuid,integer,text,bigint,text)
from public, anon, authenticated;
grant execute on function public.dp3a_update_case_progress(uuid,uuid,uuid,integer,text,bigint,text)
to service_role;
