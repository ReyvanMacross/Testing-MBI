-- CIPTA_BINTAR housing and settlement-infrastructure workflow. Shared warga and referrals remain canonical.

insert into public.master_opd (kode_opd, nama_opd)
values ('CIPTA_BINTAR', 'Dinas Cipta Karya, Bina Konstruksi dan Tata Ruang Kota Bandung')
on conflict (kode_opd) do update set nama_opd = excluded.nama_opd;

-- A PENGUATAN_DASAR assessment may be routed to the social-service OPDs below. This
-- replaces the baseline helper used by Dinsos review/publish RPCs.
create or replace function public.dinsos_target_opd_allowed(
  p_path text,
  p_target_opd_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.master_opd opd
    where opd.id = p_target_opd_id
      and (
        (p_path = 'PEKERJA' and opd.kode_opd = 'DISNAKER')
        or (p_path = 'WIRAUSAHA' and opd.kode_opd in ('DISKOP', 'DISDAGIN', 'DISBUDPAR'))
        or (
          p_path = 'PENGUATAN_DASAR'
          and opd.kode_opd in ('DINSOS', 'DISDIK', 'DINKES', 'DP3A', 'DPPKB', 'CIPTA_BINTAR')
        )
      )
  );
$$;

revoke all on function public.dinsos_target_opd_allowed(text, uuid)
from public, anon, authenticated;
grant execute on function public.dinsos_target_opd_allowed(text, uuid)
to service_role;

create table if not exists public.cipta_bintar_petugas (
  id uuid primary key default gen_random_uuid(),
  kode varchar not null unique,
  nama varchar not null,
  wilayah_tugas varchar,
  lokasi text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cipta_bintar_petugas_text_check check (
    length(trim(kode)) between 3 and 50
    and length(trim(nama)) between 3 and 200
    and (wilayah_tugas is null or length(trim(wilayah_tugas)) between 2 and 100)
  )
);

create table if not exists public.cipta_bintar_beneficiary_profiles (
  id uuid primary key default gen_random_uuid(),
  warga_id uuid not null unique references public.warga(id) on delete cascade,
  alamat_objek varchar not null,
  kategori_infrastruktur varchar not null,
  lokasi_objek text not null,
  is_fixture boolean not null default false,
  created_by uuid not null references public.user_profiles(id),
  updated_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cipta_bintar_beneficiary_profile_text_check check (
    length(trim(alamat_objek)) between 3 and 200
    and length(trim(kategori_infrastruktur)) between 2 and 100
    and length(trim(lokasi_objek)) between 3 and 300
  )
);

create table if not exists public.cipta_bintar_program_details (
  program_id uuid primary key references public.master_program_layanan(id) on delete cascade,
  category varchar not null,
  petugas_id uuid not null references public.cipta_bintar_petugas(id),
  petugas varchar not null,
  location text,
  start_date date not null,
  duration_value integer not null,
  duration_unit varchar not null,
  capacity integer not null,
  budget_per_unit bigint not null,
  description text not null,
  facilitation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cipta_bintar_program_duration_check check (duration_value between 1 and 60),
  constraint cipta_bintar_program_duration_unit_check check (duration_unit in ('HARI', 'MINGGU', 'BULAN')),
  constraint cipta_bintar_program_capacity_check check (capacity between 1 and 10000),
  constraint cipta_bintar_program_budget_check check (budget_per_unit between 0 and 1000000000000),
  constraint cipta_bintar_program_text_check check (
    length(trim(category)) between 2 and 100
    and length(trim(petugas)) between 3 and 200
    and length(trim(description)) between 10 and 3000
  )
);

create table if not exists public.cipta_bintar_interventions (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null unique references public.referral_mbi(id) on delete cascade,
  program_id uuid not null references public.master_program_layanan(id),
  petugas_id uuid not null references public.cipta_bintar_petugas(id),
  beneficiary_profile_id uuid not null references public.cipta_bintar_beneficiary_profiles(id),
  petugas varchar not null,
  start_date date not null,
  jenis_bantuan text not null,
  action_plan text not null,
  allocated_budget bigint not null,
  participant_status varchar not null default 'DALAM_PENGERJAAN',
  progress_percent integer not null default 0,
  feasibility_status varchar not null default 'BELUM_DIVERIFIKASI',
  evaluation_note text,
  is_fixture boolean not null default false,
  created_by uuid not null references public.user_profiles(id),
  updated_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cipta_bintar_participant_status_check check (
    participant_status in ('DALAM_PENGERJAAN', 'HUNIAN_LAYAK_SELESAI', 'TIDAK_AKTIF')
  ),
  constraint cipta_bintar_progress_check check (progress_percent between 0 and 100),
  constraint cipta_bintar_allocated_budget_check check (allocated_budget between 0 and 1000000000000),
  constraint cipta_bintar_feasibility_status_check check (feasibility_status in ('BELUM_DIVERIFIKASI', 'PROGRES_FISIK', 'LAYAK_HUNI_BERFUNGSI')),
  constraint cipta_bintar_intervention_text_check check (
    length(trim(petugas)) between 3 and 200
    and length(trim(jenis_bantuan)) between 3 and 500
    and length(trim(action_plan)) between 10 and 2000
    and (evaluation_note is null or length(trim(evaluation_note)) between 10 and 2000)
  ),
  constraint cipta_bintar_completed_state_check check (
    participant_status <> 'HUNIAN_LAYAK_SELESAI'
    or (progress_percent = 100 and feasibility_status = 'LAYAK_HUNI_BERFUNGSI')
  )
);

