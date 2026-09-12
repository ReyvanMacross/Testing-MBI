import { readFile } from "node:fs/promises";
import path from "node:path";

import { PROJECT_ROOT } from "./lib/project-env.mjs";
import { withStagingDatabase } from "./lib/staging-database.mjs";

const migrations = [
  "202609180001_walikota_executive_foundation.sql",
  "202609180002_walikota_executive_rpcs.sql",
  "202609180003_walikota_fixture_propagation.sql",
];

await withStagingDatabase(async (database) => {
  const baseline = await database.query(`select
    to_regclass('public.bapperida_recommendations') is not null as recommendations,
    to_regclass('public.bapperida_v_cross_opd_outcomes') is not null as outcomes`);
  if (Object.values(baseline.rows[0]).some((value) => value !== true)) throw new Error("Baseline 12 modul belum lengkap.");
  for (const migration of migrations) {
    const sql = await readFile(path.join(PROJECT_ROOT, "supabase", "migrations", migration), "utf8");
    await database.query("begin");
    try { await database.query(sql); await database.query("commit"); console.log(`${migration}: PASS`); }
    catch (error) { await database.query("rollback"); throw new Error(`${migration}: GAGAL (${error.message})`, { cause: error }); }
  }
  await database.query("notify pgrst, 'reload schema'");
  console.log("PostgREST schema reload: REQUESTED");
});
