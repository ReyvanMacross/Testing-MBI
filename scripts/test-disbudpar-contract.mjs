import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PROJECT_ROOT } from "./lib/project-env.mjs";

const source = (file) => readFile(path.join(PROJECT_ROOT, file), "utf8");
const [data, shell, input, foundation, operations, hardening, reportIntegrity, audit, environment, demo] = await Promise.all([
  source("lib/disbudpar/data.ts"),
  source("components/disbudpar/shell/disbudpar-shell.tsx"),
  source("lib/disbudpar/input.ts"),
  source("supabase/migrations/202609150001_disbudpar_workflow_foundation.sql"),
  source("supabase/migrations/202609150002_disbudpar_operational_rpcs.sql"),
  source("supabase/migrations/202609150003_disbudpar_final_hardening.sql"),
  source("supabase/migrations/202609150004_disbudpar_completion_report_integrity.sql"),
  source("supabase/audits/disbudpar-final-schema-check.sql"),
  source("scripts/check-production-env.mjs"),
  source("scripts/dev/seed-disbudpar-demo.mjs"),
]);

assert.match(data, /NODE_ENV\s*!==\s*"production"\s*&&\s*process\.env\.DISBUDPAR_PREVIEW_MODE\s*===\s*"true"/u);
assert.match(environment, /"DISBUDPAR_PREVIEW_MODE"/u);
assert.doesNotMatch(data, /\b\d{16}\b/u, "Data Disbudpar memuat NIK mentah.");
for (const route of ["/disbudpar", "/disbudpar/program", "/disbudpar/laporan"]) assert.ok(shell.includes(route));
for (const table of ["disbudpar_pendamping", "disbudpar_beneficiary_profiles", "disbudpar_program_details", "disbudpar_interventions", "disbudpar_intervention_events", "disbudpar_kemandirian_ekraf", "disbudpar_laporan_pembinaan"]) {
  assert.ok(foundation.includes(`public.${table}`), `Fondasi belum membuat ${table}.`);
  assert.ok(audit.includes(`'${table}'`), `Audit belum memeriksa ${table}.`);
}
for (const rpc of ["disbudpar_start_intervention", "disbudpar_update_intervention_progress", "disbudpar_complete_intervention", "disbudpar_create_program"]) {
  assert.ok(operations.includes(`public.${rpc}`), `RPC ${rpc} belum tersedia.`);
  assert.ok(operations.includes(`revoke all on function public.${rpc}`), `RPC ${rpc} belum dikunci.`);
}
assert.match(operations, /for update/u);
assert.match(operations, /PROGRAM_CAPACITY_FULL/u);
assert.match(operations, /INVALID_BENEFICIARY_PROFILE/u);
assert.match(input, /Lokasi sanggar atau galeri/u);
assert.match(hardening + reportIntegrity, /INVALID_DISBUDPAR_BENEFICIARY_LINK/u);
assert.match(hardening + reportIntegrity, /COMPLETED_INTERVENTION_REQUIRES_OUTCOME/u);
assert.match(demo, /seedDisbudparFixtures/u);
assert.match(demo, /is_fixture:\s*false/u);
assert.match(demo, /PRG-BUD-03/u);
console.log("Kontrak source, UI, RPC, RLS, concurrency, dan masking DISBUDPAR: PASS");
