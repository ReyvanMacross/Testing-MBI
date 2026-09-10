-- Fondasi workflow Kecamatan. Tidak memuat data master maupun fixture.

-- Rujukan kewilayahan tidak berasal dari kasus Dinsos, sehingga lineage kasus
-- dibuat opsional dan digantikan oleh kecamatan_referral_details.
alter table public.referral_mbi alter column case_id drop not null;

create table if not exists public.kecamatan_warga_usulan (
  id uuid primary key default gen_random_uuid(),
  warga_id uuid not null references public.warga(id),
  kecamatan_id uuid not null references public.master_wilayah(id),
  kelurahan_id uuid not null references public.master_wilayah(id),
  rt varchar not null,
  rw varchar not null,
  desil_awal integer not null,
  target_program_id uuid references public.master_program_layanan(id),
  alasan text not null,
  status varchar not null default 'MENUNGGU_SURVEI',
  created_by uuid not null references public.user_profiles(id),
  updated_by uuid not null references public.user_profiles(id),
  is_fixture boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kecamatan_usulan_desil_check check (desil_awal between 1 and 5),
  constraint kecamatan_usulan_status_check check (status in (
    'MENUNGGU_SURVEI', 'SURVEI_DITUGASKAN', 'MENUNGGU_PERSETUJUAN',
    'DISETUJUI', 'DIRUJUK', 'DITOLAK'
  )),
  constraint kecamatan_usulan_rt_rw_check check (
    rt ~ '^[0-9]{1,3}$' and rw ~ '^[0-9]{1,3}$'
  ),
  constraint kecamatan_usulan_alasan_check check (length(trim(alasan)) between 20 and 2000)
);

create unique index if not exists uq_kecamatan_usulan_aktif_warga
on public.kecamatan_warga_usulan(warga_id)
where status not in ('DIRUJUK', 'DITOLAK');
create index if not exists idx_kecamatan_usulan_queue
on public.kecamatan_warga_usulan(kecamatan_id, status, created_at);
create index if not exists idx_kecamatan_usulan_kelurahan
on public.kecamatan_warga_usulan(kelurahan_id, status);
create index if not exists idx_kecamatan_usulan_fixture
on public.kecamatan_warga_usulan(is_fixture) where is_fixture;

create table if not exists public.kecamatan_survei (
  id uuid primary key default gen_random_uuid(),
  usulan_id uuid not null unique references public.kecamatan_warga_usulan(id) on delete cascade,
  petugas_nama varchar not null,
  petugas_user_id uuid references public.user_profiles(id),
  assigned_by uuid not null references public.user_profiles(id),
  due_date date not null,
  instruction text not null,
  status varchar not null default 'DITUGASKAN',
  skor integer,
  desil_faktual integer,
  catatan_faktual text,
  surveyed_at timestamptz,
  reviewed_by uuid references public.user_profiles(id),
  reviewed_at timestamptz,
  review_note text,
  is_fixture boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kecamatan_survei_status_check check (status in (
    'DITUGASKAN', 'MENUNGGU_PERSETUJUAN', 'DISETUJUI', 'SURVEI_ULANG'
  )),
  constraint kecamatan_survei_score_check check (skor is null or skor between 0 and 100),
  constraint kecamatan_survei_desil_check check (desil_faktual is null or desil_faktual between 1 and 5),
  constraint kecamatan_survei_petugas_check check (length(trim(petugas_nama)) between 3 and 150),
  constraint kecamatan_survei_instruction_check check (length(trim(instruction)) between 10 and 2000),
  constraint kecamatan_survei_catatan_check check (
    catatan_faktual is null or length(trim(catatan_faktual)) between 20 and 3000
  ),
  constraint kecamatan_survei_review_check check (
    review_note is null or length(trim(review_note)) between 10 and 2000
  )
);

create index if not exists idx_kecamatan_survei_status
on public.kecamatan_survei(status, due_date);
create index if not exists idx_kecamatan_survei_fixture
on public.kecamatan_survei(is_fixture) where is_fixture;

create table if not exists public.kecamatan_documents (
  id uuid primary key default gen_random_uuid(),
  usulan_id uuid not null references public.kecamatan_warga_usulan(id) on delete cascade,
  survei_id uuid references public.kecamatan_survei(id) on delete cascade,
  document_type varchar not null,
  label varchar not null,
  storage_path text,
  mime_type varchar,
  size_bytes bigint,
  verification_status varchar not null default 'TERLAMPIR',
  is_fixture boolean not null default false,
  created_at timestamptz not null default now(),
  constraint kecamatan_document_type_check check (document_type in (
    'KTP', 'KK', 'SURAT_RUJUKAN', 'SURAT_PERNYATAAN', 'FOTO_LAPANGAN', 'FORMULIR_SURVEI', 'LAINNYA'
  )),
  constraint kecamatan_document_status_check check (verification_status in (
    'TERLAMPIR', 'TERVERIFIKASI', 'VALID', 'DITOLAK'
  )),
  constraint kecamatan_document_label_check check (length(trim(label)) between 3 and 200),
  constraint kecamatan_document_size_check check (size_bytes is null or size_bytes between 0 and 10485760)
);

