-- Hardening integritas akhir Disdik. Seluruh relasi lintas tabel divalidasi saat commit.

create unique index if not exists uq_disdik_single_lifecycle_event
on public.disdik_intervention_events(intervention_id, event_type)
where event_type in ('STARTED', 'COMPLETED', 'CANCELLED');

create or replace function public.disdik_validate_domain_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  disdik_opd_id uuid;
begin
  select id into disdik_opd_id
  from public.master_opd
  where kode_opd = 'DISDIK';

  if disdik_opd_id is null then
    raise exception using errcode = '23514', message = 'DISDIK_OPD_REQUIRED';
  end if;

  if exists (
    select 1
    from public.disdik_program_details details
    left join public.master_program_layanan program on program.id = details.program_id
    left join public.disdik_sekolah school on school.id = details.sekolah_id
    where program.id is null
       or program.opd_id <> disdik_opd_id
       or program.jalur is distinct from 'PENGUATAN_DASAR'
       or school.id is null
  ) then
    raise exception using errcode = '23514', message = 'INVALID_DISDIK_PROGRAM_LINK';
  end if;

  if exists (
    select 1
    from public.disdik_interventions intervention
    left join public.referral_mbi referral on referral.id = intervention.referral_id
    left join public.master_program_layanan program on program.id = intervention.program_id
    left join public.disdik_program_details details on details.program_id = intervention.program_id
    where referral.id is null
       or referral.target_opd_id <> disdik_opd_id
       or referral.referral_type <> 'JALUR_MBI'
       or referral.jalur <> 'PENGUATAN_DASAR'
       or referral.program_id is distinct from intervention.program_id
       or program.id is null
       or program.opd_id <> disdik_opd_id
       or program.jalur is distinct from 'PENGUATAN_DASAR'
       or details.program_id is null
       or intervention.sekolah_id is distinct from details.sekolah_id
  ) then
    raise exception using errcode = '23514', message = 'INVALID_DISDIK_INTERVENTION_LINK';
  end if;

  if exists (
    select 1
    from public.referral_mbi referral
    where referral.target_opd_id = disdik_opd_id
      and referral.referral_type = 'JALUR_MBI'
      and referral.jalur = 'PENGUATAN_DASAR'
      and referral.status in ('DIPROSES', 'SELESAI')
      and not exists (
        select 1 from public.disdik_interventions intervention
        where intervention.referral_id = referral.id
      )
  ) then
    raise exception using errcode = '23514', message = 'DISDIK_INTERVENTION_REQUIRED';
  end if;

  if exists (
    select 1
    from public.disdik_program_details details
    left join public.disdik_interventions intervention
      on intervention.program_id = details.program_id
     and intervention.aid_status <> 'TIDAK_AKTIF'
    group by details.program_id, details.capacity
    having count(intervention.id) > details.capacity
  ) then
    raise exception using errcode = '23514', message = 'DISDIK_PROGRAM_OVER_CAPACITY';
  end if;

  if exists (
    select 1
    from public.disdik_realisasi_bantuan realization
    join public.disdik_interventions intervention on intervention.id = realization.intervention_id
    where realization.disbursement_date < intervention.start_date
       or realization.realized_amount > intervention.planned_budget
  ) then
    raise exception using errcode = '23514', message = 'INVALID_DISDIK_REALIZATION';
  end if;

  if exists (
    select 1
    from public.disdik_interventions intervention
    where not exists (
      select 1 from public.disdik_intervention_events event
      where event.intervention_id = intervention.id and event.event_type = 'STARTED'
    )
  ) then
    raise exception using errcode = '23514', message = 'STARTED_EVENT_REQUIRED';
  end if;

  if exists (
    select 1
    from public.disdik_interventions intervention
    join public.referral_mbi referral on referral.id = intervention.referral_id
    where intervention.aid_status = 'SELESAI'
      and (
        intervention.progress_percent <> 100
        or intervention.document_status <> 'LULUS'
        or referral.status <> 'SELESAI'
        or not exists (
          select 1 from public.disdik_realisasi_bantuan realization
          where realization.intervention_id = intervention.id
        )
        or not exists (
          select 1 from public.disdik_intervention_events event
          where event.intervention_id = intervention.id and event.event_type = 'COMPLETED'
        )
      )
  ) then
    raise exception using errcode = '23514', message = 'INVALID_DISDIK_COMPLETED_LIFECYCLE';
  end if;

  if exists (
    select 1
    from public.referral_mbi referral
    join public.disdik_interventions intervention on intervention.referral_id = referral.id
    where referral.status = 'SELESAI'
      and referral.target_opd_id = disdik_opd_id
      and referral.jalur = 'PENGUATAN_DASAR'
      and (
        intervention.aid_status <> 'SELESAI'
        or not exists (
          select 1 from public.disdik_realisasi_bantuan realization
          where realization.intervention_id = intervention.id
        )
      )
  ) then
    raise exception using errcode = '23514', message = 'COMPLETED_REFERRAL_REQUIRES_REALIZATION';
  end if;

  if exists (
    select 1
    from public.disdik_intervention_events event
    join public.disdik_interventions intervention on intervention.id = event.intervention_id
    where event.event_type = 'COMPLETED'
      and (intervention.aid_status <> 'SELESAI' or event.progress_percent <> 100 or event.document_status <> 'LULUS')
  ) then
    raise exception using errcode = '23514', message = 'COMPLETED_EVENT_REQUIRES_COMPLETED_INTERVENTION';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_disdik_integrity_intervention on public.disdik_interventions;
create constraint trigger trg_disdik_integrity_intervention
after insert or update or delete on public.disdik_interventions
deferrable initially deferred for each row execute function public.disdik_validate_domain_integrity();

drop trigger if exists trg_disdik_integrity_realization on public.disdik_realisasi_bantuan;
create constraint trigger trg_disdik_integrity_realization
after insert or update or delete on public.disdik_realisasi_bantuan
deferrable initially deferred for each row execute function public.disdik_validate_domain_integrity();

drop trigger if exists trg_disdik_integrity_event on public.disdik_intervention_events;
create constraint trigger trg_disdik_integrity_event
after insert or update or delete on public.disdik_intervention_events
deferrable initially deferred for each row execute function public.disdik_validate_domain_integrity();

drop trigger if exists trg_disdik_integrity_program_details on public.disdik_program_details;
create constraint trigger trg_disdik_integrity_program_details
after insert or update or delete on public.disdik_program_details
deferrable initially deferred for each row execute function public.disdik_validate_domain_integrity();

drop trigger if exists trg_disdik_integrity_master_program on public.master_program_layanan;
create constraint trigger trg_disdik_integrity_master_program
after insert or update or delete on public.master_program_layanan
deferrable initially deferred for each row execute function public.disdik_validate_domain_integrity();

drop trigger if exists trg_disdik_integrity_referral on public.referral_mbi;
create constraint trigger trg_disdik_integrity_referral
after insert or update or delete on public.referral_mbi
deferrable initially deferred for each row execute function public.disdik_validate_domain_integrity();

revoke all on function public.disdik_validate_domain_integrity() from public, anon, authenticated;
