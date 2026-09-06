create table if not exists public.system_alerts (
  id uuid primary key default gen_random_uuid(),

  severity varchar not null
    check (severity in ('INFO', 'WARNING', 'CRITICAL')),

  title varchar not null,
  message text not null,
  module varchar not null,
  source_type varchar,
  source_id uuid,

  status varchar not null default 'OPEN'
    check (status in ('OPEN', 'RESOLVED')),

  occurred_at timestamptz not null default now(),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_system_alerts_status
on public.system_alerts(status);

create index if not exists idx_system_alerts_occurred_at
on public.system_alerts(occurred_at desc);

create index if not exists idx_system_alerts_source
on public.system_alerts(source_type, source_id);

create unique index if not exists idx_system_alerts_open_source_unique
on public.system_alerts(source_type, source_id, title)
where status = 'OPEN';

alter table public.system_alerts enable row level security;

insert into public.system_alerts (
  severity,
  title,
  message,
  module,
  source_type,
  source_id,
  status,
  occurred_at
)
select
  'CRITICAL',
  'Koneksi Dinsos Terputus',
  'API Sinkronisasi DTKS sedang berstatus OFFLINE.',
  'Integrasi API',
  'integrasi_api',
  integration.id,
  'OPEN',
  now()
from public.integrasi_api as integration
where integration.id = '77e6d60c-d253-4eab-98fa-fc89fd20bd12'
  and integration.instansi = 'Dinsos'
  and integration.layanan = 'Sinkronisasi DTKS'
  and integration.status = 'OFFLINE'
  and not exists (
    select 1
    from public.system_alerts as existing_alert
    where existing_alert.source_type = 'integrasi_api'
      and existing_alert.source_id = integration.id
      and existing_alert.title = 'Koneksi Dinsos Terputus'
      and existing_alert.status = 'OPEN'
  );
