import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PROJECT_ROOT } from "./lib/project-env.mjs";

const source = (file) => readFile(path.join(PROJECT_ROOT, file), "utf8");
const [data, shell, input, foundation, operations, hardening, reportIntegrity, audit, environment, demo] = await Promise.all([
  source("lib/disdagin/data.ts"),
  source("components/disdagin/shell/disdagin-shell.tsx"),
  source("lib/disdagin/input.ts"),
  source("supabase/migrations/202609130001_disdagin_workflow_foundation.sql"),
  source("supabase/migrations/202609130002_disdagin_operational_rpcs.sql"),
  source("supabase/migrations/202609130003_disdagin_final_hardening.sql"),
  source("supabase/migrations/202609130004_disdagin_completion_report_integrity.sql"),
  source("supabase/audits/disdagin-final-schema-check.sql"),
  source("scripts/check-production-env.mjs"),
  source("scripts/dev/seed-disdagin-demo.mjs"),
]);

assert.match(data, /NODE_ENV\s*!==\s*"production"\s*&&\s*process\.env\.DISDAGIN_PREVIEW_MODE\s*===\s*"true"/u);
assert.match(environment, /"DISDAGIN_PREVIEW_MODE"/u);
assert.doesNotMatch(data, /\b\d{16}\b/u, "Data Disdagin memuat NIK mentah.");
for (const route of ["/disdagin", "/disdagin/program", "/disdagin/laporan"]) assert.ok(shell.includes(route));
for (const table of ["disdagin_pendamping", "disdagin_business_profiles", "disdagin_program_details", "disdagin_interventions", "disdagin_intervention_events", "disdagin_kemandirian_usaha", "disdagin_laporan_omzet"]) {
  assert.ok(foundation.includes(`public.${table}`), `Fondasi belum membuat ${table}.`);
  assert.ok(audit.includes(`'${table}'`), `Audit belum memeriksa ${table}.`);
}
for (const rpc of ["disdagin_start_intervention", "disdagin_update_intervention_progress", "disdagin_complete_intervention", "disdagin_create_program"]) {
  assert.ok(operations.includes(`public.${rpc}`), `RPC ${rpc} belum tersedia.`);
  assert.ok(operations.includes(`revoke all on function public.${rpc}`), `RPC ${rpc} belum dikunci.`);
}
assert.match(operations, /for update/u);
assert.match(operations, /PROGRAM_CAPACITY_FULL/u);
assert.match(operations, /INVALID_BUSINESS_PROFILE/u);
assert.match(input, /NIB harus tepat 13 digit/u);
assert.match(hardening + reportIntegrity, /INVALID_DISDAGIN_BUSINESS_LINK/u);
assert.match(hardening + reportIntegrity, /COMPLETED_INTERVENTION_REQUIRES_OUTCOME/u);
assert.match(demo, /seedDisdaginFixtures/u);
assert.match(demo, /is_fixture:\s*false/u);
assert.match(demo, /PRG-DAG-03/u);
console.log("Kontrak source, UI, RPC, RLS, concurrency, dan masking Disdagin: PASS");
