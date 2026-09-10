import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PROJECT_ROOT } from "./lib/project-env.mjs";

async function source(file) {
  return readFile(path.join(PROJECT_ROOT, file), "utf8");
}

const [data, shell, input, foundation, operations, hardening, audit, productionEnvironmentCheck] = await Promise.all([
  source("lib/disdik/data.ts"),
  source("components/disdik/shell/disdik-shell.tsx"),
  source("lib/disdik/input.ts"),
  source("supabase/migrations/202609100001_disdik_workflow_foundation.sql"),
  source("supabase/migrations/202609100002_disdik_operational_rpcs.sql"),
  source("supabase/migrations/202609100003_disdik_final_hardening.sql"),
  source("supabase/audits/disdik-final-schema-check.sql"),
  source("scripts/check-production-env.mjs"),
]);

assert.match(data, /NODE_ENV\s*!==\s*"production"\s*&&\s*process\.env\.DISDIK_PREVIEW_MODE\s*===\s*"true"/u);
assert.match(productionEnvironmentCheck, /"DISDIK_PREVIEW_MODE"/u);
assert.match(data, /\.from\("disdik_realisasi_bantuan"\)/u);
assert.match(data, /\.from\("disdik_interventions"\)/u);
assert.doesNotMatch(data, /\b\d{16}\b/u, "Data preview Disdik memuat NIK tanpa masking.");

for (const label of ["Rujukan & Intervensi", "Program Pendidikan", "Laporan Realisasi"]) {
  assert.ok(shell.includes(label), `Navigasi kiri Disdik belum memuat ${label}.`);
}
for (const route of ["/disdik", "/disdik/program", "/disdik/laporan"]) {
  assert.ok(shell.includes(route), `Navigasi Disdik belum memuat ${route}.`);
}

assert.match(input, /progressPercent\s*<\s*1\s*\|\|\s*progressPercent\s*>\s*99/u);
assert.match(input, /PRG-EDU-\[0-9\]\{2\}/u);

for (const table of ["disdik_sekolah", "disdik_program_details", "disdik_interventions", "disdik_intervention_events", "disdik_realisasi_bantuan"]) {
  assert.ok(foundation.includes(`public.${table}`), `Migration fondasi belum membuat ${table}.`);
  assert.ok(foundation.includes(`alter table public.%I enable row level security`), "RLS loop fondasi Disdik hilang.");
  assert.ok(audit.includes(`'${table}'`), `Audit schema belum memeriksa ${table}.`);
}
for (const routine of ["disdik_start_intervention", "disdik_update_intervention_progress", "disdik_complete_intervention", "disdik_create_program"]) {
  assert.ok(operations.includes(`public.${routine}`), `RPC ${routine} belum tersedia.`);
  assert.match(operations, new RegExp(`revoke all on function public\\.${routine}`), `RPC ${routine} belum dikunci.`);
}
for (const invariant of ["DISDIK_PROGRAM_OVER_CAPACITY", "STARTED_EVENT_REQUIRED", "INVALID_DISDIK_COMPLETED_LIFECYCLE", "COMPLETED_REFERRAL_REQUIRES_REALIZATION"]) {
  assert.ok(hardening.includes(invariant), `Hardening belum memeriksa ${invariant}.`);
}

console.log("Kontrak source, navigasi, preview, RPC, RLS, dan hardening Disdik: PASS");
