-- Canonical Disnaker operational masters and intervention lifecycle closure.
-- Migration 001 remains the immutable foundation and is upgraded here.

create table if not exists public.disnaker_lembaga_pelaksana (
  id uuid primary key default gen_random_uuid(),
  kode varchar not null unique,
  nama varchar not null,
  jenis varchar not null,
  alamat text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disnaker_lembaga_jenis_check
    check (jenis in ('BLK', 'LPK', 'LAINNYA')),
  constraint disnaker_lembaga_text_check
    check (length(trim(kode)) between 3 and 50 and length(trim(nama)) between 3 and 200)
);

create table if not exists public.disnaker_mitra_industri (
  id uuid primary key default gen_random_uuid(),
  kode_mitra varchar not null unique,
  nama_perusahaan varchar not null,
  sektor_industri varchar,
  status_kemitraan varchar not null default 'AKTIF',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disnaker_mitra_status_check
    check (status_kemitraan in ('AKTIF', 'NONAKTIF')),
  constraint disnaker_mitra_text_check
    check (
      length(trim(kode_mitra)) between 3 and 80
      and length(trim(nama_perusahaan)) between 3 and 200
      and (sektor_industri is null or length(trim(sektor_industri)) between 2 and 150)
    )
);

alter table public.disnaker_program_details
add column if not exists lembaga_id uuid
  references public.disnaker_lembaga_pelaksana(id);

alter table public.disnaker_interventions
add column if not exists lembaga_id uuid
  references public.disnaker_lembaga_pelaksana(id),
add column if not exists is_fixture boolean not null default false;

create table if not exists public.disnaker_penempatan_kerja (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null unique
    references public.disnaker_interventions(id) on delete cascade,
  mitra_industri_id uuid not null
    references public.disnaker_mitra_industri(id),
  tanggal_penempatan date not null,
  status_pekerja varchar not null default 'AKTIF_BEKERJA',
  evaluasi_akhir text,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disnaker_worker_status_check
    check (status_pekerja in ('AKTIF_BEKERJA', 'BERHENTI')),
  constraint disnaker_placement_evaluation_check
    check (evaluasi_akhir is null or length(trim(evaluasi_akhir)) between 10 and 2000)
);

create index if not exists idx_disnaker_program_lembaga
on public.disnaker_program_details(lembaga_id);
create index if not exists idx_disnaker_intervention_lembaga
on public.disnaker_interventions(lembaga_id);
create index if not exists idx_disnaker_penempatan_mitra
on public.disnaker_penempatan_kerja(mitra_industri_id);
create index if not exists idx_disnaker_penempatan_date
on public.disnaker_penempatan_kerja(tanggal_penempatan desc);

drop trigger if exists trg_disnaker_lembaga_updated_at on public.disnaker_lembaga_pelaksana;
create trigger trg_disnaker_lembaga_updated_at
before update on public.disnaker_lembaga_pelaksana
for each row execute function public.dinsos_touch_updated_at();

drop trigger if exists trg_disnaker_mitra_updated_at on public.disnaker_mitra_industri;
create trigger trg_disnaker_mitra_updated_at
before update on public.disnaker_mitra_industri
for each row execute function public.dinsos_touch_updated_at();

drop trigger if exists trg_disnaker_penempatan_updated_at on public.disnaker_penempatan_kerja;
create trigger trg_disnaker_penempatan_updated_at
before update on public.disnaker_penempatan_kerja
for each row execute function public.dinsos_touch_updated_at();

alter table public.disnaker_lembaga_pelaksana enable row level security;
alter table public.disnaker_mitra_industri enable row level security;
alter table public.disnaker_penempatan_kerja enable row level security;

revoke all on table public.disnaker_lembaga_pelaksana from anon, authenticated;
revoke all on table public.disnaker_mitra_industri from anon, authenticated;
revoke all on table public.disnaker_penempatan_kerja from anon, authenticated;

