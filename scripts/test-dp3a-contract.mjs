import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PROJECT_ROOT } from "./lib/project-env.mjs";

async function source(file) {
  return readFile(path.join(PROJECT_ROOT, file), "utf8");
}

const [data, shell, input, foundation, operations, hardening, businessDate, audit, productionEnvironmentCheck] = await Promise.all([
  source("lib/dp3a/data.ts"),
  source("components/dp3a/shell/dp3a-shell.tsx"),
  source("lib/dp3a/input.ts"),
  source("supabase/migrations/202609120001_dp3a_workflow_foundation.sql"),
  source("supabase/migrations/202609120002_dp3a_operational_rpcs.sql"),
  source("supabase/migrations/202609120003_dp3a_final_hardening.sql"),
  source("supabase/migrations/202609120004_dp3a_bandung_business_date.sql"),
  source("supabase/audits/dp3a-final-schema-check.sql"),
  source("scripts/check-production-env.mjs"),
]);

assert.match(data, /NODE_ENV\s*!==\s*"production"\s*&&\s*process\.env\.DP3A_PREVIEW_MODE\s*===\s*"true"/u);
assert.match(productionEnvironmentCheck, /"DP3A_PREVIEW_MODE"/u);
assert.match(data, /\.from\("dp3a_realisasi_layanan"\)/u);
assert.match(data, /\.from\("dp3a_cases"\)/u);
assert.doesNotMatch(data, /\b\d{16}\b/u, "Data preview Dp3a memuat NIK tanpa masking.");

for (const label of ["Rujukan & Penanganan", "Program Layanan", "Laporan Realisasi"]) {
  assert.ok(shell.includes(label), `Navigasi kiri Dp3a belum memuat ${label}.`);
}
for (const route of ["/dp3a", "/dp3a/program", "/dp3a/laporan"]) {
  assert.ok(shell.includes(route), `Navigasi Dp3a belum memuat ${route}.`);
}

assert.match(input, /progressPercent\s*<\s*1\s*\|\|\s*progressPercent\s*>\s*99/u);
assert.match(input, /PRG-PPA-\[0-9\]\{2\}/u);

for (const table of ["dp3a_unit_layanan", "dp3a_program_details", "dp3a_cases", "dp3a_case_events", "dp3a_realisasi_layanan"]) {
  assert.ok(foundation.includes(`public.${table}`), `Migration fondasi belum membuat ${table}.`);
  assert.ok(foundation.includes(`alter table public.%I enable row level security`), "RLS loop fondasi Dp3a hilang.");
  assert.ok(audit.includes(`'${table}'`), `Audit schema belum memeriksa ${table}.`);
}
for (const routine of ["dp3a_start_case", "dp3a_update_case_progress", "dp3a_complete_case", "dp3a_create_program"]) {
  assert.ok(operations.includes(`public.${routine}`), `RPC ${routine} belum tersedia.`);
  assert.match(operations, new RegExp(`revoke all on function public\\.${routine}`), `RPC ${routine} belum dikunci.`);
}
for (const invariant of ["DP3A_PROGRAM_OVER_CAPACITY", "STARTED_EVENT_REQUIRED", "INVALID_DP3A_COMPLETED_LIFECYCLE", "COMPLETED_REFERRAL_REQUIRES_REALIZATION"]) {
  assert.ok(hardening.includes(invariant), `Hardening belum memeriksa ${invariant}.`);
}
assert.match(operations, /r\.is_fixture/u, "Status fixture referral belum diteruskan ke kasus DP3A.");
assert.match(businessDate, /Asia\/Jakarta/u, "Tanggal bisnis progress DP3A belum memakai zona waktu Bandung.");

console.log("Kontrak source, navigasi, preview, RPC, RLS, dan hardening DP3A: PASS");
