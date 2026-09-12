-- BAPPERIDA is a coordination and planning layer over the canonical MBI data.
-- Operational referrals and outcomes stay in their owning OPD tables.

insert into public.master_opd (kode_opd, nama_opd)
values ('BAPPERIDA', 'Badan Perencanaan Pembangunan, Riset dan Inovasi Daerah Kota Bandung')
on conflict (kode_opd) do update set nama_opd = excluded.nama_opd;

create table if not exists public.bapperida_indicator_targets (
  id uuid primary key default gen_random_uuid(),
  indicator_code varchar not null,
  indicator_name varchar not null,
  dimension varchar not null,
  target_year integer not null,
  target_value numeric(16,2) not null,
  unit varchar not null,
  intervention_path varchar,
  is_active boolean not null default true,
  created_by uuid not null references public.user_profiles(id),
  updated_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bapperida_indicator_year_check check (target_year between 2020 and 2200),
  constraint bapperida_indicator_value_check check (target_value >= 0),
  constraint bapperida_indicator_path_check check (
    intervention_path is null or intervention_path in (
      'PEKERJA', 'WIRAUSAHA', 'PENGUATAN_DASAR', 'AKSELERASI_SEKTORAL'
    )
  ),
  constraint bapperida_indicator_text_check check (
    length(trim(indicator_code)) between 3 and 50
    and length(trim(indicator_name)) between 3 and 200
    and length(trim(dimension)) between 3 and 100
    and length(trim(unit)) between 1 and 50
  ),
  constraint bapperida_indicator_year_unique unique (indicator_code, target_year)
);

create table if not exists public.bapperida_evaluation_snapshots (
  id uuid primary key default gen_random_uuid(),
  period date not null,
  intervention_path varchar,
  independent_citizens integer not null,
  program_success_rate numeric(5,2) not null,
  reentry_citizens integer not null,
  welfare_index numeric(5,2) not null,
  path_distribution jsonb not null default '{}'::jsonb,
  desil_distribution jsonb not null default '{}'::jsonb,
  source_digest varchar not null,
  status varchar not null default 'DRAFT',
  published_at timestamptz,
  is_fixture boolean not null default false,
  created_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  constraint bapperida_snapshot_period_check check (period = date_trunc('month', period)::date),
  constraint bapperida_snapshot_count_check check (independent_citizens >= 0 and reentry_citizens >= 0),
  constraint bapperida_snapshot_rate_check check (program_success_rate between 0 and 100),
  constraint bapperida_snapshot_index_check check (welfare_index between 0 and 100),
  constraint bapperida_snapshot_path_check check (
    intervention_path is null or intervention_path in (
      'PEKERJA', 'WIRAUSAHA', 'PENGUATAN_DASAR', 'AKSELERASI_SEKTORAL'
    )
  ),
  constraint bapperida_snapshot_status_check check (status in ('DRAFT', 'PUBLISHED')),
  constraint bapperida_snapshot_publish_check check (
    (status = 'DRAFT' and published_at is null) or (status = 'PUBLISHED' and published_at is not null)
  ),
  constraint bapperida_snapshot_source_check check (length(trim(source_digest)) between 8 and 128),
  constraint bapperida_snapshot_period_path_unique unique nulls not distinct (period, intervention_path)
);

