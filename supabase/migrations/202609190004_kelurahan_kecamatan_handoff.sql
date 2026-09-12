-- Perluasan forward-only untuk handoff resmi Kelurahan ke workflow Kecamatan.
-- Migration Kecamatan yang sudah diterapkan tetap immutable.

create or replace function public.kecamatan_proposal_origin_actor_allowed(
  p_actor_id uuid,
  p_kecamatan_id uuid,
  p_kelurahan_id uuid
)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.kecamatan_actor_allowed(p_actor_id, p_kecamatan_id)
    or exists (
      select 1
      from public.user_profiles profile
      join public.master_wilayah kelurahan on kelurahan.id = profile.wilayah_id
      join public.master_wilayah kecamatan on kecamatan.id = kelurahan.parent_id
      where profile.id = p_actor_id
        and profile.status = 'AKTIF'
        and profile.role = 'Operator Kelurahan'
        and profile.wilayah_id = p_kelurahan_id
        and kelurahan.id = p_kelurahan_id
        and kelurahan.jenis = 'KELURAHAN'
        and kelurahan.is_active
        and kecamatan.id = p_kecamatan_id
        and kecamatan.jenis = 'KECAMATAN'
        and kecamatan.is_active
    );
$$;

create or replace function public.kecamatan_guard_proposal_scope()
returns trigger language plpgsql set search_path = public as $$
declare
  warga_kecamatan uuid;
  warga_kelurahan uuid;
  kelurahan_parent uuid;
begin
  select kecamatan_id, kelurahan_id into warga_kecamatan, warga_kelurahan
  from public.warga where id = new.warga_id;
  select parent_id into kelurahan_parent from public.master_wilayah
  where id = new.kelurahan_id and jenis = 'KELURAHAN' and is_active;
  if warga_kecamatan is distinct from new.kecamatan_id
     or warga_kelurahan is distinct from new.kelurahan_id
     or kelurahan_parent is distinct from new.kecamatan_id then
    raise exception using errcode = '23514', message = 'INVALID_KECAMATAN_JURISDICTION';
  end if;
  if not public.kecamatan_proposal_origin_actor_allowed(
       new.created_by, new.kecamatan_id, new.kelurahan_id
     )
     or not public.kecamatan_proposal_origin_actor_allowed(
       new.updated_by, new.kecamatan_id, new.kelurahan_id
     ) then
    raise exception using errcode = '42501', message = 'KECAMATAN_ACTOR_REQUIRED';
  end if;
  return new;
end;
$$;

do $$ declare signature regprocedure; begin
  foreach signature in array array[
    'public.kecamatan_proposal_origin_actor_allowed(uuid,uuid,uuid)'::regprocedure,
    'public.kecamatan_guard_proposal_scope()'::regprocedure
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', signature);
    execute format('grant execute on function %s to service_role', signature);
  end loop;
end $$;
