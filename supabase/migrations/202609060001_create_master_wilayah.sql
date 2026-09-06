create table if not exists public.master_wilayah (
  id uuid primary key default gen_random_uuid(),
  kode_wilayah varchar unique,
  nama varchar not null
    check (trim(nama) <> ''),
  jenis varchar not null
    check (jenis in ('KOTA', 'KECAMATAN', 'KELURAHAN')),
  parent_id uuid
    references public.master_wilayah(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_master_wilayah_parent
on public.master_wilayah(parent_id);

create index if not exists idx_master_wilayah_jenis
on public.master_wilayah(jenis);

create unique index if not exists idx_master_wilayah_parent_nama
on public.master_wilayah(
  parent_id,
  lower(trim(nama))
);

create table if not exists public.wilayah_alias (
  id uuid primary key default gen_random_uuid(),
  wilayah_id uuid not null
    references public.master_wilayah(id)
    on delete cascade,
  alias varchar not null
    check (trim(alias) <> ''),
  created_at timestamptz not null default now()
);

create index if not exists idx_wilayah_alias_wilayah
on public.wilayah_alias(wilayah_id);

create index if not exists idx_wilayah_alias_normalized
on public.wilayah_alias(lower(trim(alias)));

create unique index if not exists idx_wilayah_alias_wilayah_alias
on public.wilayah_alias(
  wilayah_id,
  lower(trim(alias))
);

create or replace function public.set_master_wilayah_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_master_wilayah_updated_at
on public.master_wilayah;

create trigger set_master_wilayah_updated_at
before update on public.master_wilayah
for each row
execute function public.set_master_wilayah_updated_at();

alter table public.master_wilayah enable row level security;
alter table public.wilayah_alias enable row level security;
