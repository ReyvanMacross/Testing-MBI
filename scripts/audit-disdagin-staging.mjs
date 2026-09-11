import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PROJECT_ROOT } from "./lib/project-env.mjs";
import { withStagingDatabase } from "./lib/staging-database.mjs";

const sql = (await readFile(path.join(PROJECT_ROOT, "supabase", "audits", "disdagin-final-schema-check.sql"), "utf8")).replace(/^\uFEFF/u, "");
const blocker = /^(?:MISSING|BLOCKER|DISABLED|SECURITY_MODE_MISMATCH|SEARCH_PATH_MISSING)/u;

await withStagingDatabase(async (database) => {
  const rawResults = await database.query(sql);
  const results = Array.isArray(rawResults) ? rawResults : [rawResults];
  const rows = results.flatMap((result) => result.rows ?? []);
  assert.ok(rows.length >= 25, `Audit Disdagin hanya menghasilkan ${rows.length} pemeriksaan.`);
  const failures = rows.filter((row) => blocker.test(String(row.result ?? "")));
  assert.deepEqual(failures, [], `Audit Disdagin gagal: ${JSON.stringify(failures)}`);
  console.log(`Audit schema, RPC, RLS, privilege, integritas, dan fixture Disdagin: ${rows.length} pemeriksaan PASS`);
});
