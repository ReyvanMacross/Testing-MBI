-- Read-only audit for the CiptaBintar MVP.

with expected_tables(table_name) as (
  values
    ('cipta_bintar_petugas'), ('cipta_bintar_beneficiary_profiles'),
    ('cipta_bintar_program_details'), ('cipta_bintar_interventions'),
    ('cipta_bintar_intervention_events'), ('cipta_bintar_realisasi_infrastruktur'),
    ('cipta_bintar_laporan_realisasi')
)
select 'TABLE' as section, expected.table_name as object_name,
  case when actual.table_name is null then 'MISSING' else 'PASS' end as result
from expected_tables expected
left join information_schema.tables actual
  on actual.table_schema = 'public' and actual.table_name = expected.table_name
order by expected.table_name;

with expected_functions(routine_name) as (
  values ('cipta_bintar_actor_allowed'), ('cipta_bintar_start_intervention'),
    ('cipta_bintar_update_intervention_progress'), ('cipta_bintar_complete_intervention'),
    ('cipta_bintar_create_program'), ('cipta_bintar_validate_domain_integrity')
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
where schemaname = 'public' and tablename like 'cipta\_bintar\_%' escape '\'
order by tablename;

with expected_tables(table_name) as (
  values ('cipta_bintar_petugas'), ('cipta_bintar_beneficiary_profiles'),
    ('cipta_bintar_program_details'), ('cipta_bintar_interventions'),
    ('cipta_bintar_intervention_events'), ('cipta_bintar_realisasi_infrastruktur'),
    ('cipta_bintar_laporan_realisasi')
), exposed as (
  select table_name, count(*) as grant_count
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'authenticated')
    and table_name like 'cipta\_bintar\_%' escape '\'
  group by table_name
)
select 'DIRECT_ACCESS' as section, expected.table_name as object_name,
  case when coalesce(exposed.grant_count, 0) = 0 then 'PASS' else 'BLOCKER:' || exposed.grant_count end as result
from expected_tables expected left join exposed using (table_name)
order by expected.table_name;

with cipta_bintar_opd as (select id from public.master_opd where kode_opd = 'CIPTA_BINTAR'),
integrity_checks(check_name, violating_rows) as (
  select 'INVALID_PROGRAM_RELATION', count(*)
  from public.cipta_bintar_program_details d
  left join public.master_program_layanan p on p.id = d.program_id
  where p.id is null or p.opd_id is distinct from (select id from cipta_bintar_opd)
     or p.jalur is distinct from 'PENGUATAN_DASAR'
  union all
  select 'INVALID_INTERVENTION_RELATION', count(*)
  from public.cipta_bintar_interventions i
  left join public.referral_mbi r on r.id = i.referral_id
  left join public.cipta_bintar_beneficiary_profiles b on b.id = i.beneficiary_profile_id
  where r.id is null or r.target_opd_id is distinct from (select id from cipta_bintar_opd)
     or r.jalur is distinct from 'PENGUATAN_DASAR' or b.warga_id is distinct from r.warga_id
  union all
  select 'PROCESSED_WITHOUT_INTERVENTION', count(*)
  from public.referral_mbi r
  where r.target_opd_id = (select id from cipta_bintar_opd) and r.jalur = 'PENGUATAN_DASAR'
    and r.status in ('DIPROSES', 'SELESAI')
    and not exists (select 1 from public.cipta_bintar_interventions i where i.referral_id = r.id)
  union all
  select 'QUOTA_OVERFLOW', count(*) from (
    select d.program_id from public.cipta_bintar_program_details d
    left join public.cipta_bintar_interventions i on i.program_id = d.program_id and i.participant_status <> 'TIDAK_AKTIF'
    group by d.program_id, d.capacity having count(i.id) > d.capacity
  ) overflow
  union all
  select 'COMPLETED_WITHOUT_OUTCOME', count(*) from public.cipta_bintar_interventions i
  where i.participant_status = 'HUNIAN_LAYAK_SELESAI'
    and not exists (select 1 from public.cipta_bintar_realisasi_infrastruktur o where o.intervention_id = i.id)
  union all
  select 'COMPLETED_WITHOUT_EVENT', count(*) from public.cipta_bintar_interventions i
  where i.participant_status = 'HUNIAN_LAYAK_SELESAI'
    and not exists (select 1 from public.cipta_bintar_intervention_events e where e.intervention_id = i.id and e.event_type = 'COMPLETED')
  union all
  select 'COMPLETED_WITHOUT_REPORT', count(*) from public.cipta_bintar_interventions i
  where i.participant_status = 'HUNIAN_LAYAK_SELESAI'
    and not exists (select 1 from public.cipta_bintar_laporan_realisasi l where l.intervention_id = i.id)
)
select 'INTEGRITY' as section, check_name as object_name,
  case when violating_rows = 0 then 'PASS' else 'BLOCKER:' || violating_rows end as result
from integrity_checks order by check_name;

select 'FIXTURE' as section, object_name,
  case when row_count = 0 then 'PASS' else 'BLOCKER:' || row_count end as result
from (
  select 'cipta_bintar_interventions' as object_name, count(*) as row_count
  from public.cipta_bintar_interventions where is_fixture
  union all
  select 'cipta_bintar_beneficiary_profiles', count(*)
  from public.cipta_bintar_beneficiary_profiles where is_fixture
  union all
  select 'cipta_bintar_petugas_dev_code', count(*)
  from public.cipta_bintar_petugas where kode like 'DEV-%'
  union all
  select 'cipta_bintar_program_dev_code', count(*)
  from public.master_program_layanan program
  join public.master_opd opd on opd.id = program.opd_id
  where opd.kode_opd = 'CIPTA_BINTAR' and program.kode_program like 'DEV-%'
) fixtures;
