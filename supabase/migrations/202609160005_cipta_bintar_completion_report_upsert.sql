-- Allow completion to replace a same-month progress report atomically.

create or replace function public.cipta_bintar_complete_intervention(
  p_intervention_id uuid,
  p_actor_id uuid,
  p_actor_opd_id uuid,
  p_realization_value bigint,
  p_completion_date date,
  p_evaluation text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  intervention_row public.cipta_bintar_interventions%rowtype;
  referral_row public.referral_mbi%rowtype;
  program_row public.master_program_layanan%rowtype;
  details_row public.cipta_bintar_program_details%rowtype;
  beneficiary_row public.cipta_bintar_beneficiary_profiles%rowtype;
  outcome_id uuid;
begin
  if not public.cipta_bintar_actor_allowed(p_actor_id, p_actor_opd_id) then
    raise exception using errcode = '42501', message = 'CIPTA_BINTAR_ACTOR_REQUIRED';
  end if;
  if p_intervention_id is null
     or p_actor_id is null
     or p_actor_opd_id is null
     or p_realization_value is null
     or p_realization_value not between 0 and 1000000000000
     or p_completion_date is null
     or length(trim(coalesce(p_evaluation, ''))) not between 10 and 2000 then
    raise exception using errcode = '23514', message = 'INVALID_COMPLETION_INPUT';
  end if;

  select * into intervention_row from public.cipta_bintar_interventions where id = p_intervention_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'INTERVENTION_NOT_FOUND'; end if;
  select * into referral_row from public.referral_mbi where id = intervention_row.referral_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'REFERRAL_NOT_FOUND'; end if;
  if referral_row.target_opd_id <> p_actor_opd_id or referral_row.jalur <> 'PENGUATAN_DASAR' then
    raise exception using errcode = '42501', message = 'TARGET_OPD_REQUIRED';
  end if;
  if referral_row.status <> 'DIPROSES'
     or intervention_row.participant_status = 'HUNIAN_LAYAK_SELESAI'
     or exists (select 1 from public.cipta_bintar_realisasi_infrastruktur where intervention_id = p_intervention_id) then
    raise exception using errcode = '23505', message = 'INTERVENTION_ALREADY_COMPLETED';
  end if;
  if p_completion_date < intervention_row.start_date then
    raise exception using errcode = '23514', message = 'COMPLETION_BEFORE_START';
  end if;

  select * into program_row from public.master_program_layanan where id = intervention_row.program_id;
  select * into details_row from public.cipta_bintar_program_details where program_id = intervention_row.program_id;
  select * into beneficiary_row from public.cipta_bintar_beneficiary_profiles where id = intervention_row.beneficiary_profile_id;
  if program_row.id is null or details_row.program_id is null or beneficiary_row.id is null then
    raise exception using errcode = '23514', message = 'INVALID_PROGRAM';
  end if;
  if beneficiary_row.warga_id <> referral_row.warga_id then
    raise exception using errcode = '23514', message = 'INVALID_BENEFICIARY_PROFILE';
  end if;

  update public.cipta_bintar_interventions set
    participant_status = 'HUNIAN_LAYAK_SELESAI',
    progress_percent = 100,
    feasibility_status = 'LAYAK_HUNI_BERFUNGSI',
    evaluation_note = trim(p_evaluation),
    updated_by = p_actor_id
  where id = p_intervention_id;

  insert into public.cipta_bintar_realisasi_infrastruktur (
    intervention_id, lokasi_objek, alamat_objek, kategori_infrastruktur, realisasi_anggaran,
    status_kelayakan, tanggal_selesai, evaluasi_akhir, created_by
  ) values (
    p_intervention_id, beneficiary_row.lokasi_objek, beneficiary_row.alamat_objek, beneficiary_row.kategori_infrastruktur,
    p_realization_value, 'Hunian layak dan fasilitas berfungsi', p_completion_date, trim(p_evaluation), p_actor_id
  ) returning id into outcome_id;

  insert into public.cipta_bintar_laporan_realisasi (
    intervention_id, periode, nominal, progress_percent, status, created_by
  ) values (
    p_intervention_id, date_trunc('month', p_completion_date)::date,
    p_realization_value, 100, 'TERVERIFIKASI', p_actor_id
  )
  on conflict (intervention_id, periode) do update set
    nominal = excluded.nominal,
    progress_percent = excluded.progress_percent,
    status = excluded.status,
    created_by = excluded.created_by;

  perform public.transition_referral_status(intervention_row.referral_id, 'SELESAI', p_actor_id, p_actor_opd_id, 'Pengerjaan fisik selesai dan fasilitas dinyatakan layak.');
  insert into public.cipta_bintar_intervention_events (
    intervention_id, event_type, progress_percent, feasibility_status, note, actor_user_id
  ) values (
    p_intervention_id, 'COMPLETED', 100, 'LAYAK_HUNI_BERFUNGSI', trim(p_evaluation), p_actor_id
  );

  return jsonb_build_object('interventionId', p_intervention_id, 'outcomeId', outcome_id, 'referralId', referral_row.id, 'status', 'SELESAI');
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'INTERVENTION_ALREADY_COMPLETED';
end;
$$;

revoke all on function public.cipta_bintar_complete_intervention(uuid, uuid, uuid, bigint, date, text) from public, anon, authenticated;
grant execute on function public.cipta_bintar_complete_intervention(uuid, uuid, uuid, bigint, date, text) to service_role;
