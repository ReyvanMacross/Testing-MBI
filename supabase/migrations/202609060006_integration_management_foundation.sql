alter table public.integrasi_api
add column if not exists endpoint_url text,
add column if not exists http_method varchar not null default 'GET',
add column if not exists latency_ms integer,
add column if not exists timeout_ms integer not null default 5000,
add column if not exists expected_status_min integer not null default 200,
add column if not exists expected_status_max integer not null default 299,
add column if not exists healthcheck_enabled boolean not null default true,
add column if not exists credential_ref varchar,
add column if not exists credential_type varchar not null default 'NONE',
add column if not exists notes text;

alter table public.integrasi_api
drop constraint if exists integrasi_api_http_method_check;

alter table public.integrasi_api
add constraint integrasi_api_http_method_check
check (http_method in ('GET', 'HEAD', 'POST'));

alter table public.integrasi_api
drop constraint if exists integrasi_api_latency_ms_check;

alter table public.integrasi_api
add constraint integrasi_api_latency_ms_check
check (latency_ms is null or latency_ms >= 0);

alter table public.integrasi_api
drop constraint if exists integrasi_api_timeout_ms_check;

alter table public.integrasi_api
add constraint integrasi_api_timeout_ms_check
check (timeout_ms between 500 and 30000);

alter table public.integrasi_api
drop constraint if exists integrasi_api_expected_status_check;

alter table public.integrasi_api
add constraint integrasi_api_expected_status_check
check (
  expected_status_min between 100 and 599
  and expected_status_max between 100 and 599
  and expected_status_min <= expected_status_max
);

alter table public.integrasi_api
drop constraint if exists integrasi_api_credential_type_check;

alter table public.integrasi_api
add constraint integrasi_api_credential_type_check
check (credential_type in ('NONE', 'BEARER'));

alter table public.integrasi_api
drop constraint if exists integrasi_api_status_check;

alter table public.integrasi_api
add constraint integrasi_api_status_check
check (status in ('BELUM_DITEST', 'ONLINE', 'LAMBAT', 'OFFLINE'));

alter table public.integrasi_api
alter column status set default 'BELUM_DITEST';

update public.integrasi_api
set latency_ms = case
  when latency ~ '^[0-9]+ms$'
    then regexp_replace(latency, 'ms$', '')::integer
  else null
end
where latency_ms is null;

create or replace function public.sync_integrasi_api_latency()
returns trigger
language plpgsql
as $$
begin
  if new.latency_ms is null then
    new.latency := '-';
  else
    new.latency := new.latency_ms::text || 'ms';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_sync_integrasi_api_latency
on public.integrasi_api;

create trigger trg_sync_integrasi_api_latency
before insert or update
on public.integrasi_api
for each row
execute function public.sync_integrasi_api_latency();

create index if not exists idx_integrasi_api_status
on public.integrasi_api(status);

create index if not exists idx_integrasi_api_opd
on public.integrasi_api(opd_id);

create index if not exists idx_integrasi_api_last_test
on public.integrasi_api(last_test_at desc);

create index if not exists idx_integrasi_api_healthcheck
on public.integrasi_api(healthcheck_enabled)
where healthcheck_enabled = true;

alter table public.integrasi_api_log
add column if not exists test_type varchar not null default 'HEALTHCHECK',
add column if not exists http_status integer,
add column if not exists tested_by uuid references public.user_profiles(id),
add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.integrasi_api_log
drop constraint if exists integrasi_api_log_test_type_check;

alter table public.integrasi_api_log
add constraint integrasi_api_log_test_type_check
check (test_type in ('HEALTHCHECK', 'SYNC'));

create index if not exists idx_integrasi_api_log_test
on public.integrasi_api_log(integrasi_api_id, created_at desc);

-- Normalize the source discriminator used by the existing dashboard alert.
update public.system_alerts
set source_type = 'INTEGRASI_API'
where lower(source_type) = 'integrasi_api';

create or replace function public.list_integrations(
  p_search text default null,
  p_status text default null,
  p_opd_id uuid default null,
  p_limit integer default 15,
  p_offset integer default 0
)
returns table (
  id uuid,
  opd_id uuid,
  opd_nama varchar,
  layanan varchar,
  instansi varchar,
  endpoint_url text,
  http_method varchar,
  status varchar,
  latency_ms integer,
  is_critical boolean,
  healthcheck_enabled boolean,
  last_test_at timestamptz,
  last_sync_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ia.id,
    ia.opd_id,
    mo.nama_opd,
    ia.layanan,
    ia.instansi,
    ia.endpoint_url,
    ia.http_method,
    ia.status,
    ia.latency_ms,
    ia.is_critical,
    ia.healthcheck_enabled,
    ia.last_test_at,
    ia.last_sync_at,
    ia.updated_at,
    count(*) over()
  from public.integrasi_api ia
  left join public.master_opd mo on mo.id = ia.opd_id
  where (
    p_search is null
    or trim(p_search) = ''
    or ia.layanan ilike '%' || trim(p_search) || '%'
    or ia.instansi ilike '%' || trim(p_search) || '%'
    or coalesce(mo.nama_opd, '') ilike '%' || trim(p_search) || '%'
  )
  and (p_status is null or p_status = '' or ia.status = p_status)
  and (p_opd_id is null or ia.opd_id = p_opd_id)
  order by ia.is_critical desc, ia.instansi, ia.layanan
  limit greatest(1, least(p_limit, 100))
  offset greatest(p_offset, 0);
$$;

revoke all
on function public.list_integrations(text, text, uuid, integer, integer)
from public;

grant execute
on function public.list_integrations(text, text, uuid, integer, integer)
to service_role;

create or replace function public.integration_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total', count(*),
    'online', count(*) filter (where status = 'ONLINE'),
    'slow', count(*) filter (where status = 'LAMBAT'),
    'offline', count(*) filter (where status = 'OFFLINE'),
    'untested', count(*) filter (where status = 'BELUM_DITEST'),
    'averageLatencyMs', round(avg(latency_ms) filter (where latency_ms is not null))
  )
  from public.integrasi_api;
$$;

revoke all on function public.integration_summary() from public;
grant execute on function public.integration_summary() to service_role;
