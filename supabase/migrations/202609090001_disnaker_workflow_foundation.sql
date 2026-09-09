-- Disnaker vocational intervention lifecycle. No fixture data is created here.

create table if not exists public.disnaker_program_details (
  program_id uuid primary key references public.master_program_layanan(id) on delete cascade,
  category varchar not null,
  institution varchar not null,
  location varchar,
  duration_value integer not null,
  duration_unit varchar not null,
  capacity integer not null,
  description text not null,
  qualification text,
  syllabus_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disnaker_program_duration_check check (duration_value between 1 and 60),
  constraint disnaker_program_duration_unit_check check (duration_unit in ('HARI', 'MINGGU', 'BULAN')),
  constraint disnaker_program_capacity_check check (capacity between 1 and 10000),
  constraint disnaker_program_text_check check (
    length(trim(category)) between 2 and 100
    and length(trim(institution)) between 3 and 200
    and length(trim(description)) between 10 and 3000
  )
);

create table if not exists public.disnaker_interventions (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null unique references public.referral_mbi(id) on delete cascade,
  program_id uuid not null references public.master_program_layanan(id),
  institution varchar not null,
  start_date date not null,
  participant_instruction text not null,
  participant_status varchar not null default 'AKTIF_PELATIHAN',
  attendance_percent integer,
  placement_partner varchar,
  placement_date date,
  evaluation_note text,
  created_by uuid not null references public.user_profiles(id),
  updated_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disnaker_participant_status_check check (
    participant_status in ('AKTIF_PELATIHAN', 'LULUS_MAGANG', 'BEKERJA_SELESAI', 'TIDAK_AKTIF')
  ),
  constraint disnaker_attendance_check check (attendance_percent between 0 and 100),
  constraint disnaker_intervention_instruction_check check (
    length(trim(participant_instruction)) between 10 and 2000
  ),
  constraint disnaker_completed_fields_check check (
    participant_status <> 'BEKERJA_SELESAI'
    or (
      length(trim(coalesce(placement_partner, ''))) between 3 and 200
      and placement_date is not null
      and length(trim(coalesce(evaluation_note, ''))) between 10 and 2000
    )
  )
);

create index if not exists idx_disnaker_interventions_program
on public.disnaker_interventions(program_id, participant_status);

create table if not exists public.disnaker_intervention_events (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.disnaker_interventions(id) on delete cascade,
  event_type varchar not null,
  attendance_percent integer,
  note text,
  actor_user_id uuid not null references public.user_profiles(id),
  event_at timestamptz not null default now(),
  constraint disnaker_intervention_event_type_check check (
    event_type in ('STARTED', 'PROGRESS_UPDATED', 'COMPLETED', 'CANCELLED')
  ),
  constraint disnaker_event_attendance_check check (attendance_percent between 0 and 100),
  constraint disnaker_event_note_check check (note is null or length(note) <= 2000)
);

create index if not exists idx_disnaker_intervention_events_timeline
on public.disnaker_intervention_events(intervention_id, event_at asc);

create unique index if not exists uq_disnaker_single_lifecycle_event
on public.disnaker_intervention_events(intervention_id, event_type)
where event_type in ('STARTED', 'COMPLETED', 'CANCELLED');

drop trigger if exists trg_disnaker_program_details_updated_at on public.disnaker_program_details;
create trigger trg_disnaker_program_details_updated_at
before update on public.disnaker_program_details
for each row execute function public.dinsos_touch_updated_at();

drop trigger if exists trg_disnaker_interventions_updated_at on public.disnaker_interventions;
create trigger trg_disnaker_interventions_updated_at
before update on public.disnaker_interventions
for each row execute function public.dinsos_touch_updated_at();

alter table public.disnaker_program_details enable row level security;
alter table public.disnaker_interventions enable row level security;
alter table public.disnaker_intervention_events enable row level security;

revoke all on table public.disnaker_program_details from anon, authenticated;
revoke all on table public.disnaker_interventions from anon, authenticated;
revoke all on table public.disnaker_intervention_events from anon, authenticated;

create or replace function public.disnaker_actor_allowed(
  p_actor_id uuid,
  p_opd_id uuid
)
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
      and opd.kode_opd = 'DISNAKER'
  );
$$;

