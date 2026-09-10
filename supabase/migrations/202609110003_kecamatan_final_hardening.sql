-- Constraint lintas tabel dan audit integritas akhir workflow Kecamatan.

create or replace function public.kecamatan_guard_proposal_scope()
returns trigger language plpgsql set search_path = public as $$
declare
  warga_kecamatan uuid;
  warga_kelurahan uuid;
  kelurahan_parent uuid;
begin
  select kecamatan_id, kelurahan_id into warga_kecamatan, warga_kelurahan
  from public.warga where id = new.warga_id;
  select parent_id into kelurahan_parent from public.master_wilayah
  where id = new.kelurahan_id and jenis = 'KELURAHAN' and is_active;
  if warga_kecamatan is distinct from new.kecamatan_id
     or warga_kelurahan is distinct from new.kelurahan_id
     or kelurahan_parent is distinct from new.kecamatan_id then
    raise exception using errcode = '23514', message = 'INVALID_KECAMATAN_JURISDICTION';
  end if;
  if not public.kecamatan_actor_allowed(new.created_by, new.kecamatan_id)
     or not public.kecamatan_actor_allowed(new.updated_by, new.kecamatan_id) then
    raise exception using errcode = '42501', message = 'KECAMATAN_ACTOR_REQUIRED';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_kecamatan_guard_proposal_scope on public.kecamatan_warga_usulan;
create trigger trg_kecamatan_guard_proposal_scope
before insert or update on public.kecamatan_warga_usulan
for each row execute function public.kecamatan_guard_proposal_scope();

create or replace function public.kecamatan_guard_referral_detail()
returns trigger language plpgsql set search_path = public as $$
declare
  proposal public.kecamatan_warga_usulan%rowtype;
  survey public.kecamatan_survei%rowtype;
  referral public.referral_mbi%rowtype;
begin
  select * into proposal from public.kecamatan_warga_usulan where id = new.usulan_id;
  select * into survey from public.kecamatan_survei where id = new.survei_id;
  select * into referral from public.referral_mbi where id = new.referral_id;
  if proposal.id is null or survey.id is null or referral.id is null
     or proposal.kecamatan_id is distinct from new.kecamatan_id
     or survey.usulan_id is distinct from proposal.id
     or survey.status <> 'DISETUJUI'
     or referral.warga_id is distinct from proposal.warga_id
     or referral.referral_type <> 'JALUR_MBI'
     or referral.status = 'MENUNGGU_RUJUKAN'
     or referral.sent_at is null or referral.program_id is null
     or referral.is_fixture is distinct from new.is_fixture
     or proposal.is_fixture is distinct from new.is_fixture then
    raise exception using errcode = '23514', message = 'INVALID_KECAMATAN_REFERRAL_LINEAGE';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_kecamatan_guard_referral_detail on public.kecamatan_referral_details;
create trigger trg_kecamatan_guard_referral_detail
before insert or update on public.kecamatan_referral_details
for each row execute function public.kecamatan_guard_referral_detail();

create unique index if not exists uq_kecamatan_lifecycle_event
on public.kecamatan_events(usulan_id, event_type)
where event_type in ('PROPOSAL_CREATED', 'SURVEY_ASSIGNED', 'SURVEY_APPROVED', 'REFERRAL_SENT');

create or replace function public.kecamatan_validate_domain_integrity()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  violations jsonb;
begin
  with checks(check_name, violating_rows) as (
    select 'INVALID_PROPOSAL_JURISDICTION', count(*)
    from public.kecamatan_warga_usulan proposal
    join public.warga warga on warga.id = proposal.warga_id
    left join public.master_wilayah kelurahan on kelurahan.id = proposal.kelurahan_id
    where warga.kecamatan_id is distinct from proposal.kecamatan_id
       or warga.kelurahan_id is distinct from proposal.kelurahan_id
       or kelurahan.parent_id is distinct from proposal.kecamatan_id
       or kelurahan.jenis is distinct from 'KELURAHAN'
    union all
    select 'PROPOSAL_WITHOUT_CREATED_EVENT', count(*)
    from public.kecamatan_warga_usulan proposal
    where not exists (
      select 1 from public.kecamatan_events event
      where event.usulan_id = proposal.id and event.event_type = 'PROPOSAL_CREATED'
    )
    union all
    select 'SURVEY_STATE_MISMATCH', count(*)
    from public.kecamatan_survei survey
    join public.kecamatan_warga_usulan proposal on proposal.id = survey.usulan_id
    where (survey.status = 'DITUGASKAN' and proposal.status <> 'SURVEI_DITUGASKAN')
       or (survey.status = 'MENUNGGU_PERSETUJUAN' and proposal.status <> 'MENUNGGU_PERSETUJUAN')
       or (survey.status = 'DISETUJUI' and proposal.status not in ('DISETUJUI', 'DIRUJUK'))
    union all
    select 'APPROVED_SURVEY_INCOMPLETE', count(*)
    from public.kecamatan_survei
    where status = 'DISETUJUI'
      and (skor is null or desil_faktual is null or surveyed_at is null or reviewed_by is null or reviewed_at is null)
    union all
    select 'REFERRED_WITHOUT_DETAIL', count(*)
    from public.kecamatan_warga_usulan proposal
    where proposal.status = 'DIRUJUK' and not exists (
      select 1 from public.kecamatan_referral_details detail where detail.usulan_id = proposal.id
    )
    union all
    select 'REFERRAL_LINEAGE_MISMATCH', count(*)
    from public.kecamatan_referral_details detail
    join public.kecamatan_warga_usulan proposal on proposal.id = detail.usulan_id
    join public.kecamatan_survei survey on survey.id = detail.survei_id
    join public.referral_mbi referral on referral.id = detail.referral_id
    where detail.kecamatan_id is distinct from proposal.kecamatan_id
       or survey.usulan_id is distinct from proposal.id
       or referral.warga_id is distinct from proposal.warga_id
       or referral.program_id is distinct from proposal.target_program_id
       or referral.referral_type <> 'JALUR_MBI'
       or referral.case_id is not null
       or referral.is_fixture is distinct from detail.is_fixture
    union all
    select 'CROSS_JURISDICTION_HELPDESK', count(*)
    from public.kecamatan_helpdesk_tickets ticket
    join public.warga warga on warga.id = ticket.warga_id
    where ticket.warga_id is not null and warga.kecamatan_id is distinct from ticket.kecamatan_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('check', check_name, 'count', violating_rows))
    filter (where violating_rows > 0), '[]'::jsonb) into violations from checks;
  if jsonb_array_length(violations) > 0 then
    raise exception using errcode = '23514', message = 'KECAMATAN_INTEGRITY_VIOLATION', detail = violations::text;
  end if;
  return jsonb_build_object('status', 'PASS', 'violations', 0);
end;
$$;

do $$ declare signature regprocedure; begin
  foreach signature in array array[
    'public.kecamatan_guard_proposal_scope()'::regprocedure,
    'public.kecamatan_guard_referral_detail()'::regprocedure,
    'public.kecamatan_validate_domain_integrity()'::regprocedure
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', signature);
    execute format('grant execute on function %s to service_role', signature);
  end loop;
end $$;
