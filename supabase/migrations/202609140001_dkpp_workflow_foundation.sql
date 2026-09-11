-- DKPP food-resilience workflow. Shared warga and referrals remain canonical.

insert into public.master_opd (kode_opd, nama_opd)
values ('DKPP', 'Dinas Ketahanan Pangan dan Pertanian Kota Bandung')
on conflict (kode_opd) do update set nama_opd = excluded.nama_opd;

-- A WIRAUSAHA assessment may be routed to Diskop UKM, Disdagin, or DKPP. This
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
        or (p_path = 'WIRAUSAHA' and opd.kode_opd in ('DISKOP', 'DISDAGIN', 'DKPP'))
        or (
          p_path = 'PENGUATAN_DASAR'
          and opd.kode_opd in ('DINSOS', 'DISDIK', 'DINKES', 'DP3A', 'DPPKB')
        )
      )
  );
$$;

revoke all on function public.dinsos_target_opd_allowed(text, uuid)
from public, anon, authenticated;
grant execute on function public.dinsos_target_opd_allowed(text, uuid)
to service_role;

create table if not exists public.dkpp_penyuluh (
  id uuid primary key default gen_random_uuid(),
  kode varchar not null unique,
  nama varchar not null,
  klaster varchar,
  lokasi text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dkpp_penyuluh_text_check check (
    length(trim(kode)) between 3 and 50
    and length(trim(nama)) between 3 and 200
    and (klaster is null or length(trim(klaster)) between 2 and 100)
  )
);

create table if not exists public.dkpp_beneficiary_profiles (
  id uuid primary key default gen_random_uuid(),
  warga_id uuid not null unique references public.warga(id) on delete cascade,
  nama_kelompok varchar not null,
  kategori_pangan varchar not null,
  lokasi_demplot text not null,
  is_fixture boolean not null default false,
  created_by uuid not null references public.user_profiles(id),
  updated_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dkpp_beneficiary_profile_text_check check (
    length(trim(nama_kelompok)) between 3 and 200
    and length(trim(kategori_pangan)) between 2 and 100
    and length(trim(lokasi_demplot)) between 3 and 300
  )
);

create table if not exists public.dkpp_program_details (
  program_id uuid primary key references public.master_program_layanan(id) on delete cascade,
  category varchar not null,
  penyuluh_id uuid not null references public.dkpp_penyuluh(id),
  penyuluh varchar not null,
  location text,
  duration_value integer not null,
  duration_unit varchar not null,
  capacity integer not null,
  description text not null,
  facilitation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dkpp_program_duration_check check (duration_value between 1 and 60),
  constraint dkpp_program_duration_unit_check check (duration_unit in ('HARI', 'MINGGU', 'BULAN')),
  constraint dkpp_program_capacity_check check (capacity between 1 and 10000),
  constraint dkpp_program_text_check check (
    length(trim(category)) between 2 and 100
    and length(trim(penyuluh)) between 3 and 200
    and length(trim(description)) between 10 and 3000
  )
);

create table if not exists public.dkpp_interventions (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null unique references public.referral_mbi(id) on delete cascade,
  program_id uuid not null references public.master_program_layanan(id),
  penyuluh_id uuid not null references public.dkpp_penyuluh(id),
  beneficiary_profile_id uuid not null references public.dkpp_beneficiary_profiles(id),
  penyuluh varchar not null,
  start_date date not null,
  jenis_bantuan text not null,
  action_plan text not null,
  participant_status varchar not null default 'AKTIF_PENDAMPINGAN',
  progress_percent integer not null default 0,
  harvest_status varchar not null default 'BELUM_PANEN',
  evaluation_note text,
  is_fixture boolean not null default false,
  created_by uuid not null references public.user_profiles(id),
  updated_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dkpp_participant_status_check check (
    participant_status in ('AKTIF_PENDAMPINGAN', 'MANDIRI_SELESAI', 'TIDAK_AKTIF')
  ),
  constraint dkpp_progress_check check (progress_percent between 0 and 100),
  constraint dkpp_harvest_status_check check (harvest_status in ('BELUM_PANEN', 'HASIL_MENCUKUPI', 'MEMENUHI_DAN_DIPASARKAN')),
  constraint dkpp_intervention_text_check check (
    length(trim(penyuluh)) between 3 and 200
    and length(trim(jenis_bantuan)) between 3 and 500
    and length(trim(action_plan)) between 10 and 2000
    and (evaluation_note is null or length(trim(evaluation_note)) between 10 and 2000)
  ),
  constraint dkpp_completed_state_check check (
    participant_status <> 'MANDIRI_SELESAI'
    or (progress_percent = 100 and harvest_status = 'MEMENUHI_DAN_DIPASARKAN')
  )
);

