do $$
declare
  fixture_ids uuid[] := array[
    'c46d7f48-4074-4d2d-b80e-7f477ac3b1d3'::uuid,
    '5eec4242-38cd-4379-8ec8-dd2439d38941'::uuid
  ];
  matched integer;
begin
  select count(*)
  into matched
  from public.integrasi_api
  where id = any(fixture_ids)
    and (
      lower(layanan) like '%fixture%'
      or lower(instansi) like '%fixture%'
      or lower(coalesce(notes, '')) like '%fixture%'
    );

  if matched <> 2 then
    raise exception
      'Expected exactly 2 verified development fixtures, found %',
      matched;
  end if;

  delete from public.system_alerts
  where source_type in ('INTEGRASI_API', 'integrasi_api')
    and source_id = any(fixture_ids);

  delete from public.integrasi_api
  where id = any(fixture_ids);
end $$;

do $$
declare
  test_profile_ids uuid[] := array[
    '3b6bf014-f8c7-48c8-ae72-0cb1e70e6b5c'::uuid,
    '18319332-ee6b-4b29-b226-74b234119169'::uuid,
    'bc9ddc99-b7ff-4a6c-a73e-b8147ec4a4c6'::uuid
  ];
  matched integer;
begin
  select count(*)
  into matched
  from public.user_profiles
  where id = any(test_profile_ids)
    and nama_lengkap in (
      'Test Admin',
      'Operator Lapangan Test',
      'Operator Kelurahan Test'
    );

  if matched <> 3 then
    raise exception
      'Expected exactly 3 verified test profiles, found %',
      matched;
  end if;

  update public.user_profiles
  set status = 'NONAKTIF'
  where id = any(test_profile_ids);
end $$;
