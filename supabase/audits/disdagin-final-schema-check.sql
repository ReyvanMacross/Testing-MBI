-- Read-only audit for the Disdagin MVP.

with expected_tables(table_name) as (
  values
    ('disdagin_pendamping'), ('disdagin_business_profiles'),
    ('disdagin_program_details'), ('disdagin_interventions'),
    ('disdagin_intervention_events'), ('disdagin_kemandirian_usaha'),
    ('disdagin_laporan_omzet')
)
select 'TABLE' as section, expected.table_name as object_name,
  case when actual.table_name is null then 'MISSING' else 'PASS' end as result
from expected_tables expected
left join information_schema.tables actual
  on actual.table_schema = 'public' and actual.table_name = expected.table_name
order by expected.table_name;

with expected_functions(routine_name) as (
  values ('disdagin_actor_allowed'), ('disdagin_start_intervention'),
    ('disdagin_update_intervention_progress'), ('disdagin_complete_intervention'),
    ('disdagin_create_program'), ('disdagin_validate_domain_integrity')
)
select 'FUNCTION' as section, expected.routine_name as object_name,
  case when actual.routine_name is null then 'MISSING' else 'PASS' end as result
from expected_functions expected
left join information_schema.routines actual
  on actual.routine_schema = 'public' and actual.routine_name = expected.routine_name
order by expected.routine_name;

select 'RLS' as section, tablename as object_name,
  case when rowsecurity then 'PASS' else 'BLOCKER' end as result
from pg_tables
where schemaname = 'public' and tablename like 'disdagin\_%' escape '\'
order by tablename;

with expected_tables(table_name) as (
  values ('disdagin_pendamping'), ('disdagin_business_profiles'),
    ('disdagin_program_details'), ('disdagin_interventions'),
    ('disdagin_intervention_events'), ('disdagin_kemandirian_usaha'),
    ('disdagin_laporan_omzet')
), exposed as (
  select table_name, count(*) as grant_count
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'authenticated')
    and table_name like 'disdagin\_%' escape '\'
  group by table_name
)
select 'DIRECT_ACCESS' as section, expected.table_name as object_name,
  case when coalesce(exposed.grant_count, 0) = 0 then 'PASS' else 'BLOCKER:' || exposed.grant_count end as result
from expected_tables expected left join exposed using (table_name)
order by expected.table_name;

with disdagin_opd as (select id from public.master_opd where kode_opd = 'DISDAGIN'),
integrity_checks(check_name, violating_rows) as (
  select 'INVALID_PROGRAM_RELATION', count(*)
  from public.disdagin_program_details d
  left join public.master_program_layanan p on p.id = d.program_id
  where p.id is null or p.opd_id is distinct from (select id from disdagin_opd)
     or p.jalur is distinct from 'WIRAUSAHA'
  union all
  select 'INVALID_INTERVENTION_RELATION', count(*)
  from public.disdagin_interventions i
  left join public.referral_mbi r on r.id = i.referral_id
  left join public.disdagin_business_profiles b on b.id = i.business_profile_id
  where r.id is null or r.target_opd_id is distinct from (select id from disdagin_opd)
     or r.jalur is distinct from 'WIRAUSAHA' or b.warga_id is distinct from r.warga_id
  union all
  select 'PROCESSED_WITHOUT_INTERVENTION', count(*)
  from public.referral_mbi r
  where r.target_opd_id = (select id from disdagin_opd) and r.jalur = 'WIRAUSAHA'
    and r.status in ('DIPROSES', 'SELESAI')
    and not exists (select 1 from public.disdagin_interventions i where i.referral_id = r.id)
  union all
  select 'QUOTA_OVERFLOW', count(*) from (
    select d.program_id from public.disdagin_program_details d
    left join public.disdagin_interventions i on i.program_id = d.program_id and i.participant_status <> 'TIDAK_AKTIF'
    group by d.program_id, d.capacity having count(i.id) > d.capacity
  ) overflow
  union all
  select 'COMPLETED_WITHOUT_OUTCOME', count(*) from public.disdagin_interventions i
  where i.participant_status = 'MANDIRI_SELESAI'
    and not exists (select 1 from public.disdagin_kemandirian_usaha o where o.intervention_id = i.id)
  union all
  select 'COMPLETED_WITHOUT_EVENT', count(*) from public.disdagin_interventions i
  where i.participant_status = 'MANDIRI_SELESAI'
    and not exists (select 1 from public.disdagin_intervention_events e where e.intervention_id = i.id and e.event_type = 'COMPLETED')
  union all
  select 'COMPLETED_WITHOUT_REPORT', count(*) from public.disdagin_interventions i
  where i.participant_status = 'MANDIRI_SELESAI'
    and not exists (select 1 from public.disdagin_laporan_omzet l where l.intervention_id = i.id)
)
select 'INTEGRITY' as section, check_name as object_name,
  case when violating_rows = 0 then 'PASS' else 'BLOCKER:' || violating_rows end as result
from integrity_checks order by check_name;

select 'FIXTURE' as section, object_name,
  case when row_count = 0 then 'PASS' else 'BLOCKER:' || row_count end as result
from (
  select 'disdagin_interventions' as object_name, count(*) as row_count
  from public.disdagin_interventions where is_fixture
  union all
  select 'disdagin_business_profiles', count(*)
  from public.disdagin_business_profiles where is_fixture
  union all
  select 'disdagin_pendamping_dev_code', count(*)
  from public.disdagin_pendamping where kode like 'DEV-%'
  union all
  select 'disdagin_program_dev_code', count(*)
  from public.master_program_layanan program
  join public.master_opd opd on opd.id = program.opd_id
  where opd.kode_opd = 'DISDAGIN' and program.kode_program like 'DEV-%'
) fixtures;
