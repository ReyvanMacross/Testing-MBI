import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PROJECT_ROOT } from "./lib/project-env.mjs";
import { withStagingDatabase } from "./lib/staging-database.mjs";

const sql = (await readFile(path.join(PROJECT_ROOT, "supabase", "audits", "walikota-final-schema-check.sql"), "utf8")).replace(/^\uFEFF/u, "");
const blocker = /^(?:MISSING|BLOCKER|DISABLED|SECURITY_MODE_MISMATCH|SEARCH_PATH_MISSING)/u;
await withStagingDatabase(async (database) => {
  const raw = await database.query(sql);
  const results = Array.isArray(raw) ? raw : [raw];
  const rows = results.flatMap((result) => result.rows ?? []);
  assert.ok(rows.length >= 18, `Audit Wali Kota hanya menghasilkan ${rows.length} pemeriksaan.`);
  assert.deepEqual(rows.filter((row) => blocker.test(String(row.result ?? ""))), []);
  console.log(`Audit schema, read model, RPC, RLS, privilege, dan fixture Wali Kota: ${rows.length} pemeriksaan PASS`);
});
