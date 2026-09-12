import { readFile } from "node:fs/promises";
import path from "node:path";

import { PROJECT_ROOT } from "./lib/project-env.mjs";
import { withStagingDatabase } from "./lib/staging-database.mjs";

const migrations = [
  "202609170001_bapperida_coordination_foundation.sql",
  "202609170002_bapperida_coordination_rpcs.sql",
];

await withStagingDatabase(async (database) => {
  const baseline = await database.query(`select
    to_regclass('public.warga') is not null as warga,
    to_regclass('public.referral_mbi') is not null as referrals,
    to_regclass('public.cipta_bintar_interventions') is not null as cipta_bintar`);
  if (Object.values(baseline.rows[0]).some((value) => value !== true)) throw new Error("Baseline 11 modul belum lengkap.");
  for (const migration of migrations) {
    const sql = await readFile(path.join(PROJECT_ROOT, "supabase", "migrations", migration), "utf8");
    await database.query("begin");
    try { await database.query(sql); await database.query("commit"); console.log(`${migration}: PASS`); }
    catch (error) { await database.query("rollback"); throw new Error(`${migration}: GAGAL (${error.message})`, { cause: error }); }
  }
  await database.query("notify pgrst, 'reload schema'");
  console.log("PostgREST schema reload: REQUESTED");
});
