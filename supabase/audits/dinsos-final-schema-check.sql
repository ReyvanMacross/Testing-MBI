-- Read-only hosted schema audit for Tahap 14E.
-- Run this file in the Supabase SQL Editor after migration 202609080001.

with expected_tables(table_name) as (
  values
    ('dinsos_cases'), ('dinsos_asesmen_sosial'), ('dinsos_case_results'),
    ('dinsos_desil_overrides'), ('dinsos_case_events'),
    ('dinsos_assessment_types'), ('dinsos_assessments'),
    ('dinsos_assessment_reviews'), ('penentuan_jalur'),
    ('dinsos_path_overrides'), ('referral_mbi'),
    ('referral_mbi_events'), ('master_program_layanan'),
    ('user_capabilities')
)
select
  'TABLE' as section,
  expected.table_name as object_name,
  case when actual.table_name is null then 'MISSING' else 'PASS' end as result
from expected_tables expected
left join information_schema.tables actual
  on actual.table_schema = 'public'
 and actual.table_name = expected.table_name
order by expected.table_name;

with expected_columns(table_name, column_name) as (
  values
    ('penentuan_jalur', 'assessment_id'),
    ('penentuan_jalur', 'case_id'),
    ('penentuan_jalur', 'target_opd_id'),
    ('penentuan_jalur', 'finalized_by'),
    ('penentuan_jalur', 'finalized_at'),
    ('penentuan_jalur', 'approved_path_snapshot'),
    ('referral_mbi', 'path_decision_id'),
    ('referral_mbi', 'assessment_id'),
    ('referral_mbi', 'program_id'),
    ('referral_mbi', 'referral_date'),
    ('referral_mbi', 'received_at'),
    ('referral_mbi', 'processing_started_at'),
    ('referral_mbi', 'completed_at'),
    ('referral_mbi', 'metadata'),
    ('referral_mbi_events', 'event_type'),
    ('referral_mbi_events', 'event_at'),
    ('referral_mbi_events', 'metadata')
)
select
  'COLUMN' as section,
  expected.table_name || '.' || expected.column_name as object_name,
  case when actual.column_name is null then 'MISSING' else 'PASS' end as result
from expected_columns expected
left join information_schema.columns actual
  on actual.table_schema = 'public'
 and actual.table_name = expected.table_name
 and actual.column_name = expected.column_name
order by expected.table_name, expected.column_name;

with expected_constraints(constraint_name) as (
  values
    ('referral_mbi_jalur_lifecycle_check'),
    ('referral_mbi_received_timestamp_check'),
    ('referral_mbi_processing_timestamp_check'),
    ('referral_mbi_completed_timestamp_check'),
    ('referral_mbi_timestamp_order_check')
)
select
  'CONSTRAINT' as section,
  expected.constraint_name as object_name,
  case when actual.conname is null then 'MISSING' else 'PASS' end as result
from expected_constraints expected
left join pg_constraint actual
  on actual.conname = expected.constraint_name
 and actual.conrelid = 'public.referral_mbi'::regclass
order by expected.constraint_name;

select
  'INDEX' as section,
  'uq_referral_single_transition_event' as object_name,
  case when indexname is null then 'MISSING' else 'PASS' end as result
from (values (1)) seed(value)
left join pg_indexes
  on schemaname = 'public'
 and tablename = 'referral_mbi_events'
 and indexname = 'uq_referral_single_transition_event';

select
  'RPC' as section,
  routine.routine_name as object_name,
  routine.security_type || case
    when coalesce(array_to_string(proc.proconfig, ','), '') like '%search_path=public%'
      then ' / SEARCH_PATH_PASS'
    else ' / SEARCH_PATH_MISSING'
  end as result
from information_schema.routines routine
join pg_proc proc on proc.proname = routine.routine_name
join pg_namespace namespace on namespace.oid = proc.pronamespace
 and namespace.nspname = routine.routine_schema
where routine.routine_schema = 'public'
  and (
    routine.routine_name like 'dinsos_%'
    or routine.routine_name like 'list_dinsos_%'
    or routine.routine_name = 'transition_referral_status'
  )
order by routine.routine_name;

select
  'RPC_PRIVILEGE' as section,
  routine_name || ':' || grantee as object_name,
  privilege_type as result
from information_schema.routine_privileges
where routine_schema = 'public'
  and (
    routine_name like 'dinsos_%'
    or routine_name like 'list_dinsos_%'
    or routine_name = 'transition_referral_status'
  )
order by routine_name, grantee;

with expected_tables(table_name) as (
  values
    ('dinsos_cases'), ('dinsos_asesmen_sosial'), ('dinsos_case_results'),
    ('dinsos_desil_overrides'), ('dinsos_case_events'),
    ('dinsos_assessment_types'), ('dinsos_assessments'),
    ('dinsos_assessment_reviews'), ('penentuan_jalur'),
    ('dinsos_path_overrides'), ('referral_mbi'),
    ('referral_mbi_events'), ('master_program_layanan'),
    ('user_capabilities')
)
select
  'RLS' as section,
  expected.table_name as object_name,
  case when class.relrowsecurity then 'PASS' else 'DISABLED' end as result
from expected_tables expected
join pg_class class on class.relname = expected.table_name
join pg_namespace namespace on namespace.oid = class.relnamespace
 and namespace.nspname = 'public'
order by expected.table_name;

select
  'TABLE_PRIVILEGE' as section,
  table_name || ':' || grantee as object_name,
  string_agg(privilege_type, ',' order by privilege_type) as result
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'dinsos_cases', 'dinsos_asesmen_sosial', 'dinsos_case_results',
    'dinsos_desil_overrides', 'dinsos_case_events',
    'dinsos_assessment_types', 'dinsos_assessments',
    'dinsos_assessment_reviews', 'penentuan_jalur',
    'dinsos_path_overrides', 'referral_mbi',
    'referral_mbi_events', 'master_program_layanan',
    'user_capabilities'
  )
group by table_name, grantee
order by table_name, grantee;
