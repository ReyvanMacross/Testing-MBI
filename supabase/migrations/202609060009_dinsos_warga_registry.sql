create or replace function public.dinsos_warga_summary()
returns table (
  total_warga bigint,
  sudah_diverifikasi bigint,
  belum_diverifikasi bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with latest_verification as (
    select distinct on (vv.warga_id)
      vv.warga_id,
      vv.status_verifikasi
    from public.verifikasi_validasi vv
    order by
      vv.warga_id,
      vv.created_at desc nulls last,
      vv.id desc
  )
  select
    count(w.id) as total_warga,
    count(w.id) filter (
      where lv.status_verifikasi::text = 'VERIFIED'
    ) as sudah_diverifikasi,
    count(w.id) filter (
      where lv.status_verifikasi is null
         or lv.status_verifikasi::text <> 'VERIFIED'
    ) as belum_diverifikasi
  from public.warga w
  left join latest_verification lv
    on lv.warga_id = w.id;
$$;

create or replace function public.list_dinsos_warga(
  p_search text default null,
  p_kelurahan_id uuid default null,
  p_desil integer default null,
  p_verification_status text default null,
  p_limit integer default 7,
  p_offset integer default 0
)
returns table (
  warga_id uuid,
  nik varchar,
  nama_lengkap varchar,
  kelurahan varchar,
  kecamatan varchar,
  location_resolved boolean,
  desil integer,
  status_verifikasi text,
  jalur_aktif text,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    w.id as warga_id,
    w.nik,
    w.nama_lengkap,
    coalesce(mk.nama, w.kelurahan) as kelurahan,
    coalesce(mc.nama, w.kecamatan) as kecamatan,
    (w.kelurahan_id is not null and w.kecamatan_id is not null) as location_resolved,
    pd.desil_dtsen as desil,
    vv.status_verifikasi,
    coalesce(
      referral.jalur_aktif,
      intervention.jalur_aktif,
      replace(path.output_jalur, '_', ' ')
    ) as jalur_aktif,
    count(*) over() as total_count
  from public.warga w
  left join public.master_wilayah mk
    on mk.id = w.kelurahan_id
   and mk.jenis = 'KELURAHAN'
  left join public.master_wilayah mc
    on mc.id = w.kecamatan_id
   and mc.jenis = 'KECAMATAN'
  left join lateral (
    select pd1.desil_dtsen
    from public.penetapan_desil pd1
    where pd1.warga_id = w.id
    order by
      pd1.created_at desc nulls last,
      pd1.id desc
    limit 1
  ) pd on true
  left join lateral (
    select vv1.status_verifikasi::text as status_verifikasi
    from public.verifikasi_validasi vv1
    where vv1.warga_id = w.id
    order by
      vv1.created_at desc nulls last,
      vv1.id desc
    limit 1
  ) vv on true
  left join lateral (
    select coalesce(
      nullif(trim(r.target_program), ''),
      replace(r.referral_type, '_', ' ')
    ) as jalur_aktif
    from public.referral_mbi r
    where r.warga_id = w.id
      and r.status in ('TERKIRIM', 'DITERIMA', 'DIPROSES')
    order by r.sent_at desc nulls last, r.id desc
    limit 1
  ) referral on true
  left join lateral (
    select coalesce(
      nullif(trim(il.nama_program), ''),
      nullif(trim(il.opd), '')
    ) as jalur_aktif
    from public.intervensi_lanjutan il
    where il.warga_id = w.id
      and (
        il.status is null
        or upper(trim(il.status)) not in ('SELESAI', 'DIBATALKAN')
      )
    order by il.created_at desc nulls last, il.id desc
    limit 1
  ) intervention on true
  left join lateral (
    select pj.output_jalur::text as output_jalur
    from public.penentuan_jalur pj
    where pj.warga_id = w.id
      and pj.output_jalur is not null
    order by pj.created_at desc nulls last, pj.id desc
    limit 1
  ) path on true
  where
    (
      p_search is null
      or trim(p_search) = ''
      or w.nama_lengkap ilike '%' || trim(p_search) || '%'
      or coalesce(w.nik, '') ilike '%' || trim(p_search) || '%'
    )
    and (
      p_kelurahan_id is null
      or w.kelurahan_id = p_kelurahan_id
    )
    and (
      p_desil is null
      or pd.desil_dtsen = p_desil
    )
    and (
      p_verification_status is null
      or trim(p_verification_status) = ''
      or (
        upper(trim(p_verification_status)) = 'TERVERIFIKASI'
        and vv.status_verifikasi = 'VERIFIED'
      )
      or (
        upper(trim(p_verification_status)) = 'BELUM'
        and coalesce(vv.status_verifikasi, '') <> 'VERIFIED'
      )
    )
  order by w.nama_lengkap asc, w.id asc
  limit greatest(1, least(p_limit, 100))
  offset greatest(p_offset, 0);
$$;

revoke all on function public.dinsos_warga_summary()
from public, anon, authenticated;

grant execute on function public.dinsos_warga_summary()
to service_role;

revoke all on function public.list_dinsos_warga(
  text, uuid, integer, text, integer, integer
)
from public, anon, authenticated;

grant execute on function public.list_dinsos_warga(
  text, uuid, integer, text, integer, integer
)
to service_role;