create or replace function public.disnaker_start_intervention(
  p_referral_id uuid,
  p_actor_id uuid,
  p_actor_opd_id uuid,
  p_program_id uuid,
  p_institution text,
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
  intervention_id uuid;
begin
  if not public.disnaker_actor_allowed(p_actor_id, p_actor_opd_id) then
    raise exception using errcode = '42501', message = 'DISNAKER_ACTOR_REQUIRED';
  end if;
  if p_start_date is null
     or length(trim(coalesce(p_institution, ''))) not between 3 and 200
     or length(trim(coalesce(p_instruction, ''))) not between 10 and 2000 then
    raise exception using errcode = '23514', message = 'INVALID_INTERVENTION_INPUT';
  end if;

  select * into referral_row from public.referral_mbi
  where id = p_referral_id for update;
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

  select * into program_row from public.master_program_layanan
  where id = p_program_id for share;
  if not found or not program_row.is_active
     or program_row.opd_id <> p_actor_opd_id
     or program_row.jalur is distinct from 'PEKERJA' then
    raise exception using errcode = '23514', message = 'INVALID_PROGRAM';
  end if;

  insert into public.disnaker_interventions (
    referral_id, program_id, institution, start_date,
    participant_instruction, created_by, updated_by
  ) values (
    p_referral_id, p_program_id, trim(p_institution), p_start_date,
    trim(p_instruction), p_actor_id, p_actor_id
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
end;
$$;

create or replace function public.disnaker_complete_intervention(
  p_referral_id uuid,
  p_actor_id uuid,
  p_actor_opd_id uuid,
  p_placement_partner text,
  p_placement_date date,
  p_evaluation text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  referral_row public.referral_mbi%rowtype;
  intervention_row public.disnaker_interventions%rowtype;
begin
  if not public.disnaker_actor_allowed(p_actor_id, p_actor_opd_id) then
    raise exception using errcode = '42501', message = 'DISNAKER_ACTOR_REQUIRED';
  end if;
  if p_placement_date is null
     or length(trim(coalesce(p_placement_partner, ''))) not between 3 and 200
     or length(trim(coalesce(p_evaluation, ''))) not between 10 and 2000 then
    raise exception using errcode = '23514', message = 'INVALID_COMPLETION_INPUT';
  end if;

  select * into referral_row from public.referral_mbi
  where id = p_referral_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'REFERRAL_NOT_FOUND';
  end if;
  if referral_row.target_opd_id <> p_actor_opd_id or referral_row.jalur <> 'PEKERJA' then
    raise exception using errcode = '42501', message = 'TARGET_OPD_REQUIRED';
  end if;
  if referral_row.status <> 'DIPROSES' then
    raise exception using errcode = '23505', message = 'INTERVENTION_ALREADY_COMPLETED';
  end if;

  select * into intervention_row from public.disnaker_interventions
  where referral_id = p_referral_id for update;
  if not found or intervention_row.participant_status = 'BEKERJA_SELESAI' then
    raise exception using errcode = '23505', message = 'INTERVENTION_ALREADY_COMPLETED';
  end if;

  update public.disnaker_interventions set
    participant_status = 'BEKERJA_SELESAI',
    attendance_percent = coalesce(attendance_percent, 100),
    placement_partner = trim(p_placement_partner),
    placement_date = p_placement_date,
    evaluation_note = trim(p_evaluation),
    updated_by = p_actor_id
  where id = intervention_row.id;

  perform public.transition_referral_status(
    p_referral_id, 'SELESAI', p_actor_id, p_actor_opd_id,
    'Intervensi vokasi dan penempatan kerja selesai.'
  );

  insert into public.disnaker_intervention_events (
    intervention_id, event_type, attendance_percent, note, actor_user_id
  ) values (
    intervention_row.id, 'COMPLETED', coalesce(intervention_row.attendance_percent, 100),
    'Peserta berhasil ditempatkan kerja.', p_actor_id
  );

  return jsonb_build_object(
    'interventionId', intervention_row.id,
    'referralId', p_referral_id,
    'status', 'SELESAI'
  );
end;
$$;

create or replace function public.disnaker_create_program(
  p_actor_id uuid,
  p_actor_opd_id uuid,
  p_code text,
  p_name text,
  p_category text,
  p_institution text,
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
begin
  if not public.disnaker_actor_allowed(p_actor_id, p_actor_opd_id) then
    raise exception using errcode = '42501', message = 'DISNAKER_ACTOR_REQUIRED';
  end if;
  if p_code !~ '^PRG-[A-Z]{3}-[0-9]{2}$'
     or length(trim(coalesce(p_name, ''))) not between 5 and 200
     or length(trim(coalesce(p_category, ''))) not between 2 and 100
     or length(trim(coalesce(p_institution, ''))) not between 3 and 200
     or p_duration_value not between 1 and 60
     or p_duration_unit not in ('HARI', 'MINGGU', 'BULAN')
     or p_capacity not between 1 and 10000
     or length(trim(coalesce(p_description, ''))) not between 10 and 3000 then
    raise exception using errcode = '23514', message = 'INVALID_PROGRAM_INPUT';
  end if;

  insert into public.master_program_layanan (
    kode_program, nama_program, opd_id, jalur, jenis_intervensi, is_active
  ) values (
    p_code, trim(p_name), p_actor_opd_id, 'PEKERJA', 'VOKASI', true
  ) returning id into program_id;

  insert into public.disnaker_program_details (
    program_id, category, institution, location, duration_value,
    duration_unit, capacity, description, qualification
  ) values (
    program_id, trim(p_category), trim(p_institution), trim(p_institution),
    p_duration_value, p_duration_unit, p_capacity, trim(p_description),
    trim(p_description)
  );

  return jsonb_build_object(
    'programId', program_id,
    'code', p_code,
    'name', trim(p_name)
  );
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'PROGRAM_CODE_EXISTS';
end;
$$;

revoke all on function public.disnaker_actor_allowed(uuid, uuid) from public, anon, authenticated;
grant execute on function public.disnaker_actor_allowed(uuid, uuid) to service_role;
revoke all on function public.disnaker_start_intervention(uuid, uuid, uuid, uuid, text, date, text) from public, anon, authenticated;
grant execute on function public.disnaker_start_intervention(uuid, uuid, uuid, uuid, text, date, text) to service_role;
revoke all on function public.disnaker_complete_intervention(uuid, uuid, uuid, text, date, text) from public, anon, authenticated;
grant execute on function public.disnaker_complete_intervention(uuid, uuid, uuid, text, date, text) to service_role;
revoke all on function public.disnaker_create_program(uuid, uuid, text, text, text, text, integer, text, integer, text) from public, anon, authenticated;
grant execute on function public.disnaker_create_program(uuid, uuid, text, text, text, text, integer, text, integer, text) to service_role;
