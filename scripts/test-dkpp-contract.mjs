import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PROJECT_ROOT } from "./lib/project-env.mjs";

const source = (file) => readFile(path.join(PROJECT_ROOT, file), "utf8");
const [data, shell, input, foundation, operations, hardening, reportIntegrity, audit, environment, demo] = await Promise.all([
  source("lib/dkpp/data.ts"),
  source("components/dkpp/shell/dkpp-shell.tsx"),
  source("lib/dkpp/input.ts"),
  source("supabase/migrations/202609140001_dkpp_workflow_foundation.sql"),
  source("supabase/migrations/202609140002_dkpp_operational_rpcs.sql"),
  source("supabase/migrations/202609140003_dkpp_final_hardening.sql"),
  source("supabase/migrations/202609140004_dkpp_completion_report_integrity.sql"),
  source("supabase/audits/dkpp-final-schema-check.sql"),
  source("scripts/check-production-env.mjs"),
  source("scripts/dev/seed-dkpp-demo.mjs"),
]);

assert.match(data, /NODE_ENV\s*!==\s*"production"\s*&&\s*process\.env\.DKPP_PREVIEW_MODE\s*===\s*"true"/u);
assert.match(environment, /"DKPP_PREVIEW_MODE"/u);
assert.doesNotMatch(data, /\b\d{16}\b/u, "Data Dkpp memuat NIK mentah.");
for (const route of ["/dkpp", "/dkpp/program", "/dkpp/laporan"]) assert.ok(shell.includes(route));
for (const table of ["dkpp_penyuluh", "dkpp_beneficiary_profiles", "dkpp_program_details", "dkpp_interventions", "dkpp_intervention_events", "dkpp_ketahanan_pangan", "dkpp_laporan_panen"]) {
  assert.ok(foundation.includes(`public.${table}`), `Fondasi belum membuat ${table}.`);
  assert.ok(audit.includes(`'${table}'`), `Audit belum memeriksa ${table}.`);
}
for (const rpc of ["dkpp_start_intervention", "dkpp_update_intervention_progress", "dkpp_complete_intervention", "dkpp_create_program"]) {
  assert.ok(operations.includes(`public.${rpc}`), `RPC ${rpc} belum tersedia.`);
  assert.ok(operations.includes(`revoke all on function public.${rpc}`), `RPC ${rpc} belum dikunci.`);
}
assert.match(operations, /for update/u);
assert.match(operations, /PROGRAM_CAPACITY_FULL/u);
assert.match(operations, /INVALID_BENEFICIARY_PROFILE/u);
assert.match(input, /Lokasi unit atau demplot/u);
assert.match(hardening + reportIntegrity, /INVALID_DKPP_BENEFICIARY_LINK/u);
assert.match(hardening + reportIntegrity, /COMPLETED_INTERVENTION_REQUIRES_OUTCOME/u);
assert.match(demo, /seedDkppFixtures/u);
assert.match(demo, /is_fixture:\s*false/u);
assert.match(demo, /PRG-SAE-03/u);
console.log("Kontrak source, UI, RPC, RLS, concurrency, dan masking DKPP: PASS");
