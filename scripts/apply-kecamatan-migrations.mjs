import { readFile } from "node:fs/promises";
import path from "node:path";

import { PROJECT_ROOT } from "./lib/project-env.mjs";
import { withStagingDatabase } from "./lib/staging-database.mjs";

const migrations = [
  "202609110001_kecamatan_workflow_foundation.sql",
  "202609110002_kecamatan_operational_rpcs.sql",
  "202609110003_kecamatan_final_hardening.sql",
];

await withStagingDatabase(async (database) => {
  const baseline = await database.query(`
    select
      to_regclass('public.warga') is not null as warga,
      to_regclass('public.master_wilayah') is not null as wilayah,
      to_regclass('public.user_profiles') is not null as profiles,
      to_regclass('public.referral_mbi') is not null as referrals,
      to_regclass('public.master_program_layanan') is not null as programs
  `);
  if (Object.values(baseline.rows[0]).some((value) => value !== true)) {
    throw new Error("Baseline staging belum lengkap; migration Kecamatan tidak diterapkan.");
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
});
