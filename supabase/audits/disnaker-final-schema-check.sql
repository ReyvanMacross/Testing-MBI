-- Read-only hosted schema audit for Tahap 15B.
-- Run after migrations 202609090001 through 202609090004.

with expected_tables(table_name) as (
  values
    ('disnaker_program_details'),
    ('disnaker_interventions'),
    ('disnaker_intervention_events'),
    ('disnaker_lembaga_pelaksana'),
    ('disnaker_mitra_industri'),
    ('disnaker_penempatan_kerja')
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
    ('disnaker_program_details', 'program_id'),
    ('disnaker_program_details', 'lembaga_id'),
    ('disnaker_program_details', 'capacity'),
    ('disnaker_interventions', 'referral_id'),
    ('disnaker_interventions', 'program_id'),
    ('disnaker_interventions', 'lembaga_id'),
    ('disnaker_interventions', 'participant_status'),
    ('disnaker_interventions', 'attendance_percent'),
    ('disnaker_interventions', 'is_fixture'),
    ('disnaker_intervention_events', 'intervention_id'),
    ('disnaker_intervention_events', 'event_type'),
    ('disnaker_intervention_events', 'event_at'),
    ('disnaker_lembaga_pelaksana', 'kode'),
    ('disnaker_lembaga_pelaksana', 'jenis'),
    ('disnaker_mitra_industri', 'kode_mitra'),
    ('disnaker_mitra_industri', 'status_kemitraan'),
    ('disnaker_penempatan_kerja', 'intervention_id'),
    ('disnaker_penempatan_kerja', 'mitra_industri_id'),
    ('disnaker_penempatan_kerja', 'tanggal_penempatan'),
    ('disnaker_penempatan_kerja', 'evaluasi_akhir')
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
    ('disnaker_program_duration_check'),
    ('disnaker_program_capacity_check'),
    ('disnaker_participant_status_check'),
    ('disnaker_attendance_check'),
    ('disnaker_lembaga_jenis_check'),
    ('disnaker_mitra_status_check'),
    ('disnaker_worker_status_check'),
    ('disnaker_penempatan_kerja_intervention_id_key'),
    ('disnaker_placement_evaluation_required_check')
)
select
  'CONSTRAINT' as section,
  expected.constraint_name as object_name,
  case when actual.conname is null then 'MISSING' else 'PASS' end as result
from expected_constraints expected
left join pg_constraint actual on actual.conname = expected.constraint_name
order by expected.constraint_name;

with expected_indexes(index_name) as (
  values
    ('idx_disnaker_interventions_program'),
    ('idx_disnaker_intervention_events_timeline'),
    ('uq_disnaker_single_lifecycle_event'),
    ('idx_disnaker_program_lembaga'),
    ('idx_disnaker_intervention_lembaga'),
    ('idx_disnaker_penempatan_mitra'),
    ('idx_disnaker_penempatan_date'),
    ('idx_disnaker_interventions_fixture')
)
select
  'INDEX' as section,
  expected.index_name as object_name,
  case when actual.indexname is null then 'MISSING' else 'PASS' end as result
from expected_indexes expected
left join pg_indexes actual
  on actual.schemaname = 'public'
 and actual.indexname = expected.index_name
order by expected.index_name;

with expected_routines(routine_name, security_definer) as (
  values
    ('disnaker_actor_allowed', true),
    ('disnaker_start_intervention', true),
    ('disnaker_update_intervention_progress', true),
    ('disnaker_complete_intervention', true),
    ('disnaker_create_program', true),
    ('disnaker_validate_domain_integrity', false),
    ('list_disnaker_placement_partners', true)
)
select
  'RPC' as section,
  expected.routine_name as object_name,
  case
    when proc.oid is null then 'MISSING'
    when proc.prosecdef is distinct from expected.security_definer then 'SECURITY_MODE_MISMATCH'
    when expected.security_definer
     and coalesce(array_to_string(proc.proconfig, ','), '') not like '%search_path=public%'
      then 'SEARCH_PATH_MISSING'
    else 'PASS'
  end as result
from expected_routines expected
left join pg_proc proc on proc.proname = expected.routine_name
left join pg_namespace namespace
  on namespace.oid = proc.pronamespace
 and namespace.nspname = 'public'
where proc.oid is null or namespace.oid is not null
order by expected.routine_name;

with expected_triggers(trigger_name) as (
  values
    ('trg_disnaker_integrity_intervention'),
    ('trg_disnaker_integrity_placement'),
    ('trg_disnaker_integrity_program_details'),
    ('trg_disnaker_integrity_master_program'),
    ('trg_disnaker_integrity_referral')
)
select
  'TRIGGER' as section,
  expected.trigger_name as object_name,
  case when actual.tgname is null then 'MISSING' else 'PASS' end as result
from expected_triggers expected
left join pg_trigger actual
  on actual.tgname = expected.trigger_name
 and not actual.tgisinternal
order by expected.trigger_name;

select
  'RPC_PRIVILEGE' as section,
  routine_name || ':' || grantee as object_name,
  privilege_type as result
from information_schema.routine_privileges
where routine_schema = 'public'
  and (
    routine_name like 'disnaker_%'
    or routine_name = 'list_disnaker_placement_partners'
  )
order by routine_name, grantee;

with expected_tables(table_name) as (
  values
    ('disnaker_program_details'),
    ('disnaker_interventions'),
    ('disnaker_intervention_events'),
    ('disnaker_lembaga_pelaksana'),
    ('disnaker_mitra_industri'),
    ('disnaker_penempatan_kerja')
)
select
  'RLS' as section,
  expected.table_name as object_name,
  case
    when class.oid is null then 'MISSING'
    when class.relrowsecurity then 'PASS'
    else 'DISABLED'
  end as result
from expected_tables expected
left join pg_class class on class.relname = expected.table_name
left join pg_namespace namespace
  on namespace.oid = class.relnamespace
 and namespace.nspname = 'public'
where class.oid is null or namespace.oid is not null
order by expected.table_name;

select
  'TABLE_PRIVILEGE' as section,
  table_name || ':' || grantee as object_name,
  string_agg(privilege_type, ',' order by privilege_type) as result
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'disnaker_program_details',
    'disnaker_interventions',
    'disnaker_intervention_events',
    'disnaker_lembaga_pelaksana',
    'disnaker_mitra_industri',
    'disnaker_penempatan_kerja'
  )
group by table_name, grantee
order by table_name, grantee;
