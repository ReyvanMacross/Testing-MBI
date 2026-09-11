-- Transactional operations for the DISBUDPAR creative-economy and arts lifecycle.

create or replace function public.disbudpar_actor_allowed(p_actor_id uuid, p_opd_id uuid)
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
      and opd.kode_opd = 'DISBUDPAR'
  );
$$;

create or replace function public.disbudpar_start_intervention(
  p_referral_id uuid,
  p_actor_id uuid,
  p_actor_opd_id uuid,
  p_program_id uuid,
  p_pendamping_id uuid,
  p_group_name text,
  p_subsektor_ekraf text,
  p_lokasi_sanggar text,
  p_start_date date,
  p_jenis_bantuan text,
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
  details_row public.disbudpar_program_details%rowtype;
  officer_row public.disbudpar_pendamping%rowtype;
  active_participants bigint;
  new_intervention_id uuid;
  beneficiary_profile_id uuid;
begin
  if not public.disbudpar_actor_allowed(p_actor_id, p_actor_opd_id) then
    raise exception using errcode = '42501', message = 'DISBUDPAR_ACTOR_REQUIRED';
  end if;
  if p_referral_id is null
     or p_actor_id is null
     or p_actor_opd_id is null
     or p_program_id is null
     or p_pendamping_id is null
     or length(trim(coalesce(p_group_name, ''))) not between 3 and 200
     or length(trim(coalesce(p_subsektor_ekraf, ''))) not between 2 and 100
     or length(trim(coalesce(p_lokasi_sanggar, ''))) not between 3 and 300
     or p_start_date is null
     or length(trim(coalesce(p_jenis_bantuan, ''))) not between 3 and 500
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
     or exists (select 1 from public.disbudpar_interventions where referral_id = p_referral_id) then
    raise exception using errcode = '23505', message = 'INTERVENTION_ALREADY_STARTED';
  end if;

  select * into program_row from public.master_program_layanan where id = p_program_id;
  if not found or not program_row.is_active
     or program_row.opd_id <> p_actor_opd_id
     or program_row.jalur is distinct from 'WIRAUSAHA' then
    raise exception using errcode = '23514', message = 'INVALID_PROGRAM';
  end if;

  select * into details_row from public.disbudpar_program_details where program_id = p_program_id for update;
  if not found then raise exception using errcode = '23514', message = 'INVALID_PROGRAM'; end if;
  if details_row.pendamping_id <> p_pendamping_id then
    raise exception using errcode = '23514', message = 'INVALID_PROGRAM_PROVIDER';
  end if;
  select * into officer_row from public.disbudpar_pendamping where id = p_pendamping_id and is_active;
  if not found then raise exception using errcode = '23514', message = 'INVALID_PROGRAM_PROVIDER'; end if;

  select count(*) into active_participants
  from public.disbudpar_interventions
  where program_id = p_program_id and participant_status <> 'TIDAK_AKTIF';
  if active_participants >= details_row.capacity then
    raise exception using errcode = '23505', message = 'PROGRAM_CAPACITY_FULL';
  end if;

  insert into public.disbudpar_beneficiary_profiles (
    warga_id, nama_kelompok, subsektor_ekraf, lokasi_sanggar, is_fixture, created_by, updated_by
  ) values (
    referral_row.warga_id, trim(p_group_name), trim(p_subsektor_ekraf), trim(p_lokasi_sanggar),
    referral_row.is_fixture, p_actor_id, p_actor_id
  )
  on conflict (warga_id) do update set
    nama_kelompok = excluded.nama_kelompok,
    subsektor_ekraf = excluded.subsektor_ekraf,
    lokasi_sanggar = excluded.lokasi_sanggar,
    is_fixture = excluded.is_fixture,
    updated_by = excluded.updated_by
  returning id into beneficiary_profile_id;

  insert into public.disbudpar_interventions (
    referral_id, program_id, pendamping_id, beneficiary_profile_id, pendamping, start_date,
    jenis_bantuan, action_plan, created_by, updated_by
  ) values (
    p_referral_id, p_program_id, p_pendamping_id, beneficiary_profile_id, officer_row.nama, p_start_date,
    trim(p_jenis_bantuan), trim(p_action_plan), p_actor_id, p_actor_id
  ) returning id into new_intervention_id;

  perform public.transition_referral_status(p_referral_id, 'DITERIMA', p_actor_id, p_actor_opd_id, 'Rujukan diterima untuk pembinaan ekonomi kreatif dan seni.');
  perform public.transition_referral_status(p_referral_id, 'DIPROSES', p_actor_id, p_actor_opd_id, 'Warga mulai mengikuti program Disbudpar.');

  insert into public.disbudpar_intervention_events (
    intervention_id, event_type, progress_percent, creative_result_status, note, actor_user_id
  ) values (
    new_intervention_id, 'STARTED', 0, 'BELUM_AKTIF', 'Pendampingan ekraf dan seni Disbudpar dimulai.', p_actor_id
  );

  return jsonb_build_object('interventionId', new_intervention_id, 'referralId', p_referral_id, 'status', 'DIPROSES');
end;
$$;

create or replace function public.disbudpar_update_intervention_progress(
  p_intervention_id uuid,
  p_actor_id uuid,
  p_actor_opd_id uuid,
  p_participant_status text,
  p_progress_percent integer,
  p_creative_result_status text,
  p_evaluation_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  intervention_row public.disbudpar_interventions%rowtype;
  referral_row public.referral_mbi%rowtype;
begin
  if not public.disbudpar_actor_allowed(p_actor_id, p_actor_opd_id) then
    raise exception using errcode = '42501', message = 'DISBUDPAR_ACTOR_REQUIRED';
  end if;
  if p_intervention_id is null
     or p_actor_id is null
     or p_actor_opd_id is null
     or p_participant_status is distinct from 'AKTIF_PENDAMPINGAN'
     or p_progress_percent is null
     or p_progress_percent not between 0 and 99
     or p_creative_result_status is null
     or p_creative_result_status not in ('BELUM_AKTIF', 'AKTIF_TERBATAS', 'AKTIF_TAMPIL_PRODUKSI_RUTIN')
     or length(trim(coalesce(p_evaluation_note, ''))) not between 10 and 2000 then
    raise exception using errcode = '23514', message = 'INVALID_PROGRESS_INPUT';
  end if;

  select * into intervention_row from public.disbudpar_interventions where id = p_intervention_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'INTERVENTION_NOT_FOUND'; end if;
  select * into referral_row from public.referral_mbi where id = intervention_row.referral_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'REFERRAL_NOT_FOUND'; end if;
  if referral_row.target_opd_id <> p_actor_opd_id or referral_row.jalur <> 'WIRAUSAHA' then
    raise exception using errcode = '42501', message = 'TARGET_OPD_REQUIRED';
  end if;
  if referral_row.status <> 'DIPROSES' or intervention_row.participant_status = 'MANDIRI_SELESAI' then
    raise exception using errcode = '23505', message = 'INTERVENTION_ALREADY_COMPLETED';
  end if;

  update public.disbudpar_interventions set
    participant_status = p_participant_status,
    progress_percent = p_progress_percent,
    creative_result_status = p_creative_result_status,
    evaluation_note = trim(p_evaluation_note),
    updated_by = p_actor_id
  where id = p_intervention_id;

  insert into public.disbudpar_intervention_events (
    intervention_id, event_type, progress_percent, creative_result_status, note, actor_user_id
  ) values (
    p_intervention_id, 'PROGRESS_UPDATED', p_progress_percent, p_creative_result_status,
    trim(p_evaluation_note), p_actor_id
  );

  return jsonb_build_object('interventionId', p_intervention_id, 'referralId', referral_row.id, 'status', 'DIPROSES');
end;
$$;

create or replace function public.disbudpar_complete_intervention(
  p_intervention_id uuid,
  p_actor_id uuid,
  p_actor_opd_id uuid,
  p_achievement_value bigint,
  p_completion_date date,
  p_evaluation text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  intervention_row public.disbudpar_interventions%rowtype;
  referral_row public.referral_mbi%rowtype;
  program_row public.master_program_layanan%rowtype;
  details_row public.disbudpar_program_details%rowtype;
  beneficiary_row public.disbudpar_beneficiary_profiles%rowtype;
  outcome_id uuid;
begin
  if not public.disbudpar_actor_allowed(p_actor_id, p_actor_opd_id) then
    raise exception using errcode = '42501', message = 'DISBUDPAR_ACTOR_REQUIRED';
  end if;
  if p_intervention_id is null
     or p_actor_id is null
     or p_actor_opd_id is null
     or p_achievement_value is null
     or p_achievement_value not between 0 and 1000000000000
     or p_completion_date is null
     or length(trim(coalesce(p_evaluation, ''))) not between 10 and 2000 then
    raise exception using errcode = '23514', message = 'INVALID_COMPLETION_INPUT';
  end if;

  select * into intervention_row from public.disbudpar_interventions where id = p_intervention_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'INTERVENTION_NOT_FOUND'; end if;
  select * into referral_row from public.referral_mbi where id = intervention_row.referral_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'REFERRAL_NOT_FOUND'; end if;
  if referral_row.target_opd_id <> p_actor_opd_id or referral_row.jalur <> 'WIRAUSAHA' then
    raise exception using errcode = '42501', message = 'TARGET_OPD_REQUIRED';
  end if;
  if referral_row.status <> 'DIPROSES'
     or intervention_row.participant_status = 'MANDIRI_SELESAI'
     or exists (select 1 from public.disbudpar_kemandirian_ekraf where intervention_id = p_intervention_id) then
    raise exception using errcode = '23505', message = 'INTERVENTION_ALREADY_COMPLETED';
  end if;
  if p_completion_date < intervention_row.start_date then
    raise exception using errcode = '23514', message = 'COMPLETION_BEFORE_START';
  end if;

  select * into program_row from public.master_program_layanan where id = intervention_row.program_id;
  select * into details_row from public.disbudpar_program_details where program_id = intervention_row.program_id;
  select * into beneficiary_row from public.disbudpar_beneficiary_profiles where id = intervention_row.beneficiary_profile_id;
  if program_row.id is null or details_row.program_id is null or beneficiary_row.id is null then
    raise exception using errcode = '23514', message = 'INVALID_PROGRAM';
  end if;
  if beneficiary_row.warga_id <> referral_row.warga_id then
    raise exception using errcode = '23514', message = 'INVALID_BENEFICIARY_PROFILE';
  end if;

  update public.disbudpar_interventions set
    participant_status = 'MANDIRI_SELESAI',
    progress_percent = 100,
    creative_result_status = 'AKTIF_TAMPIL_PRODUKSI_RUTIN',
    evaluation_note = trim(p_evaluation),
    updated_by = p_actor_id
  where id = p_intervention_id;

  insert into public.disbudpar_kemandirian_ekraf (
    intervention_id, lokasi_sanggar, nama_kelompok, subsektor_ekraf, capaian_omzet_nilai_tampil,
    status_hasil, tanggal_mandiri, evaluasi_akhir, created_by
  ) values (
    p_intervention_id, beneficiary_row.lokasi_sanggar, beneficiary_row.nama_kelompok, beneficiary_row.subsektor_ekraf,
    p_achievement_value, 'Aktif tampil dan produksi rutin', p_completion_date, trim(p_evaluation), p_actor_id
  ) returning id into outcome_id;

  insert into public.disbudpar_laporan_pembinaan (
    intervention_id, periode, nominal, status, created_by
  ) values (
    p_intervention_id, date_trunc('month', p_completion_date)::date,
    p_achievement_value, 'TERVERIFIKASI', p_actor_id
  );

  perform public.transition_referral_status(intervention_row.referral_id, 'SELESAI', p_actor_id, p_actor_opd_id, 'Pendampingan selesai dan pelaku ekraf ditetapkan mandiri.');
  insert into public.disbudpar_intervention_events (
    intervention_id, event_type, progress_percent, creative_result_status, note, actor_user_id
  ) values (
    p_intervention_id, 'COMPLETED', 100, 'AKTIF_TAMPIL_PRODUKSI_RUTIN', trim(p_evaluation), p_actor_id
  );

  return jsonb_build_object('interventionId', p_intervention_id, 'outcomeId', outcome_id, 'referralId', referral_row.id, 'status', 'SELESAI');
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'INTERVENTION_ALREADY_COMPLETED';
end;
$$;

create or replace function public.disbudpar_create_program(
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
  officer_row public.disbudpar_pendamping%rowtype;
begin
  if not public.disbudpar_actor_allowed(p_actor_id, p_actor_opd_id) then
    raise exception using errcode = '42501', message = 'DISBUDPAR_ACTOR_REQUIRED';
  end if;
  if p_actor_id is null
     or p_actor_opd_id is null
     or p_code is null
     or p_code !~ '^PRG-BUD-[0-9]{2}$'
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
  select * into officer_row from public.disbudpar_pendamping where id = p_pendamping_id and is_active;
  if not found then raise exception using errcode = '23514', message = 'INVALID_PROGRAM_PROVIDER'; end if;

  insert into public.master_program_layanan (
    kode_program, nama_program, opd_id, jalur, jenis_intervensi, is_active
  ) values (
    p_code, trim(p_name), p_actor_opd_id, 'WIRAUSAHA', 'PEMBINAAN_EKRAF_SENI', true
  ) returning id into new_program_id;

  insert into public.disbudpar_program_details (
    program_id, category, pendamping_id, pendamping, location, duration_value,
    duration_unit, capacity, description, facilitation
  ) values (
    new_program_id, trim(p_category), p_pendamping_id, officer_row.nama, officer_row.lokasi,
    p_duration_value, p_duration_unit, p_capacity, trim(p_description), trim(p_description)
  );

  return jsonb_build_object('programId', new_program_id, 'code', p_code, 'name', trim(p_name));
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'PROGRAM_CODE_EXISTS';
end;
$$;

revoke all on function public.disbudpar_actor_allowed(uuid, uuid) from public, anon, authenticated;
grant execute on function public.disbudpar_actor_allowed(uuid, uuid) to service_role;
revoke all on function public.disbudpar_start_intervention(uuid, uuid, uuid, uuid, uuid, text, text, text, date, text, text) from public, anon, authenticated;
grant execute on function public.disbudpar_start_intervention(uuid, uuid, uuid, uuid, uuid, text, text, text, date, text, text) to service_role;
revoke all on function public.disbudpar_update_intervention_progress(uuid, uuid, uuid, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.disbudpar_update_intervention_progress(uuid, uuid, uuid, text, integer, text, text) to service_role;
revoke all on function public.disbudpar_complete_intervention(uuid, uuid, uuid, bigint, date, text) from public, anon, authenticated;
grant execute on function public.disbudpar_complete_intervention(uuid, uuid, uuid, bigint, date, text) to service_role;
revoke all on function public.disbudpar_create_program(uuid, uuid, text, text, text, uuid, integer, text, integer, text) from public, anon, authenticated;
grant execute on function public.disbudpar_create_program(uuid, uuid, text, text, text, uuid, integer, text, integer, text) to service_role;
