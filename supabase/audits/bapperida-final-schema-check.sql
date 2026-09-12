-- Read-only audit for BAPPERIDA coordination MVP.

with expected(table_name) as (values
  ('bapperida_indicator_targets'), ('bapperida_evaluation_snapshots'),
  ('bapperida_recommendations'), ('bapperida_recommendation_recipients'),
  ('bapperida_recommendation_events')
)
select 'TABLE' section, expected.table_name object_name,
  case when actual.table_name is null then 'MISSING' else 'PASS' end result
from expected left join information_schema.tables actual
  on actual.table_schema='public' and actual.table_name=expected.table_name order by expected.table_name;

with expected(routine_name) as (values
  ('bapperida_actor_allowed'), ('bapperida_save_recommendation'),
  ('bapperida_submit_recommendation'), ('bapperida_publish_evaluation_snapshot')
)
select 'FUNCTION' section, expected.routine_name object_name,
  case when actual.routine_name is null then 'MISSING' else 'PASS' end result
from expected left join information_schema.routines actual
  on actual.routine_schema='public' and actual.routine_name=expected.routine_name order by expected.routine_name;

select 'VIEW' section, 'bapperida_v_cross_opd_outcomes' object_name,
  case when to_regclass('public.bapperida_v_cross_opd_outcomes') is null then 'MISSING' else 'PASS' end result;

select 'RLS' section, tablename object_name, case when rowsecurity then 'PASS' else 'BLOCKER' end result
from pg_tables where schemaname='public' and tablename in (
  'bapperida_indicator_targets','bapperida_evaluation_snapshots','bapperida_recommendations',
  'bapperida_recommendation_recipients','bapperida_recommendation_events'
) order by tablename;

with expected(table_name) as (values
  ('bapperida_indicator_targets'), ('bapperida_evaluation_snapshots'),
  ('bapperida_recommendations'), ('bapperida_recommendation_recipients'),
  ('bapperida_recommendation_events'), ('bapperida_v_cross_opd_outcomes')
), exposed as (
  select table_name, count(*) grant_count from information_schema.role_table_grants
  where table_schema='public' and grantee in ('anon','authenticated') and table_name like 'bapperida\_%' escape '\'
  group by table_name
)
select 'DIRECT_ACCESS' section, expected.table_name object_name,
  case when coalesce(exposed.grant_count,0)=0 then 'PASS' else 'BLOCKER:'||exposed.grant_count end result
from expected left join exposed using(table_name) order by expected.table_name;

with bapperida_opd as (select id from public.master_opd where kode_opd='BAPPERIDA'), checks(check_name, violations) as (
  select 'MISSING_CANONICAL_OPD', count(*) from bapperida_opd having count(*) <> 1
  union all select 'RECIPIENT_IS_BAPPERIDA', count(*) from public.bapperida_recommendation_recipients where opd_id=(select id from bapperida_opd)
  union all select 'SUBMITTED_WITHOUT_RECIPIENT', count(*) from public.bapperida_recommendations recommendation
    where recommendation.status <> 'DRAFT' and not exists (select 1 from public.bapperida_recommendation_recipients recipient where recipient.recommendation_id=recommendation.id)
  union all select 'EVENT_VERSION_AHEAD', count(*) from public.bapperida_recommendation_events event
    join public.bapperida_recommendations recommendation on recommendation.id=event.recommendation_id where event.version > recommendation.version
  union all select 'PUBLISHED_WITHOUT_TIMESTAMP', count(*) from public.bapperida_evaluation_snapshots where status='PUBLISHED' and published_at is null
  union all select 'OUTCOME_VIEW_UNKNOWN_OPD', count(*) from public.bapperida_v_cross_opd_outcomes where target_opd_id is not null and kode_opd is null
)
select 'INTEGRITY' section, check_name object_name, case when violations=0 then 'PASS' else 'BLOCKER:'||violations end result from checks order by check_name;

select 'FIXTURE' section, object_name, case when row_count=0 then 'PASS' else 'BLOCKER:'||row_count end result from (
  select 'bapperida_recommendations' object_name, count(*) row_count from public.bapperida_recommendations where is_fixture
  union all select 'bapperida_evaluation_snapshots', count(*) from public.bapperida_evaluation_snapshots where is_fixture
) fixture;
