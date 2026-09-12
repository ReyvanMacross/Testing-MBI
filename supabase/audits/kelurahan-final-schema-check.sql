with required_tables(name) as (values
  ('kelurahan_usulan'),('kelurahan_surveys'),('kelurahan_documents'),('kelurahan_events'),('kelurahan_helpdesk_tickets')
), checks as (
  select case when to_regclass('public.'||name) is null then 'MISSING_TABLE_'||upper(name) else 'PASS_TABLE_'||upper(name) end result from required_tables
), required_columns(table_name,column_name) as (values
  ('kelurahan_usulan','warga_id'),('kelurahan_usulan','kelurahan_id'),('kelurahan_usulan','kecamatan_id'),
  ('kelurahan_usulan','target_program_id'),('kelurahan_usulan','kecamatan_usulan_id'),('kelurahan_usulan','version'),
  ('kelurahan_surveys','usulan_id'),('kelurahan_surveys','factual_desil'),('kelurahan_documents','usulan_id'),
  ('kelurahan_events','actor_user_id'),('kelurahan_helpdesk_tickets','kelurahan_id')
), column_checks as (
  select case when exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=r.table_name and c.column_name=r.column_name)
    then 'PASS_COLUMN_'||upper(r.table_name)||'_'||upper(r.column_name) else 'MISSING_COLUMN_'||upper(r.table_name)||'_'||upper(r.column_name) end result from required_columns r
), required_routines(name) as (values
  ('kelurahan_actor_allowed'),('kelurahan_validate_jurisdiction'),('kelurahan_create_proposal'),
  ('kelurahan_assign_survey'),('kelurahan_complete_survey'),('kelurahan_send_to_kecamatan'),
  ('kelurahan_create_helpdesk_ticket'),('kelurahan_validate_domain_integrity')
), routine_checks as (
  select case when exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=r.name)
    then 'PASS_RPC_'||upper(r.name) else 'MISSING_RPC_'||upper(r.name) end result from required_routines r
), rls_checks as (
  select case when c.relrowsecurity then 'PASS_RLS_'||upper(c.relname) else 'DISABLED_RLS_'||upper(c.relname) end result
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in
    ('kelurahan_usulan','kelurahan_surveys','kelurahan_documents','kelurahan_events','kelurahan_helpdesk_tickets')
), privilege_check as (
  select case when exists(select 1 from information_schema.role_table_grants where table_schema='public' and table_name like 'kelurahan_%' and grantee in ('anon','authenticated'))
    then 'SECURITY_MODE_MISMATCH_KELURAHAN_TABLE_GRANT' else 'PASS_NO_CLIENT_TABLE_GRANT' end result
), integrity as (select public.kelurahan_validate_domain_integrity() value), integrity_checks as (
  select case when (value->>'scopeMismatch')::int=0 then 'PASS_SCOPE_INTEGRITY' else 'BLOCKER_SCOPE_MISMATCH' end result from integrity union all
  select case when (value->>'missingCreatedEvent')::int=0 then 'PASS_EVENT_INTEGRITY' else 'BLOCKER_MISSING_EVENT' end from integrity union all
  select case when (value->>'sentWithoutKecamatan')::int=0 then 'PASS_HANDOFF_INTEGRITY' else 'BLOCKER_HANDOFF_INTEGRITY' end from integrity union all
  select case when (value->>'readyWithoutSurvey')::int=0 then 'PASS_SURVEY_INTEGRITY' else 'BLOCKER_SURVEY_INTEGRITY' end from integrity
)
select result from checks union all select result from column_checks union all select result from routine_checks
union all select result from rls_checks union all select result from privilege_check union all select result from integrity_checks;
