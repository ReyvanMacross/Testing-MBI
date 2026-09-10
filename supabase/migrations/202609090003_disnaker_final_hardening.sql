-- Final Disnaker integrity hardening. Cross-table state is validated at commit.

alter table public.disnaker_penempatan_kerja
drop constraint if exists disnaker_placement_evaluation_required_check;

alter table public.disnaker_penempatan_kerja
add constraint disnaker_placement_evaluation_required_check
check (length(trim(coalesce(evaluasi_akhir, ''))) between 10 and 2000);

create index if not exists idx_disnaker_interventions_fixture
on public.disnaker_interventions(is_fixture)
where is_fixture;

create or replace function public.disnaker_validate_domain_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  intervention_row public.disnaker_interventions%rowtype;
  referral_row public.referral_mbi%rowtype;
  program_row public.master_program_layanan%rowtype;
  details_row public.disnaker_program_details%rowtype;
  placement_row public.disnaker_penempatan_kerja%rowtype;
  disnaker_opd_id uuid;
  active_count bigint;
  target_intervention_id uuid;
begin
  select id into disnaker_opd_id
  from public.master_opd
  where kode_opd = 'DISNAKER';

  if tg_table_name = 'disnaker_interventions' then
    target_intervention_id := case when tg_op = 'DELETE' then old.id else new.id end;
  elsif tg_table_name = 'disnaker_penempatan_kerja' then
    target_intervention_id := case when tg_op = 'DELETE' then old.intervention_id else new.intervention_id end;
  elsif tg_table_name = 'disnaker_program_details' then
    select id into target_intervention_id
    from public.disnaker_interventions
    where program_id = (case when tg_op = 'DELETE' then old.program_id else new.program_id end)
    limit 1;
  elsif tg_table_name = 'master_program_layanan' then
    select id into target_intervention_id
    from public.disnaker_interventions
    where program_id = (case when tg_op = 'DELETE' then old.id else new.id end)
    limit 1;
  else
    select id into target_intervention_id
    from public.disnaker_interventions
    where referral_id = (case when tg_op = 'DELETE' then old.id else new.id end);
  end if;

  if target_intervention_id is null then
    if tg_table_name = 'referral_mbi'
       and tg_op <> 'DELETE'
       and new.target_opd_id = disnaker_opd_id
       and new.jalur = 'PEKERJA'
       and new.status in ('DIPROSES', 'SELESAI') then
      raise exception using errcode = '23514', message = 'DISNAKER_INTERVENTION_REQUIRED';
    end if;
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select * into intervention_row
  from public.disnaker_interventions
  where id = target_intervention_id;
  if not found then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select * into referral_row
  from public.referral_mbi
  where id = intervention_row.referral_id;
  select * into program_row
  from public.master_program_layanan
  where id = intervention_row.program_id;
  select * into details_row
  from public.disnaker_program_details
  where program_id = intervention_row.program_id;
  select * into placement_row
  from public.disnaker_penempatan_kerja
  where intervention_id = intervention_row.id;

  if referral_row.id is null
     or referral_row.target_opd_id <> disnaker_opd_id
     or referral_row.referral_type <> 'JALUR_MBI'
     or referral_row.jalur <> 'PEKERJA' then
    raise exception using errcode = '23514', message = 'INVALID_DISNAKER_REFERRAL_LINK';
  end if;
  if program_row.id is null
     or program_row.opd_id <> disnaker_opd_id
     or program_row.jalur is distinct from 'PEKERJA'
     or details_row.program_id is null
     or details_row.lembaga_id is null
     or intervention_row.lembaga_id is distinct from details_row.lembaga_id then
    raise exception using errcode = '23514', message = 'INVALID_DISNAKER_PROGRAM_LINK';
  end if;

  select count(*) into active_count
  from public.disnaker_interventions
  where program_id = intervention_row.program_id
    and participant_status <> 'TIDAK_AKTIF';
  if active_count > details_row.capacity then
    raise exception using errcode = '23514', message = 'DISNAKER_PROGRAM_OVER_CAPACITY';
  end if;

  if placement_row.id is not null and placement_row.tanggal_penempatan < intervention_row.start_date then
    raise exception using errcode = '23514', message = 'PLACEMENT_BEFORE_START';
  end if;
  if intervention_row.participant_status = 'BEKERJA_SELESAI' and placement_row.id is null then
    raise exception using errcode = '23514', message = 'COMPLETED_INTERVENTION_REQUIRES_PLACEMENT';
  end if;
  if referral_row.status = 'SELESAI' and placement_row.id is null then
    raise exception using errcode = '23514', message = 'COMPLETED_REFERRAL_REQUIRES_PLACEMENT';
  end if;
  if referral_row.status = 'DIPROSES' and intervention_row.id is null then
    raise exception using errcode = '23514', message = 'PROCESSING_REFERRAL_REQUIRES_INTERVENTION';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_disnaker_integrity_intervention on public.disnaker_interventions;
create constraint trigger trg_disnaker_integrity_intervention
after insert or update or delete on public.disnaker_interventions
deferrable initially deferred
for each row execute function public.disnaker_validate_domain_integrity();

drop trigger if exists trg_disnaker_integrity_placement on public.disnaker_penempatan_kerja;
create constraint trigger trg_disnaker_integrity_placement
after insert or update or delete on public.disnaker_penempatan_kerja
deferrable initially deferred
for each row execute function public.disnaker_validate_domain_integrity();

drop trigger if exists trg_disnaker_integrity_program_details on public.disnaker_program_details;
create constraint trigger trg_disnaker_integrity_program_details
after insert or update or delete on public.disnaker_program_details
deferrable initially deferred
for each row execute function public.disnaker_validate_domain_integrity();

drop trigger if exists trg_disnaker_integrity_master_program on public.master_program_layanan;
create constraint trigger trg_disnaker_integrity_master_program
after insert or update or delete on public.master_program_layanan
deferrable initially deferred
for each row execute function public.disnaker_validate_domain_integrity();

drop trigger if exists trg_disnaker_integrity_referral on public.referral_mbi;
create constraint trigger trg_disnaker_integrity_referral
after insert or update or delete on public.referral_mbi
deferrable initially deferred
for each row execute function public.disnaker_validate_domain_integrity();

revoke all on function public.disnaker_validate_domain_integrity() from public, anon, authenticated;
