-- Fondasi verifikasi Kelurahan. Warga, wilayah, program, dan referral tetap
-- menggunakan tabel bersama; tabel ini hanya menyimpan pekerjaan lokal Kelurahan.

create table if not exists public.kelurahan_usulan (
  id uuid primary key default gen_random_uuid(),
  warga_id uuid not null references public.warga(id),
  kelurahan_id uuid not null references public.master_wilayah(id),
  kecamatan_id uuid not null references public.master_wilayah(id),
  rt varchar not null,
  rw varchar not null,
  estimated_desil integer not null,
  target_program_id uuid not null references public.master_program_layanan(id),
  reason text not null,
  status varchar not null default 'MENUNGGU_VERIFIKASI_RT_RW',
  kecamatan_usulan_id uuid unique references public.kecamatan_warga_usulan(id),
  submitted_to_kecamatan_at timestamptz,
  created_by uuid not null references public.user_profiles(id),
  updated_by uuid not null references public.user_profiles(id),
  version integer not null default 1,
  is_fixture boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kelurahan_usulan_desil_check check (estimated_desil between 1 and 5),
  constraint kelurahan_usulan_rt_rw_check check (
    rt ~ '^[0-9]{1,3}$' and rw ~ '^[0-9]{1,3}$'
  ),
  constraint kelurahan_usulan_reason_check check (length(trim(reason)) between 20 and 2000),
  constraint kelurahan_usulan_status_check check (status in (
    'MENUNGGU_VERIFIKASI_RT_RW', 'SURVEI_LAPANGAN',
    'SIAP_DIKIRIM_KECAMATAN', 'TERKIRIM_KECAMATAN', 'DITOLAK'
  )),
  constraint kelurahan_usulan_handoff_check check (
    (status = 'TERKIRIM_KECAMATAN' and kecamatan_usulan_id is not null and submitted_to_kecamatan_at is not null)
    or (status <> 'TERKIRIM_KECAMATAN' and kecamatan_usulan_id is null and submitted_to_kecamatan_at is null)
  ),
  constraint kelurahan_usulan_version_check check (version > 0)
);

create unique index if not exists uq_kelurahan_usulan_aktif_warga
on public.kelurahan_usulan(warga_id)
where status not in ('TERKIRIM_KECAMATAN', 'DITOLAK');
create index if not exists idx_kelurahan_usulan_queue
on public.kelurahan_usulan(kelurahan_id, status, created_at desc);
create index if not exists idx_kelurahan_usulan_kecamatan
on public.kelurahan_usulan(kecamatan_id, submitted_to_kecamatan_at desc);
create index if not exists idx_kelurahan_usulan_fixture
on public.kelurahan_usulan(is_fixture) where is_fixture;

create table if not exists public.kelurahan_surveys (
  id uuid primary key default gen_random_uuid(),
  usulan_id uuid not null unique references public.kelurahan_usulan(id) on delete cascade,
  surveyor_profile_id uuid references public.user_profiles(id),
  surveyor_name varchar not null,
  instruction text not null,
  status varchar not null default 'DITUGASKAN',
  score integer,
  factual_desil integer,
  factual_notes text,
  surveyed_at timestamptz,
  version integer not null default 1,
  is_fixture boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kelurahan_survey_status_check check (status in ('DITUGASKAN', 'SELESAI')),
  constraint kelurahan_survey_score_check check (score is null or score between 0 and 100),
  constraint kelurahan_survey_desil_check check (factual_desil is null or factual_desil between 1 and 5),
  constraint kelurahan_survey_name_check check (length(trim(surveyor_name)) between 3 and 150),
  constraint kelurahan_survey_instruction_check check (length(trim(instruction)) between 10 and 2000),
  constraint kelurahan_survey_notes_check check (
    factual_notes is null or length(trim(factual_notes)) between 20 and 3000
  ),
  constraint kelurahan_survey_version_check check (version > 0)
);

create index if not exists idx_kelurahan_surveys_status
on public.kelurahan_surveys(status, created_at desc);
create index if not exists idx_kelurahan_surveys_fixture
on public.kelurahan_surveys(is_fixture) where is_fixture;

