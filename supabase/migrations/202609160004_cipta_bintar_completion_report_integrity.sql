-- Corrective hardening after hosted validation of migration 007.
-- Completed beneficiaries must keep their referral, lifecycle event, and initial activity report in sync.

create or replace function public.cipta_bintar_validate_domain_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  intervention_row public.cipta_bintar_interventions%rowtype;
  referral_row public.referral_mbi%rowtype;
  program_row public.master_program_layanan%rowtype;
  details_row public.cipta_bintar_program_details%rowtype;
  beneficiary_row public.cipta_bintar_beneficiary_profiles%rowtype;
  outcome_row public.cipta_bintar_realisasi_infrastruktur%rowtype;
  cipta_bintar_opd_id uuid;
  active_count bigint;
  target_intervention_id uuid;
begin
  select id into cipta_bintar_opd_id from public.master_opd where kode_opd = 'CIPTA_BINTAR';

  if tg_table_name = 'cipta_bintar_interventions' then
    target_intervention_id := case when tg_op = 'DELETE' then old.id else new.id end;
  elsif tg_table_name in ('cipta_bintar_realisasi_infrastruktur', 'cipta_bintar_laporan_realisasi', 'cipta_bintar_intervention_events') then
    target_intervention_id := case when tg_op = 'DELETE' then old.intervention_id else new.intervention_id end;
  elsif tg_table_name = 'cipta_bintar_beneficiary_profiles' then
    select id into target_intervention_id from public.cipta_bintar_interventions
    where beneficiary_profile_id = (case when tg_op = 'DELETE' then old.id else new.id end) limit 1;
  elsif tg_table_name = 'cipta_bintar_program_details' then
    select id into target_intervention_id from public.cipta_bintar_interventions
    where program_id = (case when tg_op = 'DELETE' then old.program_id else new.program_id end) limit 1;
  elsif tg_table_name = 'master_program_layanan' then
    select id into target_intervention_id from public.cipta_bintar_interventions
    where program_id = (case when tg_op = 'DELETE' then old.id else new.id end) limit 1;
  else
    select id into target_intervention_id from public.cipta_bintar_interventions
    where referral_id = (case when tg_op = 'DELETE' then old.id else new.id end);
  end if;

  if target_intervention_id is null then
    if tg_table_name = 'referral_mbi' and tg_op <> 'DELETE' then
      if new.target_opd_id = cipta_bintar_opd_id
         and new.jalur = 'PENGUATAN_DASAR'
         and new.status in ('DIPROSES', 'SELESAI')
         and exists (select 1 from public.cipta_bintar_program_details where program_id = new.program_id) then
        raise exception using errcode = '23514', message = 'CIPTA_BINTAR_INTERVENTION_REQUIRED';
      end if;
    end if;
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select * into intervention_row from public.cipta_bintar_interventions where id = target_intervention_id;
  if not found then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  select * into referral_row from public.referral_mbi where id = intervention_row.referral_id;
  select * into program_row from public.master_program_layanan where id = intervention_row.program_id;
  select * into details_row from public.cipta_bintar_program_details where program_id = intervention_row.program_id;
  select * into beneficiary_row from public.cipta_bintar_beneficiary_profiles where id = intervention_row.beneficiary_profile_id;
  select * into outcome_row from public.cipta_bintar_realisasi_infrastruktur where intervention_id = intervention_row.id;

  if referral_row.id is null
     or referral_row.target_opd_id <> cipta_bintar_opd_id
     or referral_row.referral_type <> 'JALUR_MBI'
     or referral_row.jalur <> 'PENGUATAN_DASAR' then
    raise exception using errcode = '23514', message = 'INVALID_CIPTA_BINTAR_REFERRAL_LINK';
  end if;
  if program_row.id is null
     or program_row.opd_id <> cipta_bintar_opd_id
     or program_row.jalur is distinct from 'PENGUATAN_DASAR'
     or details_row.program_id is null
     or intervention_row.petugas_id is distinct from details_row.petugas_id then
    raise exception using errcode = '23514', message = 'INVALID_CIPTA_BINTAR_PROGRAM_LINK';
  end if;
  if beneficiary_row.id is null or beneficiary_row.warga_id <> referral_row.warga_id then
    raise exception using errcode = '23514', message = 'INVALID_CIPTA_BINTAR_BENEFICIARY_LINK';
  end if;

  select count(*) into active_count from public.cipta_bintar_interventions
  where program_id = intervention_row.program_id and participant_status <> 'TIDAK_AKTIF';
  if active_count > details_row.capacity then
    raise exception using errcode = '23514', message = 'CIPTA_BINTAR_PROGRAM_OVER_CAPACITY';
  end if;
  if outcome_row.id is not null and outcome_row.tanggal_selesai < intervention_row.start_date then
    raise exception using errcode = '23514', message = 'COMPLETION_BEFORE_START';
  end if;
  if not exists (
    select 1 from public.cipta_bintar_intervention_events
    where intervention_id = intervention_row.id and event_type = 'STARTED'
  ) then
    raise exception using errcode = '23514', message = 'STARTED_EVENT_REQUIRED';
  end if;
  if intervention_row.participant_status = 'HUNIAN_LAYAK_SELESAI' and outcome_row.id is null then
    raise exception using errcode = '23514', message = 'COMPLETED_INTERVENTION_REQUIRES_OUTCOME';
  end if;
  if referral_row.status = 'SELESAI'
     and (outcome_row.id is null or intervention_row.participant_status <> 'HUNIAN_LAYAK_SELESAI') then
    raise exception using errcode = '23514', message = 'COMPLETED_REFERRAL_REQUIRES_OUTCOME';
  end if;
  if outcome_row.id is not null
     and (intervention_row.participant_status <> 'HUNIAN_LAYAK_SELESAI'
          or intervention_row.progress_percent <> 100
          or intervention_row.feasibility_status <> 'LAYAK_HUNI_BERFUNGSI'
          or referral_row.status <> 'SELESAI') then
    raise exception using errcode = '23514', message = 'OUTCOME_REQUIRES_COMPLETED_LIFECYCLE';
  end if;
  if outcome_row.id is not null
     and not exists (
       select 1 from public.cipta_bintar_intervention_events
       where intervention_id = intervention_row.id and event_type = 'COMPLETED'
     ) then
    raise exception using errcode = '23514', message = 'COMPLETED_EVENT_REQUIRED';
  end if;
  if outcome_row.id is not null
     and not exists (
       select 1 from public.cipta_bintar_laporan_realisasi
       where intervention_id = intervention_row.id
         and periode = date_trunc('month', outcome_row.tanggal_selesai)::date
     ) then
    raise exception using errcode = '23514', message = 'INITIAL_ACTIVITY_REPORT_REQUIRED';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_cipta_bintar_integrity_report on public.cipta_bintar_laporan_realisasi;
create constraint trigger trg_cipta_bintar_integrity_report
after insert or update or delete on public.cipta_bintar_laporan_realisasi
deferrable initially deferred for each row execute function public.cipta_bintar_validate_domain_integrity();

drop trigger if exists trg_cipta_bintar_integrity_event on public.cipta_bintar_intervention_events;
create constraint trigger trg_cipta_bintar_integrity_event
after insert or update or delete on public.cipta_bintar_intervention_events
deferrable initially deferred for each row execute function public.cipta_bintar_validate_domain_integrity();

revoke all on function public.cipta_bintar_validate_domain_integrity() from public, anon, authenticated;
