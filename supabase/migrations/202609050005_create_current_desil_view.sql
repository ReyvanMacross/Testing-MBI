create or replace view public.v_warga_desil_current
with (security_invoker = true)
as
select
  w.id as warga_id,
  w.nik,
  w.nama_lengkap,
  w.kecamatan,
  w.kelurahan,
  w.koordinat_lat,
  w.koordinat_lng,

  pd.id as penetapan_desil_id,
  pd.desil_dtsen,
  pd.status_dtsen,
  pd.tingkat_kerentanan,
  pd.skor_kemiskinan,
  pd.prioritas_intervensi,
  pd.created_at as desil_created_at
from public.warga as w
left join lateral (
  select pd1.*
  from public.penetapan_desil as pd1
  where pd1.warga_id = w.id
  order by
    pd1.created_at desc nulls last,
    pd1.id desc
  limit 1
) as pd on true;
