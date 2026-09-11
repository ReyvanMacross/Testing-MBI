-- DISBUDPAR creative-economy and arts workflow. Shared warga and referrals remain canonical.

insert into public.master_opd (kode_opd, nama_opd)
values ('DISBUDPAR', 'Dinas Kebudayaan dan Pariwisata Kota Bandung')
on conflict (kode_opd) do update set nama_opd = excluded.nama_opd;

-- A WIRAUSAHA assessment may be routed to Diskop UKM, Disdagin, or DISBUDPAR. This
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
          and opd.kode_opd in ('DINSOS', 'DISDIK', 'DINKES', 'DP3A', 'DPPKB')
        )
      )
  );
$$;

revoke all on function public.dinsos_target_opd_allowed(text, uuid)
from public, anon, authenticated;
grant execute on function public.dinsos_target_opd_allowed(text, uuid)
to service_role;

create table if not exists public.disbudpar_pendamping (
  id uuid primary key default gen_random_uuid(),
  kode varchar not null unique,
  nama varchar not null,
  klaster varchar,
  lokasi text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disbudpar_pendamping_text_check check (
    length(trim(kode)) between 3 and 50
    and length(trim(nama)) between 3 and 200
    and (klaster is null or length(trim(klaster)) between 2 and 100)
  )
);

create table if not exists public.disbudpar_beneficiary_profiles (
  id uuid primary key default gen_random_uuid(),
  warga_id uuid not null unique references public.warga(id) on delete cascade,
  nama_kelompok varchar not null,
  subsektor_ekraf varchar not null,
  lokasi_sanggar text not null,
  is_fixture boolean not null default false,
  created_by uuid not null references public.user_profiles(id),
  updated_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disbudpar_beneficiary_profile_text_check check (
    length(trim(nama_kelompok)) between 3 and 200
    and length(trim(subsektor_ekraf)) between 2 and 100
    and length(trim(lokasi_sanggar)) between 3 and 300
  )
);

create table if not exists public.disbudpar_program_details (
  program_id uuid primary key references public.master_program_layanan(id) on delete cascade,
  category varchar not null,
  pendamping_id uuid not null references public.disbudpar_pendamping(id),
  pendamping varchar not null,
  location text,
  duration_value integer not null,
  duration_unit varchar not null,
  capacity integer not null,
  description text not null,
  facilitation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disbudpar_program_duration_check check (duration_value between 1 and 60),
  constraint disbudpar_program_duration_unit_check check (duration_unit in ('HARI', 'MINGGU', 'BULAN')),
  constraint disbudpar_program_capacity_check check (capacity between 1 and 10000),
  constraint disbudpar_program_text_check check (
    length(trim(category)) between 2 and 100
    and length(trim(pendamping)) between 3 and 200
    and length(trim(description)) between 10 and 3000
  )
);

create table if not exists public.disbudpar_interventions (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null unique references public.referral_mbi(id) on delete cascade,
  program_id uuid not null references public.master_program_layanan(id),
  pendamping_id uuid not null references public.disbudpar_pendamping(id),
  beneficiary_profile_id uuid not null references public.disbudpar_beneficiary_profiles(id),
  pendamping varchar not null,
  start_date date not null,
  jenis_bantuan text not null,
  action_plan text not null,
  participant_status varchar not null default 'AKTIF_PENDAMPINGAN',
  progress_percent integer not null default 0,
  creative_result_status varchar not null default 'BELUM_AKTIF',
  evaluation_note text,
  is_fixture boolean not null default false,
  created_by uuid not null references public.user_profiles(id),
  updated_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disbudpar_participant_status_check check (
    participant_status in ('AKTIF_PENDAMPINGAN', 'MANDIRI_SELESAI', 'TIDAK_AKTIF')
  ),
  constraint disbudpar_progress_check check (progress_percent between 0 and 100),
  constraint disbudpar_creative_result_status_check check (creative_result_status in ('BELUM_AKTIF', 'AKTIF_TERBATAS', 'AKTIF_TAMPIL_PRODUKSI_RUTIN')),
  constraint disbudpar_intervention_text_check check (
    length(trim(pendamping)) between 3 and 200
    and length(trim(jenis_bantuan)) between 3 and 500
    and length(trim(action_plan)) between 10 and 2000
    and (evaluation_note is null or length(trim(evaluation_note)) between 10 and 2000)
  ),
  constraint disbudpar_completed_state_check check (
    participant_status <> 'MANDIRI_SELESAI'
    or (progress_percent = 100 and creative_result_status = 'AKTIF_TAMPIL_PRODUKSI_RUTIN')
  )
);

