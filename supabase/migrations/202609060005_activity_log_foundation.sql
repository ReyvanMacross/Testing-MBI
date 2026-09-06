alter table public.log_aktivitas
add column if not exists metadata jsonb
  not null default '{}'::jsonb;

create index if not exists idx_log_aktivitas_created_at
on public.log_aktivitas(created_at desc);

create index if not exists idx_log_aktivitas_user_id
on public.log_aktivitas(user_id);

create index if not exists idx_log_aktivitas_modul
on public.log_aktivitas(modul);

create index if not exists idx_log_aktivitas_status
on public.log_aktivitas(status);

do $$
begin
  if not exists (
    select 1
    from public.log_aktivitas
    where status not in (
      'BERHASIL',
      'GAGAL',
      'PERINGATAN'
    )
  ) then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'log_aktivitas_status_check'
    ) then
      alter table public.log_aktivitas
      add constraint log_aktivitas_status_check
      check (
        status in (
          'BERHASIL',
          'GAGAL',
          'PERINGATAN'
        )
      );
    end if;
  else
    raise notice
      'Status legacy di luar BERHASIL/GAGAL/PERINGATAN ditemukan; constraint dilewati.';
  end if;
end $$;

drop function if exists public.list_activity_logs(
  text,
  text,
  uuid,
  boolean,
  date,
  integer,
  integer
);

create function public.list_activity_logs(
  p_search text default null,
  p_module text default null,
  p_user_id uuid default null,
  p_system_only boolean default false,
  p_date date default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  user_id uuid,
  nama_pengguna varchar,
  role_pengguna varchar,
  aktivitas text,
  modul varchar,
  status varchar,
  metadata jsonb,
  created_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    la.id,
    la.user_id,
    la.nama_pengguna,
    la.role_pengguna,
    la.aktivitas,
    la.modul,
    la.status,
    la.metadata,
    la.created_at,
    count(*) over() as total_count
  from public.log_aktivitas la
  where
    (
      p_search is null
      or trim(p_search) = ''
      or la.aktivitas ilike '%' || trim(p_search) || '%'
      or la.nama_pengguna ilike '%' || trim(p_search) || '%'
      or la.role_pengguna ilike '%' || trim(p_search) || '%'
      or la.modul ilike '%' || trim(p_search) || '%'
    )
    and (
      p_module is null
      or trim(p_module) = ''
      or la.modul = p_module
    )
    and (
      case
        when p_system_only = true then la.user_id is null
        when p_user_id is not null then la.user_id = p_user_id
        else true
      end
    )
    and (
      p_date is null
      or (
        la.created_at >= (
          p_date::timestamp at time zone 'Asia/Jakarta'
        )
        and la.created_at < (
          (p_date + 1)::timestamp at time zone 'Asia/Jakarta'
        )
      )
    )
  order by
    la.created_at desc,
    la.id desc
  limit greatest(1, least(p_limit, 10000))
  offset greatest(p_offset, 0);
$$;

revoke all
on function public.list_activity_logs(
  text,
  text,
  uuid,
  boolean,
  date,
  integer,
  integer
)
from public;

grant execute
on function public.list_activity_logs(
  text,
  text,
  uuid,
  boolean,
  date,
  integer,
  integer
)
to service_role;

create or replace function public.activity_log_filter_options()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'modules',
    (
      select coalesce(
        jsonb_agg(x.modul order by x.modul),
        '[]'::jsonb
      )
      from (
        select distinct modul
        from public.log_aktivitas
        where modul is not null
          and trim(modul) <> ''
      ) x
    ),
    'statuses',
    (
      select coalesce(
        jsonb_agg(x.status order by x.status),
        '[]'::jsonb
      )
      from (
        select distinct status
        from public.log_aktivitas
        where status is not null
      ) x
    )
  );
$$;

revoke all
on function public.activity_log_filter_options()
from public;

grant execute
on function public.activity_log_filter_options()
to service_role;
