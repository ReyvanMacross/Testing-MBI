-- Audit read-only untuk migration Disdik 001 sampai 003.

with expected_tables(table_name) as (
  values
    ('disdik_sekolah'),
    ('disdik_program_details'),
    ('disdik_interventions'),
    ('disdik_intervention_events'),
    ('disdik_realisasi_bantuan')
)
select 'TABLE' as section, expected.table_name as object_name,
  case when actual.table_name is null then 'MISSING' else 'PASS' end as result
from expected_tables expected
left join information_schema.tables actual
  on actual.table_schema = 'public' and actual.table_name = expected.table_name
order by expected.table_name;

with expected_columns(table_name, column_name) as (
  values
    ('disdik_sekolah', 'kode'), ('disdik_sekolah', 'jenjang'), ('disdik_sekolah', 'is_active'),
    ('disdik_program_details', 'program_id'), ('disdik_program_details', 'sekolah_id'),
    ('disdik_program_details', 'budget_per_student'), ('disdik_program_details', 'capacity'),
    ('disdik_interventions', 'referral_id'), ('disdik_interventions', 'program_id'),
    ('disdik_interventions', 'sekolah_id'), ('disdik_interventions', 'aid_status'),
    ('disdik_interventions', 'document_status'), ('disdik_interventions', 'progress_percent'),
    ('disdik_interventions', 'planned_budget'), ('disdik_interventions', 'is_fixture'),
    ('disdik_intervention_events', 'intervention_id'), ('disdik_intervention_events', 'event_type'),
    ('disdik_realisasi_bantuan', 'intervention_id'), ('disdik_realisasi_bantuan', 'realized_amount'),
    ('disdik_realisasi_bantuan', 'disbursement_date')
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
    ('disdik_actor_allowed'),
    ('disdik_start_intervention'),
    ('disdik_update_intervention_progress'),
    ('disdik_complete_intervention'),
    ('disdik_create_program'),
    ('disdik_validate_domain_integrity')
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
where schemaname = 'public' and tablename like 'disdik\_%' escape '\'
order by tablename;

with expected_tables(table_name) as (
  values
    ('disdik_sekolah'), ('disdik_program_details'), ('disdik_interventions'),
    ('disdik_intervention_events'), ('disdik_realisasi_bantuan')
), exposed as (
  select table_name, count(*) as grant_count
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in ('anon', 'authenticated')
    and table_name like 'disdik\_%' escape '\'
  group by table_name
)
select 'DIRECT_ACCESS' as section, expected.table_name as object_name,
  case when coalesce(exposed.grant_count, 0) = 0 then 'PASS' else 'BLOCKER:' || exposed.grant_count end as result
from expected_tables expected
left join exposed using (table_name)
order by expected.table_name;

with expected_functions(routine_name) as (
  values
    ('disdik_actor_allowed'),
    ('disdik_start_intervention'),
    ('disdik_update_intervention_progress'),
    ('disdik_complete_intervention'),
    ('disdik_create_program')
), privilege_state as (
  select p.proname as routine_name,
    has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
    has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'disdik\_%' escape '\'
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

with disdik_opd as (
  select id from public.master_opd where kode_opd = 'DISDIK'
), integrity_checks(check_name, violating_rows) as (
  select 'INVALID_PROGRAM_RELATION', count(*)
  from public.disdik_program_details details
  left join public.master_program_layanan program on program.id = details.program_id
  left join public.disdik_sekolah school on school.id = details.sekolah_id
  where program.id is null
     or program.opd_id is distinct from (select id from disdik_opd)
     or program.jalur is distinct from 'PENGUATAN_DASAR'
     or school.id is null
  union all
  select 'INVALID_INTERVENTION_RELATION', count(*)
  from public.disdik_interventions intervention
  left join public.referral_mbi referral on referral.id = intervention.referral_id
  left join public.master_program_layanan program on program.id = intervention.program_id
  left join public.disdik_program_details details on details.program_id = intervention.program_id
  where referral.id is null
     or referral.target_opd_id is distinct from (select id from disdik_opd)
     or referral.referral_type is distinct from 'JALUR_MBI'
     or referral.jalur is distinct from 'PENGUATAN_DASAR'
     or referral.program_id is distinct from intervention.program_id
     or program.opd_id is distinct from (select id from disdik_opd)
     or program.jalur is distinct from 'PENGUATAN_DASAR'
     or details.program_id is null
     or intervention.sekolah_id is distinct from details.sekolah_id
  union all
  select 'PROCESSED_REFERRAL_WITHOUT_INTERVENTION', count(*)
  from public.referral_mbi referral
  where referral.target_opd_id = (select id from disdik_opd)
    and referral.referral_type = 'JALUR_MBI'
    and referral.jalur = 'PENGUATAN_DASAR'
    and referral.status in ('DIPROSES', 'SELESAI')
    and not exists (
      select 1 from public.disdik_interventions intervention where intervention.referral_id = referral.id
    )
  union all
  select 'QUOTA_OVERFLOW', count(*) from (
    select details.program_id
    from public.disdik_program_details details
    left join public.disdik_interventions intervention
      on intervention.program_id = details.program_id and intervention.aid_status <> 'TIDAK_AKTIF'
    group by details.program_id, details.capacity
    having count(intervention.id) > details.capacity
  ) overflow
  union all
  select 'REALIZATION_BEFORE_START', count(*)
  from public.disdik_realisasi_bantuan realization
  join public.disdik_interventions intervention on intervention.id = realization.intervention_id
  where realization.disbursement_date < intervention.start_date
  union all
  select 'REALIZATION_OVER_BUDGET', count(*)
  from public.disdik_realisasi_bantuan realization
  join public.disdik_interventions intervention on intervention.id = realization.intervention_id
  where realization.realized_amount > intervention.planned_budget
  union all
  select 'INTERVENTION_WITHOUT_STARTED_EVENT', count(*)
  from public.disdik_interventions intervention
  where not exists (
    select 1 from public.disdik_intervention_events event
    where event.intervention_id = intervention.id and event.event_type = 'STARTED'
  )
  union all
  select 'COMPLETED_WITHOUT_REALIZATION', count(*)
  from public.disdik_interventions intervention
  where intervention.aid_status = 'SELESAI'
    and not exists (
      select 1 from public.disdik_realisasi_bantuan realization where realization.intervention_id = intervention.id
    )
  union all
  select 'COMPLETED_STATE_MISMATCH', count(*)
  from public.disdik_interventions intervention
  where intervention.aid_status = 'SELESAI'
    and (intervention.progress_percent <> 100 or intervention.document_status <> 'LULUS')
  union all
  select 'COMPLETED_REFERRAL_MISMATCH', count(*)
  from public.referral_mbi referral
  join public.disdik_interventions intervention on intervention.referral_id = referral.id
  where referral.target_opd_id = (select id from disdik_opd)
    and referral.jalur = 'PENGUATAN_DASAR'
    and referral.status = 'SELESAI'
    and intervention.aid_status <> 'SELESAI'
  union all
  select 'COMPLETED_INTERVENTION_REFERRAL_MISMATCH', count(*)
  from public.disdik_interventions intervention
  join public.referral_mbi referral on referral.id = intervention.referral_id
  where intervention.aid_status = 'SELESAI' and referral.status <> 'SELESAI'
  union all
  select 'COMPLETED_WITHOUT_EVENT', count(*)
  from public.disdik_interventions intervention
  where intervention.aid_status = 'SELESAI'
    and not exists (
      select 1 from public.disdik_intervention_events event
      where event.intervention_id = intervention.id and event.event_type = 'COMPLETED'
    )
  union all
  select 'DUPLICATE_INTERVENTION', count(*) from (
    select referral_id from public.disdik_interventions group by referral_id having count(*) > 1
  ) duplicate
  union all
  select 'DUPLICATE_REALIZATION', count(*) from (
    select intervention_id from public.disdik_realisasi_bantuan group by intervention_id having count(*) > 1
  ) duplicate
  union all
  select 'DUPLICATE_LIFECYCLE_EVENT', count(*) from (
    select intervention_id, event_type from public.disdik_intervention_events
    where event_type in ('STARTED', 'COMPLETED', 'CANCELLED')
    group by intervention_id, event_type having count(*) > 1
  ) duplicate
  union all
  select 'ORPHAN_EVENT', count(*)
  from public.disdik_intervention_events event
  left join public.disdik_interventions intervention on intervention.id = event.intervention_id
  where intervention.id is null
)
select 'INTEGRITY' as section, check_name as object_name,
  case when violating_rows = 0 then 'PASS' else 'BLOCKER:' || violating_rows end as result
from integrity_checks
order by check_name;

select 'FIXTURE' as section, 'disdik_interventions' as object_name,
  case when count(*) = 0 then 'PASS' else 'BLOCKER:' || count(*) end as result
from public.disdik_interventions
where is_fixture;