create table if not exists public.disbudpar_intervention_events (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.disbudpar_interventions(id) on delete cascade,
  event_type varchar not null,
  progress_percent integer,
  creative_result_status varchar,
  note text,
  actor_user_id uuid not null references public.user_profiles(id),
  event_at timestamptz not null default now(),
  constraint disbudpar_event_type_check check (event_type in ('STARTED', 'PROGRESS_UPDATED', 'COMPLETED', 'CANCELLED')),
  constraint disbudpar_event_progress_check check (progress_percent is null or progress_percent between 0 and 100),
  constraint disbudpar_event_legal_check check (creative_result_status is null or creative_result_status in ('BELUM_AKTIF', 'AKTIF_TERBATAS', 'AKTIF_TAMPIL_PRODUKSI_RUTIN')),
  constraint disbudpar_event_note_check check (note is null or length(note) <= 2000)
);

create table if not exists public.disbudpar_kemandirian_ekraf (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null unique references public.disbudpar_interventions(id) on delete cascade,
  lokasi_sanggar text not null,
  nama_kelompok varchar not null,
  subsektor_ekraf varchar not null,
  capaian_omzet_nilai_tampil bigint not null,
  status_hasil text,
  tanggal_mandiri date not null,
  evaluasi_akhir text not null,
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disbudpar_achievement_value_check check (capaian_omzet_nilai_tampil between 0 and 1000000000000),
  constraint disbudpar_creative_outcome_text_check check (
    length(trim(lokasi_sanggar)) between 3 and 300
    and (status_hasil is null or length(trim(status_hasil)) between 3 and 200)
    and
    length(trim(nama_kelompok)) between 3 and 200
    and length(trim(subsektor_ekraf)) between 2 and 100
    and length(trim(evaluasi_akhir)) between 10 and 2000
  )
);

create table if not exists public.disbudpar_laporan_pembinaan (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.disbudpar_interventions(id) on delete cascade,
  periode date not null,
  nominal bigint not null,
  status varchar not null default 'TERVERIFIKASI',
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disbudpar_report_period_month_check check (periode = date_trunc('month', periode)::date),
  constraint disbudpar_report_amount_check check (nominal between 0 and 1000000000000),
  constraint disbudpar_report_status_check check (status in ('TERVERIFIKASI', 'MENUNGGU_VERIFIKASI')),
  constraint disbudpar_report_intervention_period_unique unique (intervention_id, periode)
);

create index if not exists idx_disbudpar_program_pendamping on public.disbudpar_program_details(pendamping_id);
create index if not exists idx_disbudpar_beneficiary_profile_fixture on public.disbudpar_beneficiary_profiles(is_fixture) where is_fixture;
create index if not exists idx_disbudpar_intervention_program on public.disbudpar_interventions(program_id, participant_status);
create index if not exists idx_disbudpar_intervention_pendamping on public.disbudpar_interventions(pendamping_id);
create index if not exists idx_disbudpar_intervention_fixture on public.disbudpar_interventions(is_fixture) where is_fixture;
create index if not exists idx_disbudpar_events_timeline on public.disbudpar_intervention_events(intervention_id, event_at asc);
create index if not exists idx_disbudpar_report_period on public.disbudpar_laporan_pembinaan(periode desc);

drop trigger if exists trg_disbudpar_pendamping_updated_at on public.disbudpar_pendamping;
create trigger trg_disbudpar_pendamping_updated_at before update on public.disbudpar_pendamping for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_disbudpar_beneficiary_profile_updated_at on public.disbudpar_beneficiary_profiles;
create trigger trg_disbudpar_beneficiary_profile_updated_at before update on public.disbudpar_beneficiary_profiles for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_disbudpar_program_updated_at on public.disbudpar_program_details;
create trigger trg_disbudpar_program_updated_at before update on public.disbudpar_program_details for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_disbudpar_intervention_updated_at on public.disbudpar_interventions;
create trigger trg_disbudpar_intervention_updated_at before update on public.disbudpar_interventions for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_disbudpar_creative_outcome_updated_at on public.disbudpar_kemandirian_ekraf;
create trigger trg_disbudpar_creative_outcome_updated_at before update on public.disbudpar_kemandirian_ekraf for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_disbudpar_report_updated_at on public.disbudpar_laporan_pembinaan;
create trigger trg_disbudpar_report_updated_at before update on public.disbudpar_laporan_pembinaan for each row execute function public.dinsos_touch_updated_at();

alter table public.disbudpar_pendamping enable row level security;
alter table public.disbudpar_beneficiary_profiles enable row level security;
alter table public.disbudpar_program_details enable row level security;
alter table public.disbudpar_interventions enable row level security;
alter table public.disbudpar_intervention_events enable row level security;
alter table public.disbudpar_kemandirian_ekraf enable row level security;
alter table public.disbudpar_laporan_pembinaan enable row level security;

revoke all on table public.disbudpar_pendamping from anon, authenticated;
revoke all on table public.disbudpar_beneficiary_profiles from anon, authenticated;
revoke all on table public.disbudpar_program_details from anon, authenticated;
revoke all on table public.disbudpar_interventions from anon, authenticated;
revoke all on table public.disbudpar_intervention_events from anon, authenticated;
revoke all on table public.disbudpar_kemandirian_ekraf from anon, authenticated;
revoke all on table public.disbudpar_laporan_pembinaan from anon, authenticated;
