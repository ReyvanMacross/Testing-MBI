-- Transactional operations for the Diskop UKM WIRAUSAHA lifecycle.

create or replace function public.diskop_actor_allowed(p_actor_id uuid, p_opd_id uuid)
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
      and opd.kode_opd = 'DISKOP'
  );
$$;

create or replace function public.diskop_start_intervention(
  p_referral_id uuid,
  p_actor_id uuid,
  p_actor_opd_id uuid,
  p_program_id uuid,
  p_pendamping_id uuid,
  p_start_date date,
  p_stimulus text,
  p_action_plan text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  referral_row public.referral_mbi%rowtype;
  program_row public.master_program_layanan%rowtype;
  details_row public.diskop_program_details%rowtype;
  mentor_row public.diskop_pendamping%rowtype;
  active_participants bigint;
  new_intervention_id uuid;
begin
  if not public.diskop_actor_allowed(p_actor_id, p_actor_opd_id) then
    raise exception using errcode = '42501', message = 'DISKOP_ACTOR_REQUIRED';
  end if;
  if p_referral_id is null
     or p_actor_id is null
     or p_actor_opd_id is null
     or p_program_id is null
     or p_pendamping_id is null
     or p_start_date is null
     or length(trim(coalesce(p_stimulus, ''))) not between 3 and 500
     or length(trim(coalesce(p_action_plan, ''))) not between 10 and 2000 then
    raise exception using errcode = '23514', message = 'INVALID_INTERVENTION_INPUT';
  end if;

  select * into referral_row from public.referral_mbi where id = p_referral_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'REFERRAL_NOT_FOUND'; end if;
  if referral_row.target_opd_id <> p_actor_opd_id
     or referral_row.referral_type <> 'JALUR_MBI'
     or referral_row.jalur <> 'WIRAUSAHA' then
    raise exception using errcode = '42501', message = 'TARGET_OPD_REQUIRED';
  end if;
  if referral_row.status <> 'TERKIRIM'
     or exists (select 1 from public.diskop_interventions where referral_id = p_referral_id) then
    raise exception using errcode = '23505', message = 'INTERVENTION_ALREADY_STARTED';
  end if;

  select * into program_row from public.master_program_layanan where id = p_program_id;
  if not found or not program_row.is_active
     or program_row.opd_id <> p_actor_opd_id
     or program_row.jalur is distinct from 'WIRAUSAHA' then
    raise exception using errcode = '23514', message = 'INVALID_PROGRAM';
  end if;

  select * into details_row from public.diskop_program_details where program_id = p_program_id for update;
  if not found then raise exception using errcode = '23514', message = 'INVALID_PROGRAM'; end if;
  if details_row.pendamping_id <> p_pendamping_id then
    raise exception using errcode = '23514', message = 'INVALID_PROGRAM_PROVIDER';
  end if;
  select * into mentor_row from public.diskop_pendamping where id = p_pendamping_id and is_active;
  if not found then raise exception using errcode = '23514', message = 'INVALID_PROGRAM_PROVIDER'; end if;

  select count(*) into active_participants
  from public.diskop_interventions
  where program_id = p_program_id and participant_status <> 'TIDAK_AKTIF';
  if active_participants >= details_row.capacity then
    raise exception using errcode = '23505', message = 'PROGRAM_CAPACITY_FULL';
  end if;

  insert into public.diskop_interventions (
    referral_id, program_id, pendamping_id, consultant, start_date,
    stimulus, action_plan, created_by, updated_by
  ) values (
    p_referral_id, p_program_id, p_pendamping_id, mentor_row.nama, p_start_date,
    trim(p_stimulus), trim(p_action_plan), p_actor_id, p_actor_id
  ) returning id into new_intervention_id;

  perform public.transition_referral_status(p_referral_id, 'DITERIMA', p_actor_id, p_actor_opd_id, 'Rujukan diterima untuk pendampingan wirausaha.');
  perform public.transition_referral_status(p_referral_id, 'DIPROSES', p_actor_id, p_actor_opd_id, 'Peserta mulai mengikuti program pendampingan wirausaha.');

  insert into public.diskop_intervention_events (
    intervention_id, event_type, progress_percent, legal_status, note, actor_user_id
  ) values (
    new_intervention_id, 'STARTED', 0, 'BELUM', 'Program pendampingan wirausaha dimulai.', p_actor_id
  );

  return jsonb_build_object('interventionId', new_intervention_id, 'referralId', p_referral_id, 'status', 'DIPROSES');
end;
$$;

create or replace function public.diskop_update_intervention_progress(
  p_intervention_id uuid,
  p_actor_id uuid,
  p_actor_opd_id uuid,
  p_participant_status text,
  p_progress_percent integer,
  p_legal_status text,
  p_evaluation_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  intervention_row public.diskop_interventions%rowtype;
  referral_row public.referral_mbi%rowtype;
begin
  if not public.diskop_actor_allowed(p_actor_id, p_actor_opd_id) then
    raise exception using errcode = '42501', message = 'DISKOP_ACTOR_REQUIRED';
  end if;
  if p_intervention_id is null
     or p_actor_id is null
     or p_actor_opd_id is null
     or p_participant_status is distinct from 'AKTIF_PENDAMPINGAN'
     or p_progress_percent is null
     or p_progress_percent not between 0 and 99
     or p_legal_status is null
     or p_legal_status not in ('BELUM', 'PROSES_NIB_HALAL', 'LEGAL')
     or length(trim(coalesce(p_evaluation_note, ''))) not between 10 and 2000 then
    raise exception using errcode = '23514', message = 'INVALID_PROGRESS_INPUT';
  end if;

  select * into intervention_row from public.diskop_interventions where id = p_intervention_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'INTERVENTION_NOT_FOUND'; end if;
  select * into referral_row from public.referral_mbi where id = intervention_row.referral_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'REFERRAL_NOT_FOUND'; end if;
  if referral_row.target_opd_id <> p_actor_opd_id or referral_row.jalur <> 'WIRAUSAHA' then
    raise exception using errcode = '42501', message = 'TARGET_OPD_REQUIRED';
  end if;
  if referral_row.status <> 'DIPROSES' or intervention_row.participant_status = 'MANDIRI_SELESAI' then
    raise exception using errcode = '23505', message = 'INTERVENTION_ALREADY_COMPLETED';
  end if;

  update public.diskop_interventions set
    participant_status = p_participant_status,
    progress_percent = p_progress_percent,
    legal_status = p_legal_status,
    evaluation_note = trim(p_evaluation_note),
    updated_by = p_actor_id
  where id = p_intervention_id;

  insert into public.diskop_intervention_events (
    intervention_id, event_type, progress_percent, legal_status, note, actor_user_id
  ) values (
    p_intervention_id, 'PROGRESS_UPDATED', p_progress_percent, p_legal_status,
    trim(p_evaluation_note), p_actor_id
  );

  return jsonb_build_object('interventionId', p_intervention_id, 'referralId', referral_row.id, 'status', 'DIPROSES');
end;
$$;

create or replace function public.diskop_complete_intervention(
  p_intervention_id uuid,
  p_actor_id uuid,
  p_actor_opd_id uuid,
  p_nib text,
  p_monthly_revenue bigint,
  p_completion_date date,
  p_evaluation text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  intervention_row public.diskop_interventions%rowtype;
  referral_row public.referral_mbi%rowtype;
  program_row public.master_program_layanan%rowtype;
  details_row public.diskop_program_details%rowtype;
  outcome_id uuid;
begin
  if not public.diskop_actor_allowed(p_actor_id, p_actor_opd_id) then
    raise exception using errcode = '42501', message = 'DISKOP_ACTOR_REQUIRED';
  end if;
  if p_intervention_id is null
     or p_actor_id is null
     or p_actor_opd_id is null
     or p_nib is null
     or p_nib !~ '^[0-9]{13}$'
     or p_monthly_revenue is null
     or p_monthly_revenue not between 0 and 1000000000000
     or p_completion_date is null
     or length(trim(coalesce(p_evaluation, ''))) not between 10 and 2000 then
    raise exception using errcode = '23514', message = 'INVALID_COMPLETION_INPUT';
  end if;

  select * into intervention_row from public.diskop_interventions where id = p_intervention_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'INTERVENTION_NOT_FOUND'; end if;
  select * into referral_row from public.referral_mbi where id = intervention_row.referral_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'REFERRAL_NOT_FOUND'; end if;
  if referral_row.target_opd_id <> p_actor_opd_id or referral_row.jalur <> 'WIRAUSAHA' then
    raise exception using errcode = '42501', message = 'TARGET_OPD_REQUIRED';
  end if;
  if referral_row.status <> 'DIPROSES'
     or intervention_row.participant_status = 'MANDIRI_SELESAI'
     or exists (select 1 from public.diskop_kemandirian_usaha where intervention_id = p_intervention_id) then
    raise exception using errcode = '23505', message = 'INTERVENTION_ALREADY_COMPLETED';
  end if;
  if p_completion_date < intervention_row.start_date then
    raise exception using errcode = '23514', message = 'COMPLETION_BEFORE_START';
  end if;

  select * into program_row from public.master_program_layanan where id = intervention_row.program_id;
  select * into details_row from public.diskop_program_details where program_id = intervention_row.program_id;
  if program_row.id is null or details_row.program_id is null then
    raise exception using errcode = '23514', message = 'INVALID_PROGRAM';
  end if;

  update public.diskop_interventions set
    participant_status = 'MANDIRI_SELESAI',
    progress_percent = 100,
    legal_status = 'LEGAL',
    evaluation_note = trim(p_evaluation),
    updated_by = p_actor_id
  where id = p_intervention_id;

  insert into public.diskop_kemandirian_usaha (
    intervention_id, nib, nama_usaha, kategori_usaha, omzet_bulanan,
    stimulus_status, tanggal_mandiri, evaluasi_akhir, created_by
  ) values (
    p_intervention_id, p_nib, program_row.nama_program, details_row.category,
    p_monthly_revenue, intervention_row.stimulus, p_completion_date, trim(p_evaluation), p_actor_id
  ) returning id into outcome_id;

  insert into public.diskop_laporan_omzet (
    intervention_id, periode, nominal, status, created_by
  ) values (
    p_intervention_id, date_trunc('month', p_completion_date)::date,
    p_monthly_revenue, 'TERVERIFIKASI', p_actor_id
  );

  perform public.transition_referral_status(intervention_row.referral_id, 'SELESAI', p_actor_id, p_actor_opd_id, 'Pendampingan selesai dan usaha telah mandiri.');
  insert into public.diskop_intervention_events (
    intervention_id, event_type, progress_percent, legal_status, note, actor_user_id
  ) values (
    p_intervention_id, 'COMPLETED', 100, 'LEGAL', trim(p_evaluation), p_actor_id
  );

  return jsonb_build_object('interventionId', p_intervention_id, 'outcomeId', outcome_id, 'referralId', referral_row.id, 'status', 'SELESAI');
exception
  when unique_violation then
    if exists (select 1 from public.diskop_kemandirian_usaha where nib = p_nib and intervention_id <> p_intervention_id) then
      raise exception using errcode = '23505', message = 'NIB_ALREADY_EXISTS';
    end if;
    raise exception using errcode = '23505', message = 'INTERVENTION_ALREADY_COMPLETED';
end;
$$;

create or replace function public.diskop_create_program(
  p_actor_id uuid,
  p_actor_opd_id uuid,
  p_code text,
  p_name text,
  p_category text,
  p_pendamping_id uuid,
  p_duration_value integer,
  p_duration_unit text,
  p_capacity integer,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_program_id uuid;
  mentor_row public.diskop_pendamping%rowtype;
begin
  if not public.diskop_actor_allowed(p_actor_id, p_actor_opd_id) then
    raise exception using errcode = '42501', message = 'DISKOP_ACTOR_REQUIRED';
  end if;
  if p_actor_id is null
     or p_actor_opd_id is null
     or p_code is null
     or p_code !~ '^PRG-[A-Z]{3}-[0-9]{2}$'
     or length(trim(coalesce(p_name, ''))) not between 5 and 200
     or length(trim(coalesce(p_category, ''))) not between 2 and 100
     or p_pendamping_id is null
     or p_duration_value is null
     or p_duration_value not between 1 and 60
     or p_duration_unit is null
     or p_duration_unit not in ('HARI', 'MINGGU', 'BULAN')
     or p_capacity is null
     or p_capacity not between 1 and 10000
     or length(trim(coalesce(p_description, ''))) not between 10 and 3000 then
    raise exception using errcode = '23514', message = 'INVALID_PROGRAM_INPUT';
  end if;
  select * into mentor_row from public.diskop_pendamping where id = p_pendamping_id and is_active;
  if not found then raise exception using errcode = '23514', message = 'INVALID_PROGRAM_PROVIDER'; end if;

  insert into public.master_program_layanan (
    kode_program, nama_program, opd_id, jalur, jenis_intervensi, is_active
  ) values (
    p_code, trim(p_name), p_actor_opd_id, 'WIRAUSAHA', 'PENDAMPINGAN_UMKM', true
  ) returning id into new_program_id;

  insert into public.diskop_program_details (
    program_id, category, pendamping_id, consultant, location, duration_value,
    duration_unit, capacity, description, facilitation
  ) values (
    new_program_id, trim(p_category), p_pendamping_id, mentor_row.nama, mentor_row.lokasi,
    p_duration_value, p_duration_unit, p_capacity, trim(p_description), trim(p_description)
  );

  return jsonb_build_object('programId', new_program_id, 'code', p_code, 'name', trim(p_name));
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'PROGRAM_CODE_EXISTS';
end;
$$;

revoke all on function public.diskop_actor_allowed(uuid, uuid) from public, anon, authenticated;
grant execute on function public.diskop_actor_allowed(uuid, uuid) to service_role;
revoke all on function public.diskop_start_intervention(uuid, uuid, uuid, uuid, uuid, date, text, text) from public, anon, authenticated;
grant execute on function public.diskop_start_intervention(uuid, uuid, uuid, uuid, uuid, date, text, text) to service_role;
revoke all on function public.diskop_update_intervention_progress(uuid, uuid, uuid, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.diskop_update_intervention_progress(uuid, uuid, uuid, text, integer, text, text) to service_role;
revoke all on function public.diskop_complete_intervention(uuid, uuid, uuid, text, bigint, date, text) from public, anon, authenticated;
grant execute on function public.diskop_complete_intervention(uuid, uuid, uuid, text, bigint, date, text) to service_role;
revoke all on function public.diskop_create_program(uuid, uuid, text, text, text, uuid, integer, text, integer, text) from public, anon, authenticated;
grant execute on function public.diskop_create_program(uuid, uuid, text, text, text, uuid, integer, text, integer, text) to service_role;