drop function if exists public.disnaker_start_intervention(uuid, uuid, uuid, uuid, text, date, text);

create function public.disnaker_start_intervention(
  p_referral_id uuid,
  p_actor_id uuid,
  p_actor_opd_id uuid,
  p_program_id uuid,
  p_lembaga_id uuid,
  p_start_date date,
  p_instruction text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  referral_row public.referral_mbi%rowtype;
  program_row public.master_program_layanan%rowtype;
  details_row public.disnaker_program_details%rowtype;
  lembaga_row public.disnaker_lembaga_pelaksana%rowtype;
  active_participants bigint;
  intervention_id uuid;
begin
  if not public.disnaker_actor_allowed(p_actor_id, p_actor_opd_id) then
    raise exception using errcode = '42501', message = 'DISNAKER_ACTOR_REQUIRED';
  end if;
  if p_start_date is null
     or length(trim(coalesce(p_instruction, ''))) not between 10 and 2000 then
    raise exception using errcode = '23514', message = 'INVALID_INTERVENTION_INPUT';
  end if;

  select * into referral_row
  from public.referral_mbi
  where id = p_referral_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'REFERRAL_NOT_FOUND';
  end if;
  if referral_row.target_opd_id <> p_actor_opd_id
     or referral_row.referral_type <> 'JALUR_MBI'
     or referral_row.jalur <> 'PEKERJA' then
    raise exception using errcode = '42501', message = 'TARGET_OPD_REQUIRED';
  end if;
  if referral_row.status <> 'TERKIRIM'
     or exists (select 1 from public.disnaker_interventions where referral_id = p_referral_id) then
    raise exception using errcode = '23505', message = 'INTERVENTION_ALREADY_STARTED';
  end if;

  select * into program_row
  from public.master_program_layanan
  where id = p_program_id;
  if not found or not program_row.is_active
     or program_row.opd_id <> p_actor_opd_id
     or program_row.jalur is distinct from 'PEKERJA' then
    raise exception using errcode = '23514', message = 'INVALID_PROGRAM';
  end if;

  select * into details_row
  from public.disnaker_program_details
  where program_id = p_program_id
  for update;
  if not found or details_row.lembaga_id is null or details_row.lembaga_id <> p_lembaga_id then
    raise exception using errcode = '23514', message = 'INVALID_PROGRAM_PROVIDER';
  end if;

  select * into lembaga_row
  from public.disnaker_lembaga_pelaksana
  where id = p_lembaga_id and is_active;
  if not found then
    raise exception using errcode = '23514', message = 'INVALID_PROGRAM_PROVIDER';
  end if;

  select count(*) into active_participants
  from public.disnaker_interventions
  where program_id = p_program_id
    and participant_status <> 'TIDAK_AKTIF';
  if active_participants >= details_row.capacity then
    raise exception using errcode = '23505', message = 'PROGRAM_CAPACITY_FULL';
  end if;

  insert into public.disnaker_interventions (
    referral_id, program_id, lembaga_id, institution, start_date,
    participant_instruction, created_by, updated_by,
    is_fixture
  ) values (
    p_referral_id, p_program_id, p_lembaga_id, trim(lembaga_row.nama), p_start_date,
    trim(p_instruction), p_actor_id, p_actor_id,
    referral_row.is_fixture
  ) returning id into intervention_id;

  perform public.transition_referral_status(
    p_referral_id, 'DITERIMA', p_actor_id, p_actor_opd_id,
    'Rujukan diterima untuk proses vokasi.'
  );
  perform public.transition_referral_status(
    p_referral_id, 'DIPROSES', p_actor_id, p_actor_opd_id,
    'Peserta mulai mengikuti program vokasi.'
  );

  insert into public.disnaker_intervention_events (
    intervention_id, event_type, note, actor_user_id
  ) values (
    intervention_id, 'STARTED', 'Program vokasi dimulai.', p_actor_id
  );

  return jsonb_build_object(
    'interventionId', intervention_id,
    'referralId', p_referral_id,
    'status', 'DIPROSES'
  );
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'INTERVENTION_ALREADY_STARTED';
end;
$$;

create or replace function public.disnaker_update_intervention_progress(
  p_intervention_id uuid,
  p_actor_id uuid,
  p_actor_opd_id uuid,
  p_participant_status text,
  p_attendance_percent integer,
  p_evaluation_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  intervention_row public.disnaker_interventions%rowtype;
  referral_row public.referral_mbi%rowtype;
begin
  if not public.disnaker_actor_allowed(p_actor_id, p_actor_opd_id) then
    raise exception using errcode = '42501', message = 'DISNAKER_ACTOR_REQUIRED';
  end if;
  if p_participant_status not in ('AKTIF_PELATIHAN', 'LULUS_MAGANG', 'TIDAK_AKTIF')
     or p_participant_status is null
     or p_attendance_percent is null
     or p_attendance_percent not between 0 and 100
     or length(trim(coalesce(p_evaluation_note, ''))) not between 10 and 2000 then
    raise exception using errcode = '23514', message = 'INVALID_PROGRESS_INPUT';
  end if;

  select * into intervention_row
  from public.disnaker_interventions
  where id = p_intervention_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'INTERVENTION_NOT_FOUND';
  end if;

  select * into referral_row
  from public.referral_mbi
  where id = intervention_row.referral_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'REFERRAL_NOT_FOUND';
  end if;
  if referral_row.target_opd_id <> p_actor_opd_id or referral_row.jalur <> 'PEKERJA' then
    raise exception using errcode = '42501', message = 'TARGET_OPD_REQUIRED';
  end if;
  if referral_row.status <> 'DIPROSES'
     or intervention_row.participant_status = 'BEKERJA_SELESAI' then
    raise exception using errcode = '23505', message = 'INTERVENTION_ALREADY_COMPLETED';
  end if;

  update public.disnaker_interventions
  set participant_status = p_participant_status,
      attendance_percent = p_attendance_percent,
      evaluation_note = trim(p_evaluation_note),
      updated_by = p_actor_id
  where id = intervention_row.id;

  insert into public.disnaker_intervention_events (
    intervention_id, event_type, attendance_percent, note, actor_user_id
  ) values (
    intervention_row.id, 'PROGRESS_UPDATED', p_attendance_percent,
    trim(p_evaluation_note), p_actor_id
  );

  return jsonb_build_object(
    'interventionId', intervention_row.id,
    'referralId', referral_row.id,
    'participantStatus', p_participant_status,
    'attendancePercent', p_attendance_percent,
    'referralStatus', referral_row.status
  );
end;
$$;

drop function if exists public.disnaker_complete_intervention(uuid, uuid, uuid, text, date, text);

create function public.disnaker_complete_intervention(
  p_intervention_id uuid,
  p_actor_id uuid,
  p_actor_opd_id uuid,
  p_mitra_industri_id uuid,
  p_placement_date date,
  p_evaluation text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  intervention_row public.disnaker_interventions%rowtype;
  referral_row public.referral_mbi%rowtype;
  mitra_row public.disnaker_mitra_industri%rowtype;
  placement_id uuid;
begin
  if not public.disnaker_actor_allowed(p_actor_id, p_actor_opd_id) then
    raise exception using errcode = '42501', message = 'DISNAKER_ACTOR_REQUIRED';
  end if;
  if p_placement_date is null
     or length(trim(coalesce(p_evaluation, ''))) not between 10 and 2000 then
    raise exception using errcode = '23514', message = 'INVALID_COMPLETION_INPUT';
  end if;

  select * into intervention_row
  from public.disnaker_interventions
  where id = p_intervention_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'INTERVENTION_NOT_FOUND';
  end if;

  select * into referral_row
  from public.referral_mbi
  where id = intervention_row.referral_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'REFERRAL_NOT_FOUND';
  end if;
  if referral_row.target_opd_id <> p_actor_opd_id or referral_row.jalur <> 'PEKERJA' then
    raise exception using errcode = '42501', message = 'TARGET_OPD_REQUIRED';
  end if;
  if referral_row.status <> 'DIPROSES'
     or intervention_row.participant_status = 'BEKERJA_SELESAI'
     or exists (
       select 1 from public.disnaker_penempatan_kerja
       where intervention_id = intervention_row.id
     ) then
    raise exception using errcode = '23505', message = 'INTERVENTION_ALREADY_COMPLETED';
  end if;
  if p_placement_date < intervention_row.start_date then
    raise exception using errcode = '23514', message = 'PLACEMENT_BEFORE_START';
  end if;

  select * into mitra_row
  from public.disnaker_mitra_industri
  where id = p_mitra_industri_id and status_kemitraan = 'AKTIF';
  if not found then
    raise exception using errcode = '23514', message = 'INVALID_INDUSTRY_PARTNER';
  end if;

  insert into public.disnaker_penempatan_kerja (
    intervention_id, mitra_industri_id, tanggal_penempatan,
    status_pekerja, evaluasi_akhir, created_by
  ) values (
    intervention_row.id, mitra_row.id, p_placement_date,
    'AKTIF_BEKERJA', trim(p_evaluation), p_actor_id
  ) returning id into placement_id;

  update public.disnaker_interventions
  set participant_status = 'BEKERJA_SELESAI',
      attendance_percent = coalesce(attendance_percent, 100),
      placement_partner = trim(mitra_row.nama_perusahaan),
      placement_date = p_placement_date,
      evaluation_note = trim(p_evaluation),
      updated_by = p_actor_id
  where id = intervention_row.id;

  insert into public.disnaker_intervention_events (
    intervention_id, event_type, attendance_percent, note, actor_user_id
  ) values (
    intervention_row.id, 'COMPLETED', coalesce(intervention_row.attendance_percent, 100),
    'Peserta berhasil ditempatkan kerja.', p_actor_id
  );

  perform public.transition_referral_status(
    referral_row.id, 'SELESAI', p_actor_id, p_actor_opd_id,
    'Intervensi vokasi dan penempatan kerja selesai.'
  );

  return jsonb_build_object(
    'interventionId', intervention_row.id,
    'placementId', placement_id,
    'referralId', referral_row.id,
    'status', 'SELESAI'
  );
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'INTERVENTION_ALREADY_COMPLETED';
end;
$$;

drop function if exists public.disnaker_create_program(uuid, uuid, text, text, text, text, integer, text, integer, text);

create function public.disnaker_create_program(
  p_actor_id uuid,
  p_actor_opd_id uuid,
  p_code text,
  p_name text,
  p_category text,
  p_lembaga_id uuid,
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
  program_id uuid;
  lembaga_row public.disnaker_lembaga_pelaksana%rowtype;
begin
  if not public.disnaker_actor_allowed(p_actor_id, p_actor_opd_id) then
    raise exception using errcode = '42501', message = 'DISNAKER_ACTOR_REQUIRED';
  end if;
  if p_code !~ '^PRG-[A-Z]{3}-[0-9]{2}$'
     or length(trim(coalesce(p_name, ''))) not between 5 and 200
     or length(trim(coalesce(p_category, ''))) not between 2 and 100
     or p_duration_value is null
     or p_duration_value not between 1 and 60
     or p_duration_unit is null
     or p_duration_unit not in ('HARI', 'MINGGU', 'BULAN')
     or p_capacity is null
     or p_capacity not between 1 and 10000
     or length(trim(coalesce(p_description, ''))) not between 10 and 3000 then
    raise exception using errcode = '23514', message = 'INVALID_PROGRAM_INPUT';
  end if;

  select * into lembaga_row
  from public.disnaker_lembaga_pelaksana
  where id = p_lembaga_id and is_active;
  if not found then
    raise exception using errcode = '23514', message = 'INVALID_PROGRAM_PROVIDER';
  end if;

  insert into public.master_program_layanan (
    kode_program, nama_program, opd_id, jalur, jenis_intervensi, is_active
  ) values (
    upper(trim(p_code)), trim(p_name), p_actor_opd_id, 'PEKERJA', 'VOKASI', true
  ) returning id into program_id;

  insert into public.disnaker_program_details (
    program_id, category, lembaga_id, institution, location,
    duration_value, duration_unit, capacity, description, qualification
  ) values (
    program_id, trim(p_category), lembaga_row.id, trim(lembaga_row.nama),
    coalesce(nullif(trim(lembaga_row.alamat), ''), trim(lembaga_row.nama)),
    p_duration_value, p_duration_unit, p_capacity, trim(p_description),
    trim(p_description)
  );

  return jsonb_build_object('programId', program_id, 'code', upper(trim(p_code)), 'name', trim(p_name));
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'PROGRAM_CODE_EXISTS';
end;
$$;

create or replace function public.list_disnaker_placement_partners(
  p_search text default null,
  p_sector text default null,
  p_status text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  company_id uuid,
  company_name varchar,
  sector varchar,
  workers_absorbed bigint,
  related_program text,
  partnership_status varchar,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with aggregate_rows as (
    select
      company.id as company_id,
      company.nama_perusahaan as company_name,
      company.sektor_industri as sector,
      count(placement.id)::bigint as workers_absorbed,
      string_agg(distinct program.nama_program, ', ' order by program.nama_program) as related_program,
      company.status_kemitraan as partnership_status
    from public.disnaker_mitra_industri company
    join public.disnaker_penempatan_kerja placement
      on placement.mitra_industri_id = company.id
    join public.disnaker_interventions intervention
      on intervention.id = placement.intervention_id
    join public.master_program_layanan program
      on program.id = intervention.program_id
    where (p_search is null or trim(p_search) = ''
      or company.nama_perusahaan ilike '%' || trim(p_search) || '%'
      or program.nama_program ilike '%' || trim(p_search) || '%')
      and (p_sector is null or trim(p_sector) = '' or company.sektor_industri = p_sector)
      and (p_status is null or trim(p_status) = '' or company.status_kemitraan = p_status)
    group by company.id, company.nama_perusahaan, company.sektor_industri, company.status_kemitraan
  )
  select aggregate_rows.*, count(*) over()::bigint
  from aggregate_rows
  order by workers_absorbed desc, company_name
  limit greatest(1, least(p_limit, 100))
  offset greatest(p_offset, 0);
$$;

revoke all on function public.disnaker_start_intervention(uuid, uuid, uuid, uuid, uuid, date, text) from public, anon, authenticated;
grant execute on function public.disnaker_start_intervention(uuid, uuid, uuid, uuid, uuid, date, text) to service_role;
revoke all on function public.disnaker_update_intervention_progress(uuid, uuid, uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.disnaker_update_intervention_progress(uuid, uuid, uuid, text, integer, text) to service_role;
revoke all on function public.disnaker_complete_intervention(uuid, uuid, uuid, uuid, date, text) from public, anon, authenticated;
grant execute on function public.disnaker_complete_intervention(uuid, uuid, uuid, uuid, date, text) to service_role;
revoke all on function public.disnaker_create_program(uuid, uuid, text, text, text, uuid, integer, text, integer, text) from public, anon, authenticated;
grant execute on function public.disnaker_create_program(uuid, uuid, text, text, text, uuid, integer, text, integer, text) to service_role;
revoke all on function public.list_disnaker_placement_partners(text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.list_disnaker_placement_partners(text, text, text, integer, integer) to service_role;
