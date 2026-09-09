-- Read-only hosted schema audit for Diskop UKM migrations 005 through 007.

with expected_tables(table_name) as (
  values ('diskop_pendamping'), ('diskop_program_details'), ('diskop_interventions'),
    ('diskop_intervention_events'), ('diskop_kemandirian_usaha'), ('diskop_laporan_omzet')
)
select 'TABLE' as section, expected.table_name as object_name,
  case when actual.table_name is null then 'MISSING' else 'PASS' end as result
from expected_tables expected
left join information_schema.tables actual
  on actual.table_schema = 'public' and actual.table_name = expected.table_name
order by expected.table_name;

with expected_columns(table_name, column_name) as (
  values
    ('diskop_pendamping', 'kode'), ('diskop_pendamping', 'is_active'),
    ('diskop_program_details', 'program_id'), ('diskop_program_details', 'pendamping_id'), ('diskop_program_details', 'capacity'),
    ('diskop_interventions', 'referral_id'), ('diskop_interventions', 'program_id'), ('diskop_interventions', 'participant_status'),
    ('diskop_interventions', 'progress_percent'), ('diskop_interventions', 'legal_status'), ('diskop_interventions', 'is_fixture'),
    ('diskop_intervention_events', 'intervention_id'), ('diskop_intervention_events', 'event_type'),
    ('diskop_kemandirian_usaha', 'intervention_id'), ('diskop_kemandirian_usaha', 'nib'), ('diskop_kemandirian_usaha', 'omzet_bulanan'),
    ('diskop_laporan_omzet', 'intervention_id'), ('diskop_laporan_omzet', 'periode'), ('diskop_laporan_omzet', 'nominal')
)
select 'COLUMN' as section, expected.table_name || '.' || expected.column_name as object_name,
  case when actual.column_name is null then 'MISSING' else 'PASS' end as result
from expected_columns expected
left join information_schema.columns actual
  on actual.table_schema = 'public' and actual.table_name = expected.table_name and actual.column_name = expected.column_name
order by expected.table_name, expected.column_name;

with expected_routines(routine_name, security_definer) as (
  values ('diskop_actor_allowed', true), ('diskop_start_intervention', true),
    ('diskop_update_intervention_progress', true), ('diskop_complete_intervention', true),
    ('diskop_create_program', true), ('diskop_validate_domain_integrity', false)
)
select 'RPC' as section, expected.routine_name as object_name,
  case when proc.oid is null then 'MISSING'
    when proc.prosecdef is distinct from expected.security_definer then 'SECURITY_MODE_MISMATCH'
    when expected.security_definer and coalesce(array_to_string(proc.proconfig, ','), '') not like '%search_path=public%' then 'SEARCH_PATH_MISSING'
    else 'PASS' end as result
from expected_routines expected
left join pg_proc proc on proc.proname = expected.routine_name
left join pg_namespace namespace on namespace.oid = proc.pronamespace and namespace.nspname = 'public'
where proc.oid is null or namespace.oid is not null
order by expected.routine_name;

with expected_triggers(trigger_name) as (
  values ('trg_diskop_integrity_intervention'), ('trg_diskop_integrity_business'),
    ('trg_diskop_integrity_program_details'), ('trg_diskop_integrity_master_program'), ('trg_diskop_integrity_referral')
)
select 'TRIGGER' as section, expected.trigger_name as object_name,
  case when actual.tgname is null then 'MISSING' else 'PASS' end as result
from expected_triggers expected
left join pg_trigger actual on actual.tgname = expected.trigger_name and not actual.tgisinternal
order by expected.trigger_name;

with expected_tables(table_name) as (
  values ('diskop_pendamping'), ('diskop_program_details'), ('diskop_interventions'),
    ('diskop_intervention_events'), ('diskop_kemandirian_usaha'), ('diskop_laporan_omzet')
)
select 'RLS' as section, expected.table_name as object_name,
  case when class.oid is null then 'MISSING' when class.relrowsecurity then 'PASS' else 'DISABLED' end as result
from expected_tables expected
left join pg_class class on class.relname = expected.table_name
left join pg_namespace namespace on namespace.oid = class.relnamespace and namespace.nspname = 'public'
where class.oid is null or namespace.oid is not null
order by expected.table_name;

select 'RPC_PRIVILEGE' as section, routine_name || ':' || grantee as object_name, privilege_type as result
from information_schema.routine_privileges
where routine_schema = 'public' and routine_name like 'diskop_%'
order by routine_name, grantee;

select 'TABLE_PRIVILEGE' as section, table_name || ':' || grantee as object_name,
  string_agg(privilege_type, ',' order by privilege_type) as result
from information_schema.role_table_grants
where table_schema = 'public' and table_name like 'diskop_%'
group by table_name, grantee
order by table_name, grantee;
