-- Keep rowtype-specific NEW fields inside their matching trigger branch.
-- PostgreSQL resolves record fields when an expression is planned, so a
-- short-circuited boolean expression can still fail for another trigger table.

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
    if tg_table_name = 'referral_mbi' and tg_op <> 'DELETE' then
      if new.target_opd_id = disnaker_opd_id
         and new.jalur = 'PEKERJA'
         and new.status in ('DIPROSES', 'SELESAI') then
        raise exception using errcode = '23514', message = 'DISNAKER_INTERVENTION_REQUIRED';
      end if;
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

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.disnaker_validate_domain_integrity() from public, anon, authenticated;