create table if not exists public.dkpp_intervention_events (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.dkpp_interventions(id) on delete cascade,
  event_type varchar not null,
  progress_percent integer,
  harvest_status varchar,
  note text,
  actor_user_id uuid not null references public.user_profiles(id),
  event_at timestamptz not null default now(),
  constraint dkpp_event_type_check check (event_type in ('STARTED', 'PROGRESS_UPDATED', 'COMPLETED', 'CANCELLED')),
  constraint dkpp_event_progress_check check (progress_percent is null or progress_percent between 0 and 100),
  constraint dkpp_event_legal_check check (harvest_status is null or harvest_status in ('BELUM_PANEN', 'HASIL_MENCUKUPI', 'MEMENUHI_DAN_DIPASARKAN')),
  constraint dkpp_event_note_check check (note is null or length(note) <= 2000)
);

create table if not exists public.dkpp_ketahanan_pangan (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null unique references public.dkpp_interventions(id) on delete cascade,
  lokasi_demplot text not null,
  nama_kelompok varchar not null,
  kategori_pangan varchar not null,
  nilai_panen bigint not null,
  status_hasil text,
  tanggal_mandiri date not null,
  evaluasi_akhir text not null,
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dkpp_harvest_value_check check (nilai_panen between 0 and 1000000000000),
  constraint dkpp_food_outcome_text_check check (
    length(trim(lokasi_demplot)) between 3 and 300
    and (status_hasil is null or length(trim(status_hasil)) between 3 and 200)
    and
    length(trim(nama_kelompok)) between 3 and 200
    and length(trim(kategori_pangan)) between 2 and 100
    and length(trim(evaluasi_akhir)) between 10 and 2000
  )
);

create table if not exists public.dkpp_laporan_panen (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.dkpp_interventions(id) on delete cascade,
  periode date not null,
  nominal bigint not null,
  status varchar not null default 'TERVERIFIKASI',
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dkpp_report_period_month_check check (periode = date_trunc('month', periode)::date),
  constraint dkpp_report_amount_check check (nominal between 0 and 1000000000000),
  constraint dkpp_report_status_check check (status in ('TERVERIFIKASI', 'MENUNGGU_VERIFIKASI')),
  constraint dkpp_report_intervention_period_unique unique (intervention_id, periode)
);

create index if not exists idx_dkpp_program_penyuluh on public.dkpp_program_details(penyuluh_id);
create index if not exists idx_dkpp_beneficiary_profile_fixture on public.dkpp_beneficiary_profiles(is_fixture) where is_fixture;
create index if not exists idx_dkpp_intervention_program on public.dkpp_interventions(program_id, participant_status);
create index if not exists idx_dkpp_intervention_penyuluh on public.dkpp_interventions(penyuluh_id);
create index if not exists idx_dkpp_intervention_fixture on public.dkpp_interventions(is_fixture) where is_fixture;
create index if not exists idx_dkpp_events_timeline on public.dkpp_intervention_events(intervention_id, event_at asc);
create index if not exists idx_dkpp_harvest_period on public.dkpp_laporan_panen(periode desc);

drop trigger if exists trg_dkpp_penyuluh_updated_at on public.dkpp_penyuluh;
create trigger trg_dkpp_penyuluh_updated_at before update on public.dkpp_penyuluh for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_dkpp_beneficiary_profile_updated_at on public.dkpp_beneficiary_profiles;
create trigger trg_dkpp_beneficiary_profile_updated_at before update on public.dkpp_beneficiary_profiles for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_dkpp_program_updated_at on public.dkpp_program_details;
create trigger trg_dkpp_program_updated_at before update on public.dkpp_program_details for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_dkpp_intervention_updated_at on public.dkpp_interventions;
create trigger trg_dkpp_intervention_updated_at before update on public.dkpp_interventions for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_dkpp_food_outcome_updated_at on public.dkpp_ketahanan_pangan;
create trigger trg_dkpp_food_outcome_updated_at before update on public.dkpp_ketahanan_pangan for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_dkpp_report_updated_at on public.dkpp_laporan_panen;
create trigger trg_dkpp_report_updated_at before update on public.dkpp_laporan_panen for each row execute function public.dinsos_touch_updated_at();

alter table public.dkpp_penyuluh enable row level security;
alter table public.dkpp_beneficiary_profiles enable row level security;
alter table public.dkpp_program_details enable row level security;
alter table public.dkpp_interventions enable row level security;
alter table public.dkpp_intervention_events enable row level security;
alter table public.dkpp_ketahanan_pangan enable row level security;
alter table public.dkpp_laporan_panen enable row level security;

revoke all on table public.dkpp_penyuluh from anon, authenticated;
revoke all on table public.dkpp_beneficiary_profiles from anon, authenticated;
revoke all on table public.dkpp_program_details from anon, authenticated;
revoke all on table public.dkpp_interventions from anon, authenticated;
revoke all on table public.dkpp_intervention_events from anon, authenticated;
revoke all on table public.dkpp_ketahanan_pangan from anon, authenticated;
revoke all on table public.dkpp_laporan_panen from anon, authenticated;
