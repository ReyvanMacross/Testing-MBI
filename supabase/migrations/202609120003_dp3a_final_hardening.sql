-- Hardening integritas akhir DP3A. Seluruh relasi lintas tabel divalidasi saat commit.

create unique index if not exists uq_dp3a_single_lifecycle_event
on public.dp3a_case_events(case_id, event_type)
where event_type in ('STARTED', 'COMPLETED', 'CANCELLED');

create or replace function public.dp3a_validate_domain_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dp3a_opd_id uuid;
begin
  select id into dp3a_opd_id
  from public.master_opd
  where kode_opd = 'DP3A';

  if dp3a_opd_id is null then
    raise exception using errcode = '23514', message = 'DP3A_OPD_REQUIRED';
  end if;

  if exists (
    select 1
    from public.dp3a_program_details details
    left join public.master_program_layanan program on program.id = details.program_id
    left join public.dp3a_unit_layanan unit on unit.id = details.unit_id
    where program.id is null
       or program.opd_id <> dp3a_opd_id
       or program.jalur is distinct from 'PENGUATAN_DASAR'
       or unit.id is null
  ) then
    raise exception using errcode = '23514', message = 'INVALID_DP3A_PROGRAM_LINK';
  end if;

  if exists (
    select 1
    from public.dp3a_cases case_record
    left join public.referral_mbi referral on referral.id = case_record.referral_id
    left join public.master_program_layanan program on program.id = case_record.program_id
    left join public.dp3a_program_details details on details.program_id = case_record.program_id
    where referral.id is null
       or referral.target_opd_id <> dp3a_opd_id
       or referral.referral_type <> 'JALUR_MBI'
       or referral.jalur <> 'PENGUATAN_DASAR'
       or referral.program_id is distinct from case_record.program_id
       or program.id is null
       or program.opd_id <> dp3a_opd_id
       or program.jalur is distinct from 'PENGUATAN_DASAR'
       or details.program_id is null
       or case_record.unit_id is distinct from details.unit_id
  ) then
    raise exception using errcode = '23514', message = 'INVALID_DP3A_CASE_LINK';
  end if;

  if exists (
    select 1
    from public.referral_mbi referral
    where referral.target_opd_id = dp3a_opd_id
      and referral.referral_type = 'JALUR_MBI'
      and referral.jalur = 'PENGUATAN_DASAR'
      and referral.status in ('DIPROSES', 'SELESAI')
      and not exists (
        select 1 from public.dp3a_cases case_record
        where case_record.referral_id = referral.id
      )
  ) then
    raise exception using errcode = '23514', message = 'DP3A_CASE_REQUIRED';
  end if;

  if exists (
    select 1
    from public.dp3a_program_details details
    left join public.dp3a_cases case_record
      on case_record.program_id = details.program_id
     and case_record.case_status <> 'TIDAK_AKTIF'
    group by details.program_id, details.capacity
    having count(case_record.id) > details.capacity
  ) then
    raise exception using errcode = '23514', message = 'DP3A_PROGRAM_OVER_CAPACITY';
  end if;

  if exists (
    select 1
    from public.dp3a_realisasi_layanan realization
    join public.dp3a_cases case_record on case_record.id = realization.case_id
    where realization.realization_date < case_record.start_date
       or realization.realized_amount > case_record.planned_budget
  ) then
    raise exception using errcode = '23514', message = 'INVALID_DP3A_REALIZATION';
  end if;

  if exists (
    select 1
    from public.dp3a_cases case_record
    where not exists (
      select 1 from public.dp3a_case_events event
      where event.case_id = case_record.id and event.event_type = 'STARTED'
    )
  ) then
    raise exception using errcode = '23514', message = 'STARTED_EVENT_REQUIRED';
  end if;

  if exists (
    select 1
    from public.dp3a_cases case_record
    join public.referral_mbi referral on referral.id = case_record.referral_id
    where case_record.case_status = 'SELESAI'
      and (
        case_record.progress_percent <> 100
        or case_record.verification_status <> 'LULUS'
        or referral.status <> 'SELESAI'
        or not exists (
          select 1 from public.dp3a_realisasi_layanan realization
          where realization.case_id = case_record.id
        )
        or not exists (
          select 1 from public.dp3a_case_events event
          where event.case_id = case_record.id and event.event_type = 'COMPLETED'
        )
      )
  ) then
    raise exception using errcode = '23514', message = 'INVALID_DP3A_COMPLETED_LIFECYCLE';
  end if;

  if exists (
    select 1
    from public.referral_mbi referral
    join public.dp3a_cases case_record on case_record.referral_id = referral.id
    where referral.status = 'SELESAI'
      and referral.target_opd_id = dp3a_opd_id
      and referral.jalur = 'PENGUATAN_DASAR'
      and (
        case_record.case_status <> 'SELESAI'
        or not exists (
          select 1 from public.dp3a_realisasi_layanan realization
          where realization.case_id = case_record.id
        )
      )
  ) then
    raise exception using errcode = '23514', message = 'COMPLETED_REFERRAL_REQUIRES_REALIZATION';
  end if;

  if exists (
    select 1
    from public.dp3a_case_events event
    join public.dp3a_cases case_record on case_record.id = event.case_id
    where event.event_type = 'COMPLETED'
      and (case_record.case_status <> 'SELESAI' or event.progress_percent <> 100 or event.verification_status <> 'LULUS')
  ) then
    raise exception using errcode = '23514', message = 'COMPLETED_EVENT_REQUIRES_COMPLETED_CASE';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_dp3a_integrity_case_record on public.dp3a_cases;
create constraint trigger trg_dp3a_integrity_case_record
after insert or update or delete on public.dp3a_cases
deferrable initially deferred for each row execute function public.dp3a_validate_domain_integrity();

drop trigger if exists trg_dp3a_integrity_realization on public.dp3a_realisasi_layanan;
create constraint trigger trg_dp3a_integrity_realization
after insert or update or delete on public.dp3a_realisasi_layanan
deferrable initially deferred for each row execute function public.dp3a_validate_domain_integrity();

drop trigger if exists trg_dp3a_integrity_event on public.dp3a_case_events;
create constraint trigger trg_dp3a_integrity_event
after insert or update or delete on public.dp3a_case_events
deferrable initially deferred for each row execute function public.dp3a_validate_domain_integrity();

drop trigger if exists trg_dp3a_integrity_program_details on public.dp3a_program_details;
create constraint trigger trg_dp3a_integrity_program_details
after insert or update or delete on public.dp3a_program_details
deferrable initially deferred for each row execute function public.dp3a_validate_domain_integrity();

drop trigger if exists trg_dp3a_integrity_master_program on public.master_program_layanan;
create constraint trigger trg_dp3a_integrity_master_program
after insert or update or delete on public.master_program_layanan
deferrable initially deferred for each row execute function public.dp3a_validate_domain_integrity();

drop trigger if exists trg_dp3a_integrity_referral on public.referral_mbi;
create constraint trigger trg_dp3a_integrity_referral
after insert or update or delete on public.referral_mbi
deferrable initially deferred for each row execute function public.dp3a_validate_domain_integrity();

revoke all on function public.dp3a_validate_domain_integrity() from public, anon, authenticated;
