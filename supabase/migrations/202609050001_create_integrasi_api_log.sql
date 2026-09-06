begin;

create table if not exists public.integrasi_api_log (
  id uuid primary key default gen_random_uuid(),

  integrasi_api_id uuid not null
    references public.integrasi_api(id)
    on delete cascade,

  status varchar not null,

  latency_ms integer,

  records_processed integer not null default 0,

  sync_started_at timestamptz,

  sync_finished_at timestamptz,

  error_message text,

  created_at timestamptz not null default now()
);

alter table public.integrasi_api_log enable row level security;

create index if not exists idx_integrasi_api_log_integrasi_id
on public.integrasi_api_log(integrasi_api_id);

create index if not exists idx_integrasi_api_log_created_at
on public.integrasi_api_log(created_at);

create index if not exists idx_integrasi_api_log_status
on public.integrasi_api_log(status);

alter table public.integrasi_api
add column if not exists last_sync_at timestamptz;

alter table public.integrasi_api
add column if not exists last_test_at timestamptz;

commit;