create table if not exists public.kelurahan_documents (
  id uuid primary key default gen_random_uuid(),
  usulan_id uuid not null references public.kelurahan_usulan(id) on delete cascade,
  survey_id uuid references public.kelurahan_surveys(id) on delete cascade,
  document_type varchar not null,
  label varchar not null,
  storage_path text,
  mime_type varchar,
  size_bytes bigint,
  verification_status varchar not null default 'TERLAMPIR',
  is_fixture boolean not null default false,
  created_at timestamptz not null default now(),
  constraint kelurahan_document_type_check check (document_type in (
    'KTP', 'KK', 'FORM_PENGANTAR_RT_RW', 'FOTO_LAPANGAN', 'FORMULIR_SURVEI', 'LAINNYA'
  )),
  constraint kelurahan_document_status_check check (verification_status in (
    'TERLAMPIR', 'TERVERIFIKASI', 'VALID', 'LENGKAP', 'DITOLAK'
  )),
  constraint kelurahan_document_label_check check (length(trim(label)) between 3 and 200),
  constraint kelurahan_document_size_check check (size_bytes is null or size_bytes between 0 and 10485760)
);

create index if not exists idx_kelurahan_documents_usulan
on public.kelurahan_documents(usulan_id, created_at);
create index if not exists idx_kelurahan_documents_fixture
on public.kelurahan_documents(is_fixture) where is_fixture;

create table if not exists public.kelurahan_events (
  id uuid primary key default gen_random_uuid(),
  usulan_id uuid not null references public.kelurahan_usulan(id) on delete cascade,
  event_type varchar not null,
  title varchar not null,
  note text,
  actor_user_id uuid not null references public.user_profiles(id),
  metadata jsonb not null default '{}'::jsonb,
  event_at timestamptz not null default now(),
  constraint kelurahan_event_type_check check (event_type in (
    'PROPOSAL_CREATED', 'SURVEY_ASSIGNED', 'SURVEY_COMPLETED', 'SENT_TO_KECAMATAN'
  )),
  constraint kelurahan_event_title_check check (length(trim(title)) between 3 and 200),
  constraint kelurahan_event_note_check check (note is null or length(trim(note)) between 3 and 2000)
);

create index if not exists idx_kelurahan_events_timeline
on public.kelurahan_events(usulan_id, event_at asc);

create table if not exists public.kelurahan_helpdesk_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_code varchar not null unique,
  kelurahan_id uuid not null references public.master_wilayah(id),
  category varchar not null,
  description text not null,
  status varchar not null default 'TERKIRIM',
  submitted_by uuid not null references public.user_profiles(id),
  is_fixture boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kelurahan_helpdesk_category_check check (length(trim(category)) between 3 and 100),
  constraint kelurahan_helpdesk_description_check check (length(trim(description)) between 20 and 2000),
  constraint kelurahan_helpdesk_status_check check (status in ('TERKIRIM', 'DIPROSES', 'SELESAI', 'DITUTUP'))
);

create index if not exists idx_kelurahan_helpdesk_queue
on public.kelurahan_helpdesk_tickets(kelurahan_id, status, created_at desc);
create sequence if not exists public.kelurahan_ticket_code_seq;

create or replace function public.kelurahan_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.kelurahan_touch_updated_at() from public, anon, authenticated;
grant execute on function public.kelurahan_touch_updated_at() to service_role;

drop trigger if exists trg_kelurahan_usulan_updated_at on public.kelurahan_usulan;
create trigger trg_kelurahan_usulan_updated_at before update on public.kelurahan_usulan
for each row execute function public.kelurahan_touch_updated_at();
drop trigger if exists trg_kelurahan_surveys_updated_at on public.kelurahan_surveys;
create trigger trg_kelurahan_surveys_updated_at before update on public.kelurahan_surveys
for each row execute function public.kelurahan_touch_updated_at();
drop trigger if exists trg_kelurahan_helpdesk_updated_at on public.kelurahan_helpdesk_tickets;
create trigger trg_kelurahan_helpdesk_updated_at before update on public.kelurahan_helpdesk_tickets
for each row execute function public.kelurahan_touch_updated_at();

do $$ declare t text; begin
  foreach t in array array[
    'kelurahan_usulan', 'kelurahan_surveys', 'kelurahan_documents',
    'kelurahan_events', 'kelurahan_helpdesk_tickets'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

revoke all on sequence public.kelurahan_ticket_code_seq from public, anon, authenticated;
