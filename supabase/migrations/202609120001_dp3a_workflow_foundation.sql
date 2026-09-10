-- Fondasi workflow DP3A untuk jalur PENGUATAN_DASAR. Tidak membuat data master atau fixture.

create table if not exists public.dp3a_unit_layanan (
  id uuid primary key default gen_random_uuid(), kode varchar not null unique, nama varchar not null,
  kategori varchar not null, kelurahan varchar, alamat text, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint dp3a_unit_layanan_kategori_check check (kategori in ('HUKUM','PSIKOSOSIAL','PERLINDUNGAN_ANAK','RUMAH_AMAN','PEMBERDAYAAN_EKONOMI','TERPADU')),
  constraint dp3a_unit_layanan_text_check check (length(trim(kode)) between 3 and 50 and length(trim(nama)) between 3 and 200)
);

create table if not exists public.dp3a_program_details (
  program_id uuid primary key references public.master_program_layanan(id) on delete cascade,
  kategori_target varchar not null, jenis_layanan varchar not null,
  unit_id uuid not null references public.dp3a_unit_layanan(id), duration_value integer not null,
  duration_unit varchar not null, execution_date date not null, budget_per_beneficiary bigint not null,
  capacity integer not null, description text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint dp3a_program_duration_check check (duration_value between 1 and 60),
  constraint dp3a_program_unit_check check (duration_unit in ('HARI','MINGGU','BULAN')),
  constraint dp3a_program_budget_check check (budget_per_beneficiary between 0 and 1000000000000),
  constraint dp3a_program_capacity_check check (capacity between 1 and 10000),
  constraint dp3a_program_text_check check (length(trim(kategori_target)) between 2 and 100 and length(trim(jenis_layanan)) between 3 and 200 and length(trim(description)) between 10 and 3000)
);

create table if not exists public.dp3a_cases (
  id uuid primary key default gen_random_uuid(), referral_id uuid not null unique references public.referral_mbi(id) on delete cascade,
  program_id uuid not null references public.master_program_layanan(id), unit_id uuid not null references public.dp3a_unit_layanan(id),
  start_date date not null, jenis_kasus varchar not null, support_item text not null,
  case_status varchar not null default 'VERIFIKASI', verification_status varchar not null default 'MENUNGGU',
  progress_percent integer not null default 0, planned_budget bigint not null, evaluation_note text,
  is_fixture boolean not null default false, created_by uuid not null references public.user_profiles(id),
  updated_by uuid not null references public.user_profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint dp3a_case_status_check check (case_status in ('VERIFIKASI','PENDAMPINGAN','SELESAI','TIDAK_AKTIF')),
  constraint dp3a_verification_status_check check (verification_status in ('MENUNGGU','LULUS','DITOLAK')),
  constraint dp3a_progress_check check (progress_percent between 0 and 100),
  constraint dp3a_planned_budget_check check (planned_budget between 0 and 1000000000000),
  constraint dp3a_case_record_text_check check (length(trim(jenis_kasus)) between 2 and 100 and length(trim(support_item)) between 3 and 500 and (evaluation_note is null or length(trim(evaluation_note)) between 10 and 2000)),
  constraint dp3a_completed_state_check check (case_status <> 'SELESAI' or (progress_percent = 100 and verification_status = 'LULUS'))
);

create table if not exists public.dp3a_case_events (
  id uuid primary key default gen_random_uuid(), case_id uuid not null references public.dp3a_cases(id) on delete cascade,
  event_type varchar not null, progress_percent integer, verification_status varchar, note text,
  actor_user_id uuid not null references public.user_profiles(id), event_at timestamptz not null default now(),
  constraint dp3a_event_type_check check (event_type in ('STARTED','PROGRESS_UPDATED','COMPLETED','CANCELLED')),
  constraint dp3a_event_progress_check check (progress_percent is null or progress_percent between 0 and 100),
  constraint dp3a_event_document_check check (verification_status is null or verification_status in ('MENUNGGU','LULUS','DITOLAK')),
  constraint dp3a_event_note_check check (note is null or length(note) <= 2000)
);

create table if not exists public.dp3a_realisasi_layanan (
  id uuid primary key default gen_random_uuid(), case_id uuid not null unique references public.dp3a_cases(id) on delete cascade,
  support_item text not null, realized_amount bigint not null, realization_date date not null, notes text not null,
  created_by uuid not null references public.user_profiles(id), updated_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint dp3a_realization_amount_check check (realized_amount between 0 and 1000000000000),
  constraint dp3a_realization_text_check check (length(trim(support_item)) between 3 and 500 and length(trim(notes)) between 10 and 2000)
);

create index if not exists idx_dp3a_program_unit on public.dp3a_program_details(unit_id);
create index if not exists idx_dp3a_case_record_program on public.dp3a_cases(program_id,case_status);
create index if not exists idx_dp3a_case_record_unit on public.dp3a_cases(unit_id);
create index if not exists idx_dp3a_case_record_fixture on public.dp3a_cases(is_fixture) where is_fixture;
create index if not exists idx_dp3a_events_timeline on public.dp3a_case_events(case_id,event_at asc);

drop trigger if exists trg_dp3a_unit_updated_at on public.dp3a_unit_layanan;
create trigger trg_dp3a_unit_updated_at before update on public.dp3a_unit_layanan for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_dp3a_program_updated_at on public.dp3a_program_details;
create trigger trg_dp3a_program_updated_at before update on public.dp3a_program_details for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_dp3a_case_record_updated_at on public.dp3a_cases;
create trigger trg_dp3a_case_record_updated_at before update on public.dp3a_cases for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_dp3a_realization_updated_at on public.dp3a_realisasi_layanan;
create trigger trg_dp3a_realization_updated_at before update on public.dp3a_realisasi_layanan for each row execute function public.dinsos_touch_updated_at();

do $$ declare t text; begin
  foreach t in array array['dp3a_unit_layanan','dp3a_program_details','dp3a_cases','dp3a_case_events','dp3a_realisasi_layanan'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from anon, authenticated',t);
  end loop;
end $$;
