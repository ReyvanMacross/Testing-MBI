-- Disdagin WIRAUSAHA workflow foundation. Shared citizens/referrals remain canonical.

insert into public.master_opd (kode_opd, nama_opd)
values ('DISDAGIN', 'Dinas Perdagangan dan Perindustrian Kota Bandung')
on conflict (kode_opd) do update set nama_opd = excluded.nama_opd;

-- A WIRAUSAHA assessment may be routed to Diskop UKM or Disdagin. This
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
        or (p_path = 'WIRAUSAHA' and opd.kode_opd in ('DISKOP', 'DISDAGIN'))
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

create table if not exists public.disdagin_pendamping (
  id uuid primary key default gen_random_uuid(),
  kode varchar not null unique,
  nama varchar not null,
  klaster varchar,
  lokasi text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disdagin_pendamping_text_check check (
    length(trim(kode)) between 3 and 50
    and length(trim(nama)) between 3 and 200
    and (klaster is null or length(trim(klaster)) between 2 and 100)
  )
);

create table if not exists public.disdagin_business_profiles (
  id uuid primary key default gen_random_uuid(),
  warga_id uuid not null unique references public.warga(id) on delete cascade,
  nama_usaha varchar not null,
  kategori_usaha varchar not null,
  nib varchar(13) not null unique,
  is_fixture boolean not null default false,
  created_by uuid not null references public.user_profiles(id),
  updated_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disdagin_business_profile_nib_check check (nib ~ '^[0-9]{13}$'),
  constraint disdagin_business_profile_text_check check (
    length(trim(nama_usaha)) between 3 and 200
    and length(trim(kategori_usaha)) between 2 and 100
  )
);

create table if not exists public.disdagin_program_details (
  program_id uuid primary key references public.master_program_layanan(id) on delete cascade,
  category varchar not null,
  pendamping_id uuid not null references public.disdagin_pendamping(id),
  consultant varchar not null,
  location text,
  duration_value integer not null,
  duration_unit varchar not null,
  capacity integer not null,
  description text not null,
  facilitation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disdagin_program_duration_check check (duration_value between 1 and 60),
  constraint disdagin_program_duration_unit_check check (duration_unit in ('HARI', 'MINGGU', 'BULAN')),
  constraint disdagin_program_capacity_check check (capacity between 1 and 10000),
  constraint disdagin_program_text_check check (
    length(trim(category)) between 2 and 100
    and length(trim(consultant)) between 3 and 200
    and length(trim(description)) between 10 and 3000
  )
);

create table if not exists public.disdagin_interventions (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null unique references public.referral_mbi(id) on delete cascade,
  program_id uuid not null references public.master_program_layanan(id),
  pendamping_id uuid not null references public.disdagin_pendamping(id),
  business_profile_id uuid not null references public.disdagin_business_profiles(id),
  consultant varchar not null,
  start_date date not null,
  stimulus text not null,
  action_plan text not null,
  participant_status varchar not null default 'AKTIF_PENDAMPINGAN',
  progress_percent integer not null default 0,
  legal_status varchar not null default 'BELUM',
  evaluation_note text,
  is_fixture boolean not null default false,
  created_by uuid not null references public.user_profiles(id),
  updated_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disdagin_participant_status_check check (
    participant_status in ('AKTIF_PENDAMPINGAN', 'MANDIRI_SELESAI', 'TIDAK_AKTIF')
  ),
  constraint disdagin_progress_check check (progress_percent between 0 and 100),
  constraint disdagin_legal_status_check check (legal_status in ('BELUM', 'PROSES_NIB_HALAL', 'LEGAL')),
  constraint disdagin_intervention_text_check check (
    length(trim(consultant)) between 3 and 200
    and length(trim(stimulus)) between 3 and 500
    and length(trim(action_plan)) between 10 and 2000
    and (evaluation_note is null or length(trim(evaluation_note)) between 10 and 2000)
  ),
  constraint disdagin_completed_state_check check (
    participant_status <> 'MANDIRI_SELESAI'
    or (progress_percent = 100 and legal_status = 'LEGAL')
  )
);

create table if not exists public.disdagin_intervention_events (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.disdagin_interventions(id) on delete cascade,
  event_type varchar not null,
  progress_percent integer,
  legal_status varchar,
  note text,
  actor_user_id uuid not null references public.user_profiles(id),
  event_at timestamptz not null default now(),
  constraint disdagin_event_type_check check (event_type in ('STARTED', 'PROGRESS_UPDATED', 'COMPLETED', 'CANCELLED')),
  constraint disdagin_event_progress_check check (progress_percent is null or progress_percent between 0 and 100),
  constraint disdagin_event_legal_check check (legal_status is null or legal_status in ('BELUM', 'PROSES_NIB_HALAL', 'LEGAL')),
  constraint disdagin_event_note_check check (note is null or length(note) <= 2000)
);

