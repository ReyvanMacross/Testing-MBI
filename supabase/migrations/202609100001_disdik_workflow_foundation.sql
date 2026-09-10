-- Fondasi workflow Disdik untuk jalur PENGUATAN_DASAR. Tidak membuat data master atau fixture.

create table if not exists public.disdik_sekolah (
  id uuid primary key default gen_random_uuid(), kode varchar not null unique, nama varchar not null,
  jenjang varchar not null, kelurahan varchar, alamat text, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint disdik_sekolah_jenjang_check check (jenjang in ('PAUD','SD','SMP','SMA','SMK','KESETARAAN','LINTAS_JENJANG')),
  constraint disdik_sekolah_text_check check (length(trim(kode)) between 3 and 50 and length(trim(nama)) between 3 and 200)
);

create table if not exists public.disdik_program_details (
  program_id uuid primary key references public.master_program_layanan(id) on delete cascade,
  jenjang_target varchar not null, jenis_bantuan varchar not null,
  sekolah_id uuid not null references public.disdik_sekolah(id), duration_value integer not null,
  duration_unit varchar not null, execution_date date not null, budget_per_student bigint not null,
  capacity integer not null, description text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint disdik_program_duration_check check (duration_value between 1 and 60),
  constraint disdik_program_unit_check check (duration_unit in ('HARI','MINGGU','BULAN')),
  constraint disdik_program_budget_check check (budget_per_student between 0 and 1000000000000),
  constraint disdik_program_capacity_check check (capacity between 1 and 10000),
  constraint disdik_program_text_check check (length(trim(jenjang_target)) between 2 and 100 and length(trim(jenis_bantuan)) between 3 and 200 and length(trim(description)) between 10 and 3000)
);

create table if not exists public.disdik_interventions (
  id uuid primary key default gen_random_uuid(), referral_id uuid not null unique references public.referral_mbi(id) on delete cascade,
  program_id uuid not null references public.master_program_layanan(id), sekolah_id uuid not null references public.disdik_sekolah(id),
  start_date date not null, jenjang_siswa varchar not null, aid_item text not null,
  aid_status varchar not null default 'VERIFIKASI', document_status varchar not null default 'MENUNGGU',
  progress_percent integer not null default 0, planned_budget bigint not null, evaluation_note text,
  is_fixture boolean not null default false, created_by uuid not null references public.user_profiles(id),
  updated_by uuid not null references public.user_profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint disdik_aid_status_check check (aid_status in ('VERIFIKASI','PENYALURAN','SELESAI','TIDAK_AKTIF')),
  constraint disdik_document_status_check check (document_status in ('MENUNGGU','LULUS','DITOLAK')),
  constraint disdik_progress_check check (progress_percent between 0 and 100),
  constraint disdik_planned_budget_check check (planned_budget between 0 and 1000000000000),
  constraint disdik_intervention_text_check check (length(trim(jenjang_siswa)) between 2 and 100 and length(trim(aid_item)) between 3 and 500 and (evaluation_note is null or length(trim(evaluation_note)) between 10 and 2000)),
  constraint disdik_completed_state_check check (aid_status <> 'SELESAI' or (progress_percent = 100 and document_status = 'LULUS'))
);

create table if not exists public.disdik_intervention_events (
  id uuid primary key default gen_random_uuid(), intervention_id uuid not null references public.disdik_interventions(id) on delete cascade,
  event_type varchar not null, progress_percent integer, document_status varchar, note text,
  actor_user_id uuid not null references public.user_profiles(id), event_at timestamptz not null default now(),
  constraint disdik_event_type_check check (event_type in ('STARTED','PROGRESS_UPDATED','COMPLETED','CANCELLED')),
  constraint disdik_event_progress_check check (progress_percent is null or progress_percent between 0 and 100),
  constraint disdik_event_document_check check (document_status is null or document_status in ('MENUNGGU','LULUS','DITOLAK')),
  constraint disdik_event_note_check check (note is null or length(note) <= 2000)
);

create table if not exists public.disdik_realisasi_bantuan (
  id uuid primary key default gen_random_uuid(), intervention_id uuid not null unique references public.disdik_interventions(id) on delete cascade,
  aid_item text not null, realized_amount bigint not null, disbursement_date date not null, notes text not null,
  created_by uuid not null references public.user_profiles(id), updated_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint disdik_realization_amount_check check (realized_amount between 0 and 1000000000000),
  constraint disdik_realization_text_check check (length(trim(aid_item)) between 3 and 500 and length(trim(notes)) between 10 and 2000)
);

create index if not exists idx_disdik_program_school on public.disdik_program_details(sekolah_id);
create index if not exists idx_disdik_intervention_program on public.disdik_interventions(program_id,aid_status);
create index if not exists idx_disdik_intervention_school on public.disdik_interventions(sekolah_id);
create index if not exists idx_disdik_intervention_fixture on public.disdik_interventions(is_fixture) where is_fixture;
create index if not exists idx_disdik_events_timeline on public.disdik_intervention_events(intervention_id,event_at asc);

drop trigger if exists trg_disdik_school_updated_at on public.disdik_sekolah;
create trigger trg_disdik_school_updated_at before update on public.disdik_sekolah for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_disdik_program_updated_at on public.disdik_program_details;
create trigger trg_disdik_program_updated_at before update on public.disdik_program_details for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_disdik_intervention_updated_at on public.disdik_interventions;
create trigger trg_disdik_intervention_updated_at before update on public.disdik_interventions for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_disdik_realization_updated_at on public.disdik_realisasi_bantuan;
create trigger trg_disdik_realization_updated_at before update on public.disdik_realisasi_bantuan for each row execute function public.dinsos_touch_updated_at();

do $$ declare t text; begin
  foreach t in array array['disdik_sekolah','disdik_program_details','disdik_interventions','disdik_intervention_events','disdik_realisasi_bantuan'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from anon, authenticated',t);
  end loop;
end $$;
