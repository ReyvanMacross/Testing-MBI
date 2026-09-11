import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PROJECT_ROOT } from "./lib/project-env.mjs";
import { withStagingDatabase } from "./lib/staging-database.mjs";

const audits = [
  ["Dinsos", "dinsos-final-schema-check.sql"],
  ["Disnaker", "disnaker-final-schema-check.sql"],
  ["Diskop UKM", "diskop-final-schema-check.sql"],
  ["Disdik", "disdik-final-schema-check.sql"],
  ["Kecamatan", "kecamatan-final-schema-check.sql"],
  ["DP3A", "dp3a-final-schema-check.sql"],
  ["Disdagin", "disdagin-final-schema-check.sql"],
  ["DKPP", "dkpp-final-schema-check.sql"],
  ["Disbudpar", "disbudpar-final-schema-check.sql"],
  ["Cipta Bintar", "cipta-bintar-final-schema-check.sql"],
];
const blocker = /^(?:MISSING|BLOCKER|DISABLED|SECURITY_MODE_MISMATCH|SEARCH_PATH_MISSING)/u;

await withStagingDatabase(async (database) => {
  let total = 0;
  for (const [moduleName, file] of audits) {
    const sql = await readFile(path.join(PROJECT_ROOT, "supabase", "audits", file), "utf8");
    const rawResults = await database.query(sql);
    const results = Array.isArray(rawResults) ? rawResults : [rawResults];
    const rows = results.flatMap((result) => result.rows ?? []);
    assert.ok(rows.length > 0, `Audit ${moduleName} tidak menghasilkan pemeriksaan.`);
    const failures = rows.filter((row) => blocker.test(String(row.result ?? "")));
    assert.deepEqual(failures, [], `Audit ${moduleName} gagal: ${JSON.stringify(failures)}`);
    total += rows.length;
    console.log(`${moduleName}: ${rows.length} pemeriksaan tanpa blocker`);
  }

  const integrity = await database.query("select public.kecamatan_validate_domain_integrity() as result");
  assert.equal(integrity.rows[0].result.status, "PASS", "Validator domain Kecamatan gagal.");
  console.log(`Audit integrasi staging: ${total} pemeriksaan dan validator domain Kecamatan PASS`);
});
