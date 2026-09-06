alter table public.user_profiles
add column if not exists wilayah_id uuid
  references public.master_wilayah(id),
add column if not exists updated_at timestamptz
  not null default now();

create index if not exists idx_user_profiles_opd_id
on public.user_profiles(opd_id);

create index if not exists idx_user_profiles_wilayah_id
on public.user_profiles(wilayah_id);

create index if not exists idx_user_profiles_status
on public.user_profiles(status);

create index if not exists idx_user_profiles_created_at
on public.user_profiles(created_at desc);

-- Existing legacy profiles are retained for audit even when they do not yet
-- have a username or NIP. NOT VALID still enforces the rule for new/updated rows.
alter table public.user_profiles
drop constraint if exists user_profiles_identifier_required;

alter table public.user_profiles
add constraint user_profiles_identifier_required
check (
  username is not null
  or nip is not null
) not valid;

alter table public.user_profiles
drop constraint if exists user_profiles_nip_format;

alter table public.user_profiles
add constraint user_profiles_nip_format
check (
  nip is null
  or nip ~ '^[0-9]{18}$'
);

alter table public.user_profiles
drop constraint if exists user_profiles_username_format;

alter table public.user_profiles
add constraint user_profiles_username_format
check (
  username is null
  or username ~ '^[a-z0-9._-]{3,50}$'
);

create or replace function public.normalize_user_profile_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email := lower(trim(new.email));

  if new.username is not null then
    new.username := lower(trim(new.username));

    if new.username = '' then
      new.username := null;
    end if;
  end if;

  if new.nip is not null then
    new.nip := trim(new.nip);

    if new.nip = '' then
      new.nip := null;
    end if;
  end if;

  new.nama_lengkap := trim(new.nama_lengkap);
  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists trg_normalize_user_profile_identity
on public.user_profiles;

create trigger trg_normalize_user_profile_identity
before insert or update
on public.user_profiles
for each row
execute function public.normalize_user_profile_identity();

alter table public.user_profiles
drop constraint if exists user_profiles_status_check;

alter table public.user_profiles
add constraint user_profiles_status_check
check (
  status in ('AKTIF', 'NONAKTIF')
);

do $$
declare
  role_type text;
begin
  select udt_name
  into role_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'user_profiles'
    and column_name = 'role';

  if role_type is null then
    raise exception 'Enum user_profiles.role tidak ditemukan';
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = role_type
      and e.enumlabel = 'Operator Lapangan'
  ) then
    execute format(
      'alter type %I add value %L',
      role_type,
      'Operator Lapangan'
    );
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = role_type
      and e.enumlabel = 'Operator Kelurahan'
  ) then
    execute format(
      'alter type %I add value %L',
      role_type,
      'Operator Kelurahan'
    );
  end if;
end $$;

drop function if exists public.list_managed_users(
  text,
  uuid,
  uuid,
  integer,
  integer
);

create function public.list_managed_users(
  p_search text default null,
  p_opd_id uuid default null,
  p_wilayah_id uuid default null,
  p_limit integer default 15,
  p_offset integer default 0
)
returns table (
  id uuid,
  auth_user_id uuid,
  email varchar,
  nip varchar,
  username varchar,
  nama_lengkap varchar,
  role text,
  opd_id uuid,
  opd_nama varchar,
  wilayah_id uuid,
  wilayah_nama varchar,
  wilayah_jenis varchar,
  wilayah_legacy varchar,
  status varchar,
  instansi varchar,
  created_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    up.id,
    up.auth_user_id,
    up.email,
    up.nip,
    up.username,
    up.nama_lengkap,
    up.role::text,
    up.opd_id,
    mo.nama_opd,
    up.wilayah_id,
    mw.nama,
    mw.jenis,
    up.wilayah,
    up.status,
    up.instansi,
    up.created_at,
    count(*) over() as total_count

  from public.user_profiles up

  left join public.master_opd mo
    on mo.id = up.opd_id

  left join public.master_wilayah mw
    on mw.id = up.wilayah_id

  where
    (
      p_search is null
      or trim(p_search) = ''
      or up.nama_lengkap ilike '%' || trim(p_search) || '%'
      or up.email ilike '%' || trim(p_search) || '%'
      or coalesce(up.username, '') ilike '%' || trim(p_search) || '%'
      or coalesce(up.nip, '') ilike '%' || trim(p_search) || '%'
    )

    and (
      p_opd_id is null
      or up.opd_id = p_opd_id
    )

    and (
      p_wilayah_id is null
      or up.wilayah_id = p_wilayah_id
    )

  order by
    up.created_at desc,
    up.nama_lengkap asc

  limit greatest(1, least(p_limit, 100))
  offset greatest(p_offset, 0);
$$;

revoke all
on function public.list_managed_users(
  text,
  uuid,
  uuid,
  integer,
  integer
)
from public;

grant execute
on function public.list_managed_users(
  text,
  uuid,
  uuid,
  integer,
  integer
)
to service_role;
