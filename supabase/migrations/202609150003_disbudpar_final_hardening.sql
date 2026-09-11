-- Final Disbudpar integrity hardening. Cross-table state is validated at commit.

create unique index if not exists uq_disbudpar_single_lifecycle_event
on public.disbudpar_intervention_events(intervention_id, event_type)
where event_type in ('STARTED', 'COMPLETED', 'CANCELLED');

create or replace function public.disbudpar_validate_domain_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  intervention_row public.disbudpar_interventions%rowtype;
  referral_row public.referral_mbi%rowtype;
  program_row public.master_program_layanan%rowtype;
  details_row public.disbudpar_program_details%rowtype;
  beneficiary_row public.disbudpar_beneficiary_profiles%rowtype;
  outcome_row public.disbudpar_kemandirian_ekraf%rowtype;
  disbudpar_opd_id uuid;
  active_count bigint;
  target_intervention_id uuid;
begin
  select id into disbudpar_opd_id from public.master_opd where kode_opd = 'DISBUDPAR';

  if tg_table_name = 'disbudpar_interventions' then
    target_intervention_id := case when tg_op = 'DELETE' then old.id else new.id end;
  elsif tg_table_name = 'disbudpar_kemandirian_ekraf' then
    target_intervention_id := case when tg_op = 'DELETE' then old.intervention_id else new.intervention_id end;
  elsif tg_table_name = 'disbudpar_beneficiary_profiles' then
    select id into target_intervention_id from public.disbudpar_interventions
    where beneficiary_profile_id = (case when tg_op = 'DELETE' then old.id else new.id end) limit 1;
  elsif tg_table_name = 'disbudpar_program_details' then
    select id into target_intervention_id from public.disbudpar_interventions
    where program_id = (case when tg_op = 'DELETE' then old.program_id else new.program_id end) limit 1;
  elsif tg_table_name = 'master_program_layanan' then
    select id into target_intervention_id from public.disbudpar_interventions
    where program_id = (case when tg_op = 'DELETE' then old.id else new.id end) limit 1;
  else
    select id into target_intervention_id from public.disbudpar_interventions
    where referral_id = (case when tg_op = 'DELETE' then old.id else new.id end);
  end if;

  if target_intervention_id is null then
    if tg_table_name = 'referral_mbi' and tg_op <> 'DELETE' then
      if new.target_opd_id = disbudpar_opd_id
         and new.jalur = 'WIRAUSAHA'
         and new.status in ('DIPROSES', 'SELESAI')
         and exists (select 1 from public.disbudpar_program_details where program_id = new.program_id) then
        raise exception using errcode = '23514', message = 'DISBUDPAR_INTERVENTION_REQUIRED';
      end if;
    end if;
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select * into intervention_row from public.disbudpar_interventions where id = target_intervention_id;
  if not found then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  select * into referral_row from public.referral_mbi where id = intervention_row.referral_id;
  select * into program_row from public.master_program_layanan where id = intervention_row.program_id;
  select * into details_row from public.disbudpar_program_details where program_id = intervention_row.program_id;
  select * into beneficiary_row from public.disbudpar_beneficiary_profiles where id = intervention_row.beneficiary_profile_id;
  select * into outcome_row from public.disbudpar_kemandirian_ekraf where intervention_id = intervention_row.id;

  if referral_row.id is null
     or referral_row.target_opd_id <> disbudpar_opd_id
     or referral_row.referral_type <> 'JALUR_MBI'
     or referral_row.jalur <> 'WIRAUSAHA' then
    raise exception using errcode = '23514', message = 'INVALID_DISBUDPAR_REFERRAL_LINK';
  end if;
  if program_row.id is null
     or program_row.opd_id <> disbudpar_opd_id
     or program_row.jalur is distinct from 'WIRAUSAHA'
     or details_row.program_id is null
     or intervention_row.pendamping_id is distinct from details_row.pendamping_id then
    raise exception using errcode = '23514', message = 'INVALID_DISBUDPAR_PROGRAM_LINK';
  end if;
  if beneficiary_row.id is null or beneficiary_row.warga_id <> referral_row.warga_id then
    raise exception using errcode = '23514', message = 'INVALID_DISBUDPAR_BENEFICIARY_LINK';
  end if;

  select count(*) into active_count from public.disbudpar_interventions
  where program_id = intervention_row.program_id and participant_status <> 'TIDAK_AKTIF';
  if active_count > details_row.capacity then
    raise exception using errcode = '23514', message = 'DISBUDPAR_PROGRAM_OVER_CAPACITY';
  end if;
  if outcome_row.id is not null and outcome_row.tanggal_mandiri < intervention_row.start_date then
    raise exception using errcode = '23514', message = 'COMPLETION_BEFORE_START';
  end if;
  if intervention_row.participant_status = 'MANDIRI_SELESAI' and outcome_row.id is null then
    raise exception using errcode = '23514', message = 'COMPLETED_INTERVENTION_REQUIRES_OUTCOME';
  end if;
  if referral_row.status = 'SELESAI' and outcome_row.id is null then
    raise exception using errcode = '23514', message = 'COMPLETED_REFERRAL_REQUIRES_OUTCOME';
  end if;
  if outcome_row.id is not null
     and (intervention_row.participant_status <> 'MANDIRI_SELESAI'
          or intervention_row.progress_percent <> 100
          or intervention_row.creative_result_status <> 'AKTIF_TAMPIL_PRODUKSI_RUTIN') then
    raise exception using errcode = '23514', message = 'OUTCOME_REQUIRES_COMPLETED_INTERVENTION';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_disbudpar_integrity_intervention on public.disbudpar_interventions;
create constraint trigger trg_disbudpar_integrity_intervention
after insert or update or delete on public.disbudpar_interventions
deferrable initially deferred for each row execute function public.disbudpar_validate_domain_integrity();

drop trigger if exists trg_disbudpar_integrity_creative_outcome on public.disbudpar_kemandirian_ekraf;
create constraint trigger trg_disbudpar_integrity_creative_outcome
after insert or update or delete on public.disbudpar_kemandirian_ekraf
deferrable initially deferred for each row execute function public.disbudpar_validate_domain_integrity();

drop trigger if exists trg_disbudpar_integrity_beneficiary_profile on public.disbudpar_beneficiary_profiles;
create constraint trigger trg_disbudpar_integrity_beneficiary_profile
after insert or update or delete on public.disbudpar_beneficiary_profiles
deferrable initially deferred for each row execute function public.disbudpar_validate_domain_integrity();

drop trigger if exists trg_disbudpar_integrity_program_details on public.disbudpar_program_details;
create constraint trigger trg_disbudpar_integrity_program_details
after insert or update or delete on public.disbudpar_program_details
deferrable initially deferred for each row execute function public.disbudpar_validate_domain_integrity();

drop trigger if exists trg_disbudpar_integrity_master_program on public.master_program_layanan;
create constraint trigger trg_disbudpar_integrity_master_program
after insert or update or delete on public.master_program_layanan
deferrable initially deferred for each row execute function public.disbudpar_validate_domain_integrity();

drop trigger if exists trg_disbudpar_integrity_referral on public.referral_mbi;
create constraint trigger trg_disbudpar_integrity_referral
after insert or update or delete on public.referral_mbi
deferrable initially deferred for each row execute function public.disbudpar_validate_domain_integrity();

revoke all on function public.disbudpar_validate_domain_integrity() from public, anon, authenticated;
