-- Audit read-only untuk migration DP3A 001 sampai 004.

with expected_tables(table_name) as (
  values
    ('dp3a_unit_layanan'),
    ('dp3a_program_details'),
    ('dp3a_cases'),
    ('dp3a_case_events'),
    ('dp3a_realisasi_layanan')
)
select 'TABLE' as section, expected.table_name as object_name,
  case when actual.table_name is null then 'MISSING' else 'PASS' end as result
from expected_tables expected
left join information_schema.tables actual
  on actual.table_schema = 'public' and actual.table_name = expected.table_name
order by expected.table_name;

with expected_columns(table_name, column_name) as (
  values
    ('dp3a_unit_layanan', 'kode'), ('dp3a_unit_layanan', 'kategori'), ('dp3a_unit_layanan', 'is_active'),
    ('dp3a_program_details', 'program_id'), ('dp3a_program_details', 'unit_id'),
    ('dp3a_program_details', 'budget_per_beneficiary'), ('dp3a_program_details', 'capacity'),
    ('dp3a_cases', 'referral_id'), ('dp3a_cases', 'program_id'),
    ('dp3a_cases', 'unit_id'), ('dp3a_cases', 'case_status'),
    ('dp3a_cases', 'verification_status'), ('dp3a_cases', 'progress_percent'),
    ('dp3a_cases', 'planned_budget'), ('dp3a_cases', 'is_fixture'),
    ('dp3a_case_events', 'case_id'), ('dp3a_case_events', 'event_type'),
    ('dp3a_realisasi_layanan', 'case_id'), ('dp3a_realisasi_layanan', 'realized_amount'),
    ('dp3a_realisasi_layanan', 'realization_date')
)
select 'COLUMN' as section,
  expected.table_name || '.' || expected.column_name as object_name,
  case when actual.column_name is null then 'MISSING' else 'PASS' end as result
from expected_columns expected
left join information_schema.columns actual
  on actual.table_schema = 'public'
 and actual.table_name = expected.table_name
 and actual.column_name = expected.column_name
order by expected.table_name, expected.column_name;

with expected_functions(routine_name) as (
  values
    ('dp3a_actor_allowed'),
    ('dp3a_start_case'),
    ('dp3a_update_case_progress'),
    ('dp3a_complete_case'),
    ('dp3a_create_program'),
    ('dp3a_validate_domain_integrity')
)
select 'FUNCTION' as section, expected.routine_name as object_name,
  case when actual.routine_name is null then 'MISSING' else 'PASS' end as result
from expected_functions expected
left join information_schema.routines actual
  on actual.routine_schema = 'public' and actual.routine_name = expected.routine_name
order by expected.routine_name;
select 'RPC_DEFINITION' as section,
  'dp3a_update_case_progress.bandung_business_date' as object_name,
  case when pg_get_functiondef(p.oid) like '%Asia/Jakarta%' then 'PASS' else 'BLOCKER' end as result
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'dp3a_update_case_progress';

select 'RLS' as section, tablename as object_name,
  case when rowsecurity then 'PASS' else 'BLOCKER' end as result
from pg_tables
where schemaname = 'public' and tablename like 'dp3a\_%' escape '\'
order by tablename;

with expected_tables(table_name) as (
  values
    ('dp3a_unit_layanan'), ('dp3a_program_details'), ('dp3a_cases'),
    ('dp3a_case_events'), ('dp3a_realisasi_layanan')
), exposed as (
  select table_name, count(*) as grant_count
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in ('anon', 'authenticated')
    and table_name like 'dp3a\_%' escape '\'
  group by table_name
)
select 'DIRECT_ACCESS' as section, expected.table_name as object_name,
  case when coalesce(exposed.grant_count, 0) = 0 then 'PASS' else 'BLOCKER:' || exposed.grant_count end as result
from expected_tables expected
left join exposed using (table_name)
order by expected.table_name;

with expected_functions(routine_name) as (
  values
    ('dp3a_actor_allowed'),
    ('dp3a_start_case'),
    ('dp3a_update_case_progress'),
    ('dp3a_complete_case'),
    ('dp3a_create_program')
), privilege_state as (
  select p.proname as routine_name,
    has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
    has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'dp3a\_%' escape '\'
)
select 'RPC_PRIVILEGE' as section, expected.routine_name as object_name,
  case
    when privilege_state.routine_name is null then 'MISSING'
    when privilege_state.anon_execute or privilege_state.authenticated_execute then 'BLOCKER:CLIENT_EXECUTE'
    when not privilege_state.service_execute then 'BLOCKER:SERVICE_ROLE_DENIED'
    else 'PASS'
  end as result
from expected_functions expected
left join privilege_state using (routine_name)
order by expected.routine_name;


