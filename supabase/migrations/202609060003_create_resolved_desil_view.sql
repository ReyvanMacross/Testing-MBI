create or replace view public.v_warga_desil_current_resolved as
select
  wd.warga_id,
  wd.nik,
  wd.nama_lengkap,
  wd.kecamatan as kecamatan_legacy,
  wd.kelurahan as kelurahan_legacy,
  w.kecamatan_id,
  w.kelurahan_id,
  mk.kode_wilayah as kecamatan_kode,
  mk.nama as kecamatan_resolved,
  ml.kode_wilayah as kelurahan_kode,
  ml.nama as kelurahan_resolved,
  wd.desil_dtsen,
  wd.status_dtsen,
  wd.tingkat_kerentanan,
  wd.skor_kemiskinan,
  wd.prioritas_intervensi,
  wd.desil_created_at
from public.v_warga_desil_current wd
join public.warga w
  on w.id = wd.warga_id
left join public.master_wilayah mk
  on mk.id = w.kecamatan_id
left join public.master_wilayah ml
  on ml.id = w.kelurahan_id;