create table if not exists public.disdagin_kemandirian_usaha (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null unique references public.disdagin_interventions(id) on delete cascade,
  nib varchar(13) not null unique,
  nama_usaha varchar not null,
  kategori_usaha varchar not null,
  omzet_bulanan bigint not null,
  stimulus_status text,
  tanggal_mandiri date not null,
  evaluasi_akhir text not null,
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disdagin_nib_check check (nib ~ '^[0-9]{13}$'),
  constraint disdagin_revenue_check check (omzet_bulanan between 0 and 1000000000000),
  constraint disdagin_business_text_check check (
    length(trim(nama_usaha)) between 3 and 200
    and length(trim(kategori_usaha)) between 2 and 100
    and length(trim(evaluasi_akhir)) between 10 and 2000
  )
);

create table if not exists public.disdagin_laporan_omzet (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.disdagin_interventions(id) on delete cascade,
  periode date not null,
  nominal bigint not null,
  status varchar not null default 'TERVERIFIKASI',
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disdagin_report_period_month_check check (periode = date_trunc('month', periode)::date),
  constraint disdagin_report_amount_check check (nominal between 0 and 1000000000000),
  constraint disdagin_report_status_check check (status in ('TERVERIFIKASI', 'MENUNGGU_VERIFIKASI')),
  constraint disdagin_report_intervention_period_unique unique (intervention_id, periode)
);

create index if not exists idx_disdagin_program_pendamping on public.disdagin_program_details(pendamping_id);
create index if not exists idx_disdagin_business_profile_fixture on public.disdagin_business_profiles(is_fixture) where is_fixture;
create index if not exists idx_disdagin_intervention_program on public.disdagin_interventions(program_id, participant_status);
create index if not exists idx_disdagin_intervention_pendamping on public.disdagin_interventions(pendamping_id);
create index if not exists idx_disdagin_intervention_fixture on public.disdagin_interventions(is_fixture) where is_fixture;
create index if not exists idx_disdagin_events_timeline on public.disdagin_intervention_events(intervention_id, event_at asc);
create index if not exists idx_disdagin_revenue_period on public.disdagin_laporan_omzet(periode desc);

drop trigger if exists trg_disdagin_pendamping_updated_at on public.disdagin_pendamping;
create trigger trg_disdagin_pendamping_updated_at before update on public.disdagin_pendamping for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_disdagin_business_profile_updated_at on public.disdagin_business_profiles;
create trigger trg_disdagin_business_profile_updated_at before update on public.disdagin_business_profiles for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_disdagin_program_updated_at on public.disdagin_program_details;
create trigger trg_disdagin_program_updated_at before update on public.disdagin_program_details for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_disdagin_intervention_updated_at on public.disdagin_interventions;
create trigger trg_disdagin_intervention_updated_at before update on public.disdagin_interventions for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_disdagin_business_updated_at on public.disdagin_kemandirian_usaha;
create trigger trg_disdagin_business_updated_at before update on public.disdagin_kemandirian_usaha for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_disdagin_report_updated_at on public.disdagin_laporan_omzet;
create trigger trg_disdagin_report_updated_at before update on public.disdagin_laporan_omzet for each row execute function public.dinsos_touch_updated_at();

alter table public.disdagin_pendamping enable row level security;
alter table public.disdagin_business_profiles enable row level security;
alter table public.disdagin_program_details enable row level security;
alter table public.disdagin_interventions enable row level security;
alter table public.disdagin_intervention_events enable row level security;
alter table public.disdagin_kemandirian_usaha enable row level security;
alter table public.disdagin_laporan_omzet enable row level security;

revoke all on table public.disdagin_pendamping from anon, authenticated;
revoke all on table public.disdagin_business_profiles from anon, authenticated;
revoke all on table public.disdagin_program_details from anon, authenticated;
revoke all on table public.disdagin_interventions from anon, authenticated;
revoke all on table public.disdagin_intervention_events from anon, authenticated;
revoke all on table public.disdagin_kemandirian_usaha from anon, authenticated;
revoke all on table public.disdagin_laporan_omzet from anon, authenticated;
