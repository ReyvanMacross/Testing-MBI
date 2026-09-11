import { readFile } from "node:fs/promises";
import path from "node:path";

import { PROJECT_ROOT } from "./lib/project-env.mjs";
import { withStagingDatabase } from "./lib/staging-database.mjs";

const migrations = [
  "202609140001_dkpp_workflow_foundation.sql",
  "202609140002_dkpp_operational_rpcs.sql",
  "202609140003_dkpp_final_hardening.sql",
  "202609140004_dkpp_completion_report_integrity.sql",
];

await withStagingDatabase(async (database) => {
  const baseline = await database.query(`
    select
      to_regclass('public.warga') is not null as warga,
      to_regclass('public.master_opd') is not null as opd,
      to_regclass('public.user_profiles') is not null as profiles,
      to_regclass('public.referral_mbi') is not null as referrals,
      to_regclass('public.master_program_layanan') is not null as programs,
      exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'transition_referral_status') as transition_rpc
  `);
  if (Object.values(baseline.rows[0]).some((value) => value !== true)) {
    throw new Error("Baseline integrasi staging belum lengkap; migration Dkpp tidak diterapkan.");
  }

  for (const migration of migrations) {
    const sql = await readFile(path.join(PROJECT_ROOT, "supabase", "migrations", migration), "utf8");
    await database.query("begin");
    try {
      await database.query(sql);
      await database.query("commit");
      console.log(`${migration}: PASS`);
    } catch (error) {
      await database.query("rollback");
      throw new Error(`${migration}: GAGAL (${error.message})`, { cause: error });
    }
  }
  await database.query("notify pgrst, 'reload schema'");
  console.log("PostgREST schema reload: REQUESTED");
});
