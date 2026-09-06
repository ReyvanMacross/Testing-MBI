alter table public.warga
add column if not exists kecamatan_id uuid
  references public.master_wilayah(id),
add column if not exists kelurahan_id uuid
  references public.master_wilayah(id);

create index if not exists idx_warga_kecamatan_id
on public.warga(kecamatan_id);

create index if not exists idx_warga_kelurahan_id
on public.warga(kelurahan_id);

create or replace function public.validate_warga_wilayah_ids()
returns trigger
language plpgsql
as $$
declare
  kecamatan_type varchar;
  kelurahan_type varchar;
  kelurahan_parent uuid;
begin
  if new.kecamatan_id is not null then
    select jenis
    into kecamatan_type
    from public.master_wilayah
    where id = new.kecamatan_id;

    if kecamatan_type is distinct from 'KECAMATAN' then
      raise exception
        'kecamatan_id harus menunjuk master wilayah jenis KECAMATAN';
    end if;
  end if;

  if new.kelurahan_id is not null then
    select jenis, parent_id
    into kelurahan_type, kelurahan_parent
    from public.master_wilayah
    where id = new.kelurahan_id;

    if kelurahan_type is distinct from 'KELURAHAN' then
      raise exception
        'kelurahan_id harus menunjuk master wilayah jenis KELURAHAN';
    end if;

    if new.kecamatan_id is not null
       and kelurahan_parent is distinct from new.kecamatan_id then
      raise exception
        'kelurahan bukan anak kecamatan yang dipilih';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_warga_wilayah_ids
on public.warga;

create trigger trg_validate_warga_wilayah_ids
before insert or update of kecamatan_id, kelurahan_id
on public.warga
for each row
execute function public.validate_warga_wilayah_ids();
