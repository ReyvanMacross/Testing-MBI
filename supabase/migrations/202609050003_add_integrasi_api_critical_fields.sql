alter table public.integrasi_api
add column if not exists is_critical boolean not null default false,
add column if not exists critical_order integer;

create index if not exists idx_integrasi_api_critical
on public.integrasi_api (is_critical)
where is_critical = true;

update public.integrasi_api
set
  is_critical = true,
  critical_order = 1
where id = '676399dd-ef57-4fa2-b51f-35b515fc8fc0'
  and instansi = 'Disdukcapil'
  and layanan = 'Get Data Penduduk';

update public.integrasi_api
set
  is_critical = true,
  critical_order = 2
where id = 'aa38d583-e2ae-4f18-bde6-2e8087419669'
  and instansi = 'Kemensos (Pusat)'
  and layanan = 'Validasi NIK';

update public.integrasi_api
set
  is_critical = true,
  critical_order = 3
where id = '77e6d60c-d253-4eab-98fa-fc89fd20bd12'
  and instansi = 'Dinsos'
  and layanan = 'Sinkronisasi DTKS';