with dp3a_opd as (
  select id from public.master_opd where kode_opd = 'DP3A'
), integrity_checks(check_name, violating_rows) as (
  select 'INVALID_PROGRAM_RELATION', count(*)
  from public.dp3a_program_details details
  left join public.master_program_layanan program on program.id = details.program_id
  left join public.dp3a_unit_layanan unit on unit.id = details.unit_id
  where program.id is null
     or program.opd_id is distinct from (select id from dp3a_opd)
     or program.jalur is distinct from 'PENGUATAN_DASAR'
     or unit.id is null
  union all
  select 'INVALID_INTERVENTION_RELATION', count(*)
  from public.dp3a_cases caseRecord
  left join public.referral_mbi referral on referral.id = caseRecord.referral_id
  left join public.master_program_layanan program on program.id = caseRecord.program_id
  left join public.dp3a_program_details details on details.program_id = caseRecord.program_id
  where referral.id is null
     or referral.target_opd_id is distinct from (select id from dp3a_opd)
     or referral.referral_type is distinct from 'JALUR_MBI'
     or referral.jalur is distinct from 'PENGUATAN_DASAR'
     or referral.program_id is distinct from caseRecord.program_id
     or program.opd_id is distinct from (select id from dp3a_opd)
     or program.jalur is distinct from 'PENGUATAN_DASAR'
     or details.program_id is null
     or caseRecord.unit_id is distinct from details.unit_id
  union all
  select 'PROCESSED_REFERRAL_WITHOUT_INTERVENTION', count(*)
  from public.referral_mbi referral
  where referral.target_opd_id = (select id from dp3a_opd)
    and referral.referral_type = 'JALUR_MBI'
    and referral.jalur = 'PENGUATAN_DASAR'
    and referral.status in ('DIPROSES', 'SELESAI')
    and not exists (
      select 1 from public.dp3a_cases caseRecord where caseRecord.referral_id = referral.id
    )
  union all
  select 'QUOTA_OVERFLOW', count(*) from (
    select details.program_id
    from public.dp3a_program_details details
    left join public.dp3a_cases caseRecord
      on caseRecord.program_id = details.program_id and caseRecord.case_status <> 'TIDAK_AKTIF'
    group by details.program_id, details.capacity
    having count(caseRecord.id) > details.capacity
  ) overflow
  union all
  select 'REALIZATION_BEFORE_START', count(*)
  from public.dp3a_realisasi_layanan realization
  join public.dp3a_cases caseRecord on caseRecord.id = realization.case_id
  where realization.realization_date < caseRecord.start_date
  union all
  select 'REALIZATION_OVER_BUDGET', count(*)
  from public.dp3a_realisasi_layanan realization
  join public.dp3a_cases caseRecord on caseRecord.id = realization.case_id
  where realization.realized_amount > caseRecord.planned_budget
  union all
  select 'INTERVENTION_WITHOUT_STARTED_EVENT', count(*)
  from public.dp3a_cases caseRecord
  where not exists (
    select 1 from public.dp3a_case_events event
    where event.case_id = caseRecord.id and event.event_type = 'STARTED'
  )
  union all
  select 'COMPLETED_WITHOUT_REALIZATION', count(*)
  from public.dp3a_cases caseRecord
  where caseRecord.case_status = 'SELESAI'
    and not exists (
      select 1 from public.dp3a_realisasi_layanan realization where realization.case_id = caseRecord.id
    )
  union all
  select 'COMPLETED_STATE_MISMATCH', count(*)
  from public.dp3a_cases caseRecord
  where caseRecord.case_status = 'SELESAI'
    and (caseRecord.progress_percent <> 100 or caseRecord.verification_status <> 'LULUS')
  union all
  select 'COMPLETED_REFERRAL_MISMATCH', count(*)
  from public.referral_mbi referral
  join public.dp3a_cases caseRecord on caseRecord.referral_id = referral.id
  where referral.target_opd_id = (select id from dp3a_opd)
    and referral.jalur = 'PENGUATAN_DASAR'
    and referral.status = 'SELESAI'
    and caseRecord.case_status <> 'SELESAI'
  union all
  select 'COMPLETED_INTERVENTION_REFERRAL_MISMATCH', count(*)
  from public.dp3a_cases caseRecord
  join public.referral_mbi referral on referral.id = caseRecord.referral_id
  where caseRecord.case_status = 'SELESAI' and referral.status <> 'SELESAI'
  union all
  select 'COMPLETED_WITHOUT_EVENT', count(*)
  from public.dp3a_cases caseRecord
  where caseRecord.case_status = 'SELESAI'
    and not exists (
      select 1 from public.dp3a_case_events event
      where event.case_id = caseRecord.id and event.event_type = 'COMPLETED'
    )
  union all
  select 'DUPLICATE_INTERVENTION', count(*) from (
    select referral_id from public.dp3a_cases group by referral_id having count(*) > 1
  ) duplicate
  union all
  select 'DUPLICATE_REALIZATION', count(*) from (
    select case_id from public.dp3a_realisasi_layanan group by case_id having count(*) > 1
  ) duplicate
  union all
  select 'DUPLICATE_LIFECYCLE_EVENT', count(*) from (
    select case_id, event_type from public.dp3a_case_events
    where event_type in ('STARTED', 'COMPLETED', 'CANCELLED')
    group by case_id, event_type having count(*) > 1
  ) duplicate
  union all
  select 'ORPHAN_EVENT', count(*)
  from public.dp3a_case_events event
  left join public.dp3a_cases caseRecord on caseRecord.id = event.case_id
  where caseRecord.id is null
)
select 'INTEGRITY' as section, check_name as object_name,
  case when violating_rows = 0 then 'PASS' else 'BLOCKER:' || violating_rows end as result
from integrity_checks
order by check_name;

select 'FIXTURE' as section, 'dp3a_cases' as object_name,
  case when count(*) = 0 then 'PASS' else 'BLOCKER:' || count(*) end as result
from public.dp3a_cases
where is_fixture;