create table if not exists public.cipta_bintar_intervention_events (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.cipta_bintar_interventions(id) on delete cascade,
  event_type varchar not null,
  progress_percent integer,
  feasibility_status varchar,
  note text,
  actor_user_id uuid not null references public.user_profiles(id),
  event_at timestamptz not null default now(),
  constraint cipta_bintar_event_type_check check (event_type in ('STARTED', 'PROGRESS_UPDATED', 'COMPLETED', 'CANCELLED')),
  constraint cipta_bintar_event_progress_check check (progress_percent is null or progress_percent between 0 and 100),
  constraint cipta_bintar_event_legal_check check (feasibility_status is null or feasibility_status in ('BELUM_DIVERIFIKASI', 'PROGRES_FISIK', 'LAYAK_HUNI_BERFUNGSI')),
  constraint cipta_bintar_event_note_check check (note is null or length(note) <= 2000)
);

create table if not exists public.cipta_bintar_realisasi_infrastruktur (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null unique references public.cipta_bintar_interventions(id) on delete cascade,
  lokasi_objek text not null,
  alamat_objek varchar not null,
  kategori_infrastruktur varchar not null,
  realisasi_anggaran bigint not null,
  status_kelayakan text,
  tanggal_selesai date not null,
  evaluasi_akhir text not null,
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cipta_bintar_realization_value_check check (realisasi_anggaran between 0 and 1000000000000),
  constraint cipta_bintar_infrastructure_outcome_text_check check (
    length(trim(lokasi_objek)) between 3 and 300
    and (status_kelayakan is null or length(trim(status_kelayakan)) between 3 and 200)
    and
    length(trim(alamat_objek)) between 3 and 200
    and length(trim(kategori_infrastruktur)) between 2 and 100
    and length(trim(evaluasi_akhir)) between 10 and 2000
  )
);

create table if not exists public.cipta_bintar_laporan_realisasi (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.cipta_bintar_interventions(id) on delete cascade,
  periode date not null,
  nominal bigint not null,
  progress_percent integer not null,
  status varchar not null default 'TERVERIFIKASI',
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cipta_bintar_report_period_month_check check (periode = date_trunc('month', periode)::date),
  constraint cipta_bintar_report_amount_check check (nominal between 0 and 1000000000000),
  constraint cipta_bintar_report_progress_check check (progress_percent between 0 and 100),
  constraint cipta_bintar_report_status_check check (status in ('TERVERIFIKASI', 'MENUNGGU_VERIFIKASI')),
  constraint cipta_bintar_report_intervention_period_unique unique (intervention_id, periode)
);

create index if not exists idx_cipta_bintar_program_petugas on public.cipta_bintar_program_details(petugas_id);
create index if not exists idx_cipta_bintar_beneficiary_profile_fixture on public.cipta_bintar_beneficiary_profiles(is_fixture) where is_fixture;
create index if not exists idx_cipta_bintar_intervention_program on public.cipta_bintar_interventions(program_id, participant_status);
create index if not exists idx_cipta_bintar_intervention_petugas on public.cipta_bintar_interventions(petugas_id);
create index if not exists idx_cipta_bintar_intervention_fixture on public.cipta_bintar_interventions(is_fixture) where is_fixture;
create index if not exists idx_cipta_bintar_events_timeline on public.cipta_bintar_intervention_events(intervention_id, event_at asc);
create index if not exists idx_cipta_bintar_report_period on public.cipta_bintar_laporan_realisasi(periode desc);

drop trigger if exists trg_cipta_bintar_petugas_updated_at on public.cipta_bintar_petugas;
create trigger trg_cipta_bintar_petugas_updated_at before update on public.cipta_bintar_petugas for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_cipta_bintar_beneficiary_profile_updated_at on public.cipta_bintar_beneficiary_profiles;
create trigger trg_cipta_bintar_beneficiary_profile_updated_at before update on public.cipta_bintar_beneficiary_profiles for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_cipta_bintar_program_updated_at on public.cipta_bintar_program_details;
create trigger trg_cipta_bintar_program_updated_at before update on public.cipta_bintar_program_details for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_cipta_bintar_intervention_updated_at on public.cipta_bintar_interventions;
create trigger trg_cipta_bintar_intervention_updated_at before update on public.cipta_bintar_interventions for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_cipta_bintar_infrastructure_outcome_updated_at on public.cipta_bintar_realisasi_infrastruktur;
create trigger trg_cipta_bintar_infrastructure_outcome_updated_at before update on public.cipta_bintar_realisasi_infrastruktur for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_cipta_bintar_report_updated_at on public.cipta_bintar_laporan_realisasi;
create trigger trg_cipta_bintar_report_updated_at before update on public.cipta_bintar_laporan_realisasi for each row execute function public.dinsos_touch_updated_at();

alter table public.cipta_bintar_petugas enable row level security;
alter table public.cipta_bintar_beneficiary_profiles enable row level security;
alter table public.cipta_bintar_program_details enable row level security;
alter table public.cipta_bintar_interventions enable row level security;
alter table public.cipta_bintar_intervention_events enable row level security;
alter table public.cipta_bintar_realisasi_infrastruktur enable row level security;
alter table public.cipta_bintar_laporan_realisasi enable row level security;

revoke all on table public.cipta_bintar_petugas from anon, authenticated;
revoke all on table public.cipta_bintar_beneficiary_profiles from anon, authenticated;
revoke all on table public.cipta_bintar_program_details from anon, authenticated;
revoke all on table public.cipta_bintar_interventions from anon, authenticated;
revoke all on table public.cipta_bintar_intervention_events from anon, authenticated;
revoke all on table public.cipta_bintar_realisasi_infrastruktur from anon, authenticated;
revoke all on table public.cipta_bintar_laporan_realisasi from anon, authenticated;