create index if not exists idx_kecamatan_documents_usulan
on public.kecamatan_documents(usulan_id, created_at);
create index if not exists idx_kecamatan_documents_fixture
on public.kecamatan_documents(is_fixture) where is_fixture;

create table if not exists public.kecamatan_referral_details (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null unique references public.referral_mbi(id) on delete cascade,
  usulan_id uuid not null unique references public.kecamatan_warga_usulan(id) on delete cascade,
  survei_id uuid not null references public.kecamatan_survei(id),
  kecamatan_id uuid not null references public.master_wilayah(id),
  kategori_layanan varchar not null,
  sla_hours integer not null default 48,
  is_fixture boolean not null default false,
  created_at timestamptz not null default now(),
  constraint kecamatan_referral_category_check check (length(trim(kategori_layanan)) between 3 and 250),
  constraint kecamatan_referral_sla_check check (sla_hours between 1 and 720)
);

create index if not exists idx_kecamatan_referral_kecamatan
on public.kecamatan_referral_details(kecamatan_id, created_at desc);
create index if not exists idx_kecamatan_referral_fixture
on public.kecamatan_referral_details(is_fixture) where is_fixture;

create table if not exists public.kecamatan_events (
  id uuid primary key default gen_random_uuid(),
  usulan_id uuid not null references public.kecamatan_warga_usulan(id) on delete cascade,
  referral_id uuid references public.referral_mbi(id) on delete cascade,
  event_type varchar not null,
  title varchar not null,
  note text,
  actor_user_id uuid not null references public.user_profiles(id),
  metadata jsonb not null default '{}'::jsonb,
  event_at timestamptz not null default now(),
  constraint kecamatan_event_type_check check (event_type in (
    'PROPOSAL_CREATED', 'SURVEY_ASSIGNED', 'SURVEY_SUBMITTED',
    'SURVEY_APPROVED', 'SURVEY_REPEAT_REQUESTED', 'REFERRAL_SENT'
  )),
  constraint kecamatan_event_title_check check (length(trim(title)) between 3 and 200),
  constraint kecamatan_event_note_check check (note is null or length(trim(note)) between 3 and 2000)
);

create index if not exists idx_kecamatan_events_timeline
on public.kecamatan_events(usulan_id, event_at asc);

create table if not exists public.kecamatan_helpdesk_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_code varchar not null unique,
  kecamatan_id uuid not null references public.master_wilayah(id),
  warga_id uuid references public.warga(id),
  category varchar not null,
  description text not null,
  status varchar not null default 'TERKIRIM',
  submitted_by uuid not null references public.user_profiles(id),
  is_fixture boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kecamatan_helpdesk_category_check check (length(trim(category)) between 3 and 100),
  constraint kecamatan_helpdesk_description_check check (length(trim(description)) between 20 and 2000),
  constraint kecamatan_helpdesk_status_check check (status in ('TERKIRIM', 'DIPROSES', 'SELESAI', 'DITUTUP'))
);

create index if not exists idx_kecamatan_helpdesk_queue
on public.kecamatan_helpdesk_tickets(kecamatan_id, status, created_at desc);
create index if not exists idx_kecamatan_helpdesk_fixture
on public.kecamatan_helpdesk_tickets(is_fixture) where is_fixture;

create sequence if not exists public.kecamatan_referral_code_seq;
create sequence if not exists public.kecamatan_ticket_code_seq;

create or replace function public.kecamatan_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.kecamatan_touch_updated_at() from public, anon, authenticated;
grant execute on function public.kecamatan_touch_updated_at() to service_role;

drop trigger if exists trg_kecamatan_usulan_updated_at on public.kecamatan_warga_usulan;
create trigger trg_kecamatan_usulan_updated_at before update on public.kecamatan_warga_usulan
for each row execute function public.kecamatan_touch_updated_at();
drop trigger if exists trg_kecamatan_survei_updated_at on public.kecamatan_survei;
create trigger trg_kecamatan_survei_updated_at before update on public.kecamatan_survei
for each row execute function public.kecamatan_touch_updated_at();
drop trigger if exists trg_kecamatan_helpdesk_updated_at on public.kecamatan_helpdesk_tickets;
create trigger trg_kecamatan_helpdesk_updated_at before update on public.kecamatan_helpdesk_tickets
for each row execute function public.kecamatan_touch_updated_at();

do $$ declare t text; begin
  foreach t in array array[
    'kecamatan_warga_usulan', 'kecamatan_survei', 'kecamatan_documents',
    'kecamatan_referral_details', 'kecamatan_events', 'kecamatan_helpdesk_tickets'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

revoke all on sequence public.kecamatan_referral_code_seq from public, anon, authenticated;
revoke all on sequence public.kecamatan_ticket_code_seq from public, anon, authenticated;
