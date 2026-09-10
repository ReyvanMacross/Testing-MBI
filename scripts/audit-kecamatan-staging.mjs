import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PROJECT_ROOT } from "./lib/project-env.mjs";
import { withStagingDatabase } from "./lib/staging-database.mjs";

const sql = await readFile(
  path.join(PROJECT_ROOT, "supabase", "audits", "kecamatan-final-schema-check.sql"),
  "utf8",
);

await withStagingDatabase(async (database) => {
  const results = await database.query(sql);
  const queries = Array.isArray(results) ? results : [results];
  const rows = queries.flatMap((result) => result.rows ?? []);
  assert.ok(rows.length >= 40, `Audit Kecamatan hanya menghasilkan ${rows.length} pemeriksaan.`);
  const failures = rows.filter((row) => row.result !== "PASS");
  assert.deepEqual(failures, [], `Audit Kecamatan gagal: ${JSON.stringify(failures)}`);

  const integrity = await database.query("select public.kecamatan_validate_domain_integrity() as result");
  assert.equal(integrity.rows[0].result.status, "PASS");
  console.log(`Audit schema Kecamatan: ${rows.length} pemeriksaan PASS`);
  console.log("Audit integritas domain Kecamatan: PASS");
});
