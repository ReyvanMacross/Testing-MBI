begin;

update public.integrasi_api
set opd_id = '3306ead2-8dc4-4f8d-9923-e56df1ce3c2d'
where id = '77e6d60c-d253-4eab-98fa-fc89fd20bd12'
  and opd_id is null
  and lower(trim(instansi)) in ('dinsos', 'dinas sosial');

commit;
