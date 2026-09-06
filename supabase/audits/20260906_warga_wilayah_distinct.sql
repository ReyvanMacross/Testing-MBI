select distinct
  trim(kecamatan) as kecamatan,
  trim(kelurahan) as kelurahan
from public.warga
order by 1, 2;
