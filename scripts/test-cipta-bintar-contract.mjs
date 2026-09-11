import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PROJECT_ROOT } from "./lib/project-env.mjs";

const source = (file) => readFile(path.join(PROJECT_ROOT, file), "utf8");
const [data, shell, input, foundation, operations, hardening, reportIntegrity, completionUpsert, audit, environment, demo] = await Promise.all([
  source("lib/cipta-bintar/data.ts"),
  source("components/cipta-bintar/shell/cipta-bintar-shell.tsx"),
  source("lib/cipta-bintar/input.ts"),
  source("supabase/migrations/202609160001_cipta_bintar_workflow_foundation.sql"),
  source("supabase/migrations/202609160002_cipta_bintar_operational_rpcs.sql"),
  source("supabase/migrations/202609160003_cipta_bintar_final_hardening.sql"),
  source("supabase/migrations/202609160004_cipta_bintar_completion_report_integrity.sql"),
  source("supabase/migrations/202609160005_cipta_bintar_completion_report_upsert.sql"),
  source("supabase/audits/cipta-bintar-final-schema-check.sql"),
  source("scripts/check-production-env.mjs"),
  source("scripts/dev/seed-cipta-bintar-demo.mjs"),
]);

assert.match(data, /NODE_ENV\s*!==\s*"production"\s*&&\s*process\.env\.CIPTA_BINTAR_PREVIEW_MODE\s*===\s*"true"/u);
assert.match(environment, /"CIPTA_BINTAR_PREVIEW_MODE"/u);
assert.doesNotMatch(data, /\b\d{16}\b/u, "Data CiptaBintar memuat NIK mentah.");
for (const route of ["/cipta-bintar", "/cipta-bintar/program", "/cipta-bintar/laporan"]) assert.ok(shell.includes(route));
for (const table of ["cipta_bintar_petugas", "cipta_bintar_beneficiary_profiles", "cipta_bintar_program_details", "cipta_bintar_interventions", "cipta_bintar_intervention_events", "cipta_bintar_realisasi_infrastruktur", "cipta_bintar_laporan_realisasi"]) {
  assert.ok(foundation.includes(`public.${table}`), `Fondasi belum membuat ${table}.`);
  assert.ok(audit.includes(`'${table}'`), `Audit belum memeriksa ${table}.`);
}
for (const rpc of ["cipta_bintar_start_intervention", "cipta_bintar_update_intervention_progress", "cipta_bintar_complete_intervention", "cipta_bintar_create_program"]) {
  assert.ok(operations.includes(`public.${rpc}`), `RPC ${rpc} belum tersedia.`);
  assert.ok(operations.includes(`revoke all on function public.${rpc}`), `RPC ${rpc} belum dikunci.`);
}
assert.match(operations, /for update/u);
assert.match(operations, /PROGRAM_CAPACITY_FULL/u);
assert.match(operations, /INVALID_BENEFICIARY_PROFILE/u);
assert.match(completionUpsert, /on conflict \(intervention_id, periode\) do update/u);
assert.match(completionUpsert, /revoke all on function public\.cipta_bintar_complete_intervention/u);
assert.match(input, /Lokasi objek/u);
assert.match(hardening + reportIntegrity, /INVALID_CIPTA_BINTAR_BENEFICIARY_LINK/u);
assert.match(hardening + reportIntegrity, /COMPLETED_INTERVENTION_REQUIRES_OUTCOME/u);
assert.match(demo, /seedCiptaBintarFixtures/u);
assert.match(demo, /is_fixture:\s*false/u);
assert.match(demo, /PRG-INF-03/u);
console.log("Kontrak source, UI, RPC, RLS, concurrency, dan masking CIPTA_BINTAR: PASS");
