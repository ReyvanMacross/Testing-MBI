-- Read-only audit for the WALIKOTA executive layer.

with expected(table_name) as (values
  ('walikota_decisions'), ('walikota_dispositions'), ('walikota_decision_events')
)
select 'TABLE' section, expected.table_name object_name,
  case when actual.table_name is null then 'MISSING' else 'PASS' end result
from expected left join information_schema.tables actual
  on actual.table_schema='public' and actual.table_name=expected.table_name order by expected.table_name;

with expected(routine_name) as (values ('walikota_actor_allowed'), ('walikota_review_recommendation'))
select 'FUNCTION' section, expected.routine_name object_name,
  case when actual.routine_name is null then 'MISSING' else 'PASS' end result
from expected left join information_schema.routines actual
  on actual.routine_schema='public' and actual.routine_name=expected.routine_name order by expected.routine_name;

select 'VIEW' section, 'walikota_v_executive_outcomes' object_name,
  case when to_regclass('public.walikota_v_executive_outcomes') is null then 'MISSING' else 'PASS' end result;

select 'RLS' section, tablename object_name, case when rowsecurity then 'PASS' else 'BLOCKER' end result
from pg_tables where schemaname='public' and tablename in (
  'walikota_decisions','walikota_dispositions','walikota_decision_events'
) order by tablename;

with expected(table_name) as (values
  ('walikota_decisions'), ('walikota_dispositions'), ('walikota_decision_events'),
  ('walikota_v_executive_outcomes')
), exposed as (
  select table_name, count(*) grant_count from information_schema.role_table_grants
  where table_schema='public' and grantee in ('anon','authenticated') and table_name like 'walikota\_%' escape '\'
  group by table_name
)
select 'DIRECT_ACCESS' section, expected.table_name object_name,
  case when coalesce(exposed.grant_count,0)=0 then 'PASS' else 'BLOCKER:'||exposed.grant_count end result
from expected left join exposed using(table_name) order by expected.table_name;

with walikota_opd as (select id from public.master_opd where kode_opd='WALIKOTA'), checks(check_name, violations) as (
  select 'MISSING_CANONICAL_OPD', count(*) from walikota_opd having count(*) <> 1
  union all select 'NON_EXECUTIVE_WALIKOTA_PROFILE', count(*) from public.user_profiles
    where opd_id=(select id from walikota_opd) and role <> 'WALIKOTA'
  union all select 'DECISION_WITHOUT_BAPPERIDA_SOURCE', count(*) from public.walikota_decisions decision
    left join public.bapperida_recommendations recommendation on recommendation.id=decision.recommendation_id where recommendation.id is null
  union all select 'DECISION_VERSION_AHEAD', count(*) from public.walikota_decisions decision
    join public.bapperida_recommendations recommendation on recommendation.id=decision.recommendation_id
    where decision.recommendation_version > recommendation.version
  union all select 'FORBIDDEN_DISPOSITION_TARGET', count(*) from public.walikota_dispositions disposition
    join public.master_opd opd on opd.id=disposition.target_opd_id where opd.kode_opd in ('BAPPERIDA','WALIKOTA')
  union all select 'EVENT_VERSION_AHEAD', count(*) from public.walikota_decision_events event
    join public.bapperida_recommendations recommendation on recommendation.id=event.recommendation_id
    where event.recommendation_version > recommendation.version
)
select 'INTEGRITY' section, check_name object_name,
  case when violations=0 then 'PASS' else 'BLOCKER:'||violations end result from checks order by check_name;

select 'FIXTURE' section, 'walikota_decisions' object_name,
  case when count(*)=0 then 'PASS' else 'BLOCKER:'||count(*) end result
from public.walikota_decisions where is_fixture;
