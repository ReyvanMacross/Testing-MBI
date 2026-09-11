-- Audit read-only schema dan integritas final modul Kecamatan.

with expected_tables(table_name) as (
  values ('kecamatan_warga_usulan'), ('kecamatan_survei'), ('kecamatan_documents'),
    ('kecamatan_referral_details'), ('kecamatan_events'), ('kecamatan_helpdesk_tickets')
)
select 'TABLE' as section, expected.table_name as object_name,
  case when actual.table_name is null then 'MISSING' else 'PASS' end as result
from expected_tables expected left join information_schema.tables actual
  on actual.table_schema = 'public' and actual.table_name = expected.table_name
order by expected.table_name;

with expected_columns(table_name, column_name) as (
  values
    ('kecamatan_warga_usulan','warga_id'), ('kecamatan_warga_usulan','kecamatan_id'),
    ('kecamatan_warga_usulan','kelurahan_id'), ('kecamatan_warga_usulan','target_program_id'),
    ('kecamatan_warga_usulan','status'), ('kecamatan_warga_usulan','is_fixture'),
    ('kecamatan_survei','usulan_id'), ('kecamatan_survei','status'),
    ('kecamatan_survei','skor'), ('kecamatan_survei','desil_faktual'),
    ('kecamatan_referral_details','referral_id'), ('kecamatan_referral_details','usulan_id'),
    ('kecamatan_referral_details','kecamatan_id'), ('kecamatan_referral_details','is_fixture'),
    ('kecamatan_helpdesk_tickets','ticket_code'), ('kecamatan_helpdesk_tickets','kecamatan_id')
)
select 'COLUMN' as section, expected.table_name || '.' || expected.column_name as object_name,
  case when actual.column_name is null then 'MISSING' else 'PASS' end as result
from expected_columns expected left join information_schema.columns actual
  on actual.table_schema = 'public' and actual.table_name = expected.table_name
  and actual.column_name = expected.column_name
order by expected.table_name, expected.column_name;

with expected_functions(routine_name) as (
  values ('kecamatan_actor_allowed'), ('kecamatan_validate_jurisdiction'),
    ('kecamatan_create_proposal'), ('kecamatan_assign_survey'), ('kecamatan_submit_survey'),
    ('kecamatan_review_survey'), ('kecamatan_send_referral'),
    ('kecamatan_create_helpdesk_ticket'), ('kecamatan_validate_domain_integrity')
)
select 'FUNCTION' as section, expected.routine_name as object_name,
  case when actual.routine_name is null then 'MISSING' else 'PASS' end as result
from expected_functions expected left join information_schema.routines actual
  on actual.routine_schema = 'public' and actual.routine_name = expected.routine_name
order by expected.routine_name;

select 'RLS' as section, tablename as object_name,
  case when rowsecurity then 'PASS' else 'BLOCKER' end as result
from pg_tables where schemaname = 'public' and tablename like 'kecamatan\_%' escape '\'
order by tablename;

with expected_tables(table_name) as (
  values ('kecamatan_warga_usulan'), ('kecamatan_survei'), ('kecamatan_documents'),
    ('kecamatan_referral_details'), ('kecamatan_events'), ('kecamatan_helpdesk_tickets')
), exposed as (
  select table_name, count(*) grant_count from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon','authenticated')
    and table_name like 'kecamatan\_%' escape '\' group by table_name
)
select 'DIRECT_ACCESS' as section, expected.table_name as object_name,
  case when coalesce(exposed.grant_count,0)=0 then 'PASS' else 'BLOCKER:' || exposed.grant_count end as result
from expected_tables expected left join exposed using(table_name) order by expected.table_name;

with privilege_state as (
  select p.proname routine_name,
    has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
    has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,
    has_function_privilege('service_role',p.oid,'EXECUTE') service_execute
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'kecamatan\_%' escape '\'
)
select 'RPC_PRIVILEGE' section, routine_name object_name,
  case when anon_execute or authenticated_execute then 'BLOCKER:CLIENT_EXECUTE'
    when not service_execute then 'BLOCKER:SERVICE_ROLE_DENIED' else 'PASS' end result
from privilege_state order by routine_name;

with integrity_checks(check_name, violating_rows) as (
  select 'INVALID_PROPOSAL_JURISDICTION', count(*)
  from public.kecamatan_warga_usulan proposal
  join public.warga warga on warga.id=proposal.warga_id
  left join public.master_wilayah kelurahan on kelurahan.id=proposal.kelurahan_id
  where warga.kecamatan_id is distinct from proposal.kecamatan_id
    or warga.kelurahan_id is distinct from proposal.kelurahan_id
    or kelurahan.parent_id is distinct from proposal.kecamatan_id
  union all
  select 'PROPOSAL_WITHOUT_CREATED_EVENT', count(*) from public.kecamatan_warga_usulan proposal
  where not exists(select 1 from public.kecamatan_events event where event.usulan_id=proposal.id and event.event_type='PROPOSAL_CREATED')
  union all
  select 'APPROVED_SURVEY_INCOMPLETE', count(*) from public.kecamatan_survei
  where status='DISETUJUI' and (skor is null or desil_faktual is null or reviewed_at is null)
  union all
  select 'REFERRED_WITHOUT_DETAIL', count(*) from public.kecamatan_warga_usulan proposal
  where status='DIRUJUK' and not exists(select 1 from public.kecamatan_referral_details detail where detail.usulan_id=proposal.id)
  union all
  select 'DUPLICATE_REFERRAL', count(*) from (
    select usulan_id from public.kecamatan_referral_details group by usulan_id having count(*)>1
  ) duplicate
  union all
  select 'ORPHAN_LINEAGE', count(*) from public.kecamatan_referral_details detail
  left join public.kecamatan_warga_usulan proposal on proposal.id=detail.usulan_id
  left join public.kecamatan_survei survey on survey.id=detail.survei_id
  left join public.referral_mbi referral on referral.id=detail.referral_id
  where proposal.id is null or survey.id is null or referral.id is null
)
select 'INTEGRITY' section, check_name object_name,
  case when violating_rows=0 then 'PASS' else 'BLOCKER:' || violating_rows end result
from integrity_checks order by check_name;

select 'FIXTURE' section, 'kecamatan_domain' object_name,
  case when total=0 then 'PASS' else 'BLOCKER:' || total end result
from (
  select (select count(*) from public.kecamatan_warga_usulan where is_fixture)
    + (select count(*) from public.kecamatan_survei where is_fixture)
    + (select count(*) from public.kecamatan_documents where is_fixture)
    + (select count(*) from public.kecamatan_referral_details where is_fixture)
    + (select count(*) from public.kecamatan_helpdesk_tickets where is_fixture) total
) fixture;