create table if not exists public.bapperida_recommendations (
  id uuid primary key default gen_random_uuid(),
  reference_code varchar not null unique default ('REC-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  category varchar not null,
  finding text not null,
  recommendation text not null,
  status varchar not null default 'DRAFT',
  mayor_note text,
  evaluation_snapshot_id uuid references public.bapperida_evaluation_snapshots(id) on delete set null,
  version integer not null default 1,
  submitted_at timestamptz,
  completed_at timestamptz,
  is_fixture boolean not null default false,
  created_by uuid not null references public.user_profiles(id),
  updated_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bapperida_recommendation_category_check check (
    category in ('CAPAIAN_JALUR', 'SEBARAN_WILAYAH', 'RE_ENTRY', 'INTEGRASI_DATA', 'ANGGARAN', 'OUTCOME')
  ),
  constraint bapperida_recommendation_status_check check (
    status in ('DRAFT', 'MENUNGGU_PERSETUJUAN', 'PERLU_REVISI', 'DITINDAKLANJUTI', 'SELESAI')
  ),
  constraint bapperida_recommendation_version_check check (version > 0),
  constraint bapperida_recommendation_text_check check (
    length(trim(reference_code)) between 5 and 50
    and
    length(trim(finding)) between 10 and 3000
    and length(trim(recommendation)) between 10 and 3000
    and (mayor_note is null or length(trim(mayor_note)) between 10 and 2000)
  )
);

create table if not exists public.bapperida_recommendation_recipients (
  recommendation_id uuid not null references public.bapperida_recommendations(id) on delete cascade,
  opd_id uuid not null references public.master_opd(id),
  follow_up_status varchar not null default 'MENUNGGU',
  follow_up_note text,
  updated_at timestamptz not null default now(),
  primary key (recommendation_id, opd_id),
  constraint bapperida_recipient_status_check check (
    follow_up_status in ('MENUNGGU', 'DITERIMA', 'DITINDAKLANJUTI', 'SELESAI')
  ),
  constraint bapperida_recipient_note_check check (
    follow_up_note is null or length(trim(follow_up_note)) between 5 and 2000
  )
);

create table if not exists public.bapperida_recommendation_events (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.bapperida_recommendations(id) on delete cascade,
  event_type varchar not null,
  from_status varchar,
  to_status varchar not null,
  note text,
  version integer not null,
  actor_user_id uuid not null references public.user_profiles(id),
  event_at timestamptz not null default now(),
  constraint bapperida_event_type_check check (
    event_type in ('DRAFT_SAVED', 'SUBMITTED', 'REVISION_SAVED', 'RESUBMITTED', 'STATUS_CHANGED')
  ),
  constraint bapperida_event_version_check check (version > 0),
  constraint bapperida_event_note_check check (note is null or length(trim(note)) between 3 and 2000)
);

create index if not exists idx_bapperida_targets_year on public.bapperida_indicator_targets(target_year, is_active);
create index if not exists idx_bapperida_snapshots_period on public.bapperida_evaluation_snapshots(period desc, status);
create index if not exists idx_bapperida_snapshots_fixture on public.bapperida_evaluation_snapshots(is_fixture) where is_fixture;
create index if not exists idx_bapperida_recommendations_status on public.bapperida_recommendations(status, updated_at desc);
create index if not exists idx_bapperida_recommendations_fixture on public.bapperida_recommendations(is_fixture) where is_fixture;
create index if not exists idx_bapperida_recipients_opd on public.bapperida_recommendation_recipients(opd_id, follow_up_status);
create index if not exists idx_bapperida_events_timeline on public.bapperida_recommendation_events(recommendation_id, event_at asc);

drop trigger if exists trg_bapperida_target_updated_at on public.bapperida_indicator_targets;
create trigger trg_bapperida_target_updated_at before update on public.bapperida_indicator_targets
for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_bapperida_recommendation_updated_at on public.bapperida_recommendations;
create trigger trg_bapperida_recommendation_updated_at before update on public.bapperida_recommendations
for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_bapperida_recipient_updated_at on public.bapperida_recommendation_recipients;
create trigger trg_bapperida_recipient_updated_at before update on public.bapperida_recommendation_recipients
for each row execute function public.dinsos_touch_updated_at();

alter table public.bapperida_indicator_targets enable row level security;
alter table public.bapperida_evaluation_snapshots enable row level security;
alter table public.bapperida_recommendations enable row level security;
alter table public.bapperida_recommendation_recipients enable row level security;
alter table public.bapperida_recommendation_events enable row level security;

revoke all on table public.bapperida_indicator_targets from anon, authenticated;
revoke all on table public.bapperida_evaluation_snapshots from anon, authenticated;
revoke all on table public.bapperida_recommendations from anon, authenticated;
revoke all on table public.bapperida_recommendation_recipients from anon, authenticated;
revoke all on table public.bapperida_recommendation_events from anon, authenticated;

create or replace view public.bapperida_v_cross_opd_outcomes
with (security_invoker = true)
as
select
  referral.id as referral_id,
  referral.warga_id,
  referral.target_opd_id,
  opd.kode_opd,
  referral.program_id,
  referral.status,
  case
    when opd.kode_opd in ('DKPP', 'DISBUDPAR', 'CIPTA_BINTAR') then 'AKSELERASI_SEKTORAL'
    when referral.jalur = 'PEKERJA' then 'PEKERJA'
    when referral.jalur = 'WIRAUSAHA' then 'WIRAUSAHA'
    else 'PENGUATAN_DASAR'
  end as intervention_path,
  warga.kecamatan,
  warga.kelurahan,
  desil.desil_dtsen,
  referral.sent_at,
  referral.completed_at,
  referral.created_at,
  referral.updated_at
from public.referral_mbi referral
join public.warga warga on warga.id = referral.warga_id
left join public.master_opd opd on opd.id = referral.target_opd_id
left join public.v_warga_desil_current desil on desil.warga_id = referral.warga_id
where referral.referral_type = 'JALUR_MBI';

revoke all on table public.bapperida_v_cross_opd_outcomes from anon, authenticated;
grant select on table public.bapperida_v_cross_opd_outcomes to service_role;
