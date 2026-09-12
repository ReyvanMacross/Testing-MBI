-- WALIKOTA is an executive layer over canonical MBI outcomes and Bapperida recommendations.
-- Operational citizen, referral, program, and outcome records remain in their owning modules.

insert into public.master_opd (kode_opd, nama_opd)
values ('WALIKOTA', 'Wali Kota Bandung')
on conflict (kode_opd) do update set nama_opd = excluded.nama_opd;

create table if not exists public.walikota_decisions (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.bapperida_recommendations(id) on delete restrict,
  recommendation_version integer not null,
  action varchar not null,
  priority_level varchar not null default 'NORMAL',
  leader_note text not null,
  resulting_status varchar not null,
  version integer not null default 1,
  is_fixture boolean not null default false,
  decided_by uuid not null references public.user_profiles(id),
  decided_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint walikota_decision_action_check check (action in ('APPROVE', 'REQUEST_REVISION')),
  constraint walikota_decision_priority_check check (priority_level in ('NORMAL', 'TINGGI', 'MENDESAK')),
  constraint walikota_decision_result_check check (resulting_status in ('PERLU_REVISI', 'DITINDAKLANJUTI')),
  constraint walikota_decision_version_check check (recommendation_version > 0 and version > 0),
  constraint walikota_decision_note_check check (length(trim(leader_note)) between 10 and 2000),
  constraint walikota_decision_source_unique unique (recommendation_id, recommendation_version)
);

create table if not exists public.walikota_dispositions (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.walikota_decisions(id) on delete cascade,
  target_opd_id uuid not null references public.master_opd(id),
  instruction text not null,
  due_date date,
  status varchar not null default 'DITERBITKAN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint walikota_disposition_status_check check (status in ('DITERBITKAN', 'DITERIMA', 'SELESAI')),
  constraint walikota_disposition_instruction_check check (length(trim(instruction)) between 10 and 2000),
  constraint walikota_disposition_due_date_check check (due_date is null or due_date >= (created_at at time zone 'Asia/Jakarta')::date),
  constraint walikota_disposition_target_unique unique (decision_id, target_opd_id)
);

create table if not exists public.walikota_decision_events (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.walikota_decisions(id) on delete cascade,
  recommendation_id uuid not null references public.bapperida_recommendations(id) on delete restrict,
  event_type varchar not null,
  from_status varchar not null,
  to_status varchar not null,
  note text not null,
  recommendation_version integer not null,
  actor_user_id uuid not null references public.user_profiles(id),
  event_at timestamptz not null default now(),
  constraint walikota_event_type_check check (event_type in ('APPROVED', 'REVISION_REQUESTED', 'DISPOSITION_ISSUED')),
  constraint walikota_event_version_check check (recommendation_version > 0),
  constraint walikota_event_note_check check (length(trim(note)) between 10 and 2000)
);

create index if not exists idx_walikota_decisions_recommendation on public.walikota_decisions(recommendation_id, decided_at desc);
create index if not exists idx_walikota_decisions_priority on public.walikota_decisions(priority_level, decided_at desc);
create index if not exists idx_walikota_decisions_fixture on public.walikota_decisions(is_fixture) where is_fixture;
create index if not exists idx_walikota_dispositions_target on public.walikota_dispositions(target_opd_id, status);
create index if not exists idx_walikota_events_timeline on public.walikota_decision_events(recommendation_id, event_at asc);

drop trigger if exists trg_walikota_decision_updated_at on public.walikota_decisions;
create trigger trg_walikota_decision_updated_at before update on public.walikota_decisions
for each row execute function public.dinsos_touch_updated_at();
drop trigger if exists trg_walikota_disposition_updated_at on public.walikota_dispositions;
create trigger trg_walikota_disposition_updated_at before update on public.walikota_dispositions
for each row execute function public.dinsos_touch_updated_at();

alter table public.walikota_decisions enable row level security;
alter table public.walikota_dispositions enable row level security;
alter table public.walikota_decision_events enable row level security;

revoke all on table public.walikota_decisions from anon, authenticated;
revoke all on table public.walikota_dispositions from anon, authenticated;
revoke all on table public.walikota_decision_events from anon, authenticated;

create or replace view public.walikota_v_executive_outcomes
with (security_invoker = true)
as
select * from public.bapperida_v_cross_opd_outcomes;

revoke all on table public.walikota_v_executive_outcomes from anon, authenticated;
grant select on table public.walikota_v_executive_outcomes to service_role;
