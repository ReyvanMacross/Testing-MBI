import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PROJECT_ROOT } from "./lib/project-env.mjs";
const source = (file) => readFile(path.join(PROJECT_ROOT, file), "utf8");
const [actor, home, input, shell, data, foundation, operations, hardening, audit] = await Promise.all([
  source("lib/auth/require-kecamatan-actor.ts"), source("lib/auth/resolve-home-route.ts"), source("lib/kecamatan/input.ts"),
  source("components/kecamatan/shell/kecamatan-shell.tsx"), source("lib/kecamatan/data.ts"),
  source("supabase/migrations/202609110001_kecamatan_workflow_foundation.sql"),
  source("supabase/migrations/202609110002_kecamatan_operational_rpcs.sql"),
  source("supabase/migrations/202609110003_kecamatan_final_hardening.sql"),
  source("supabase/audits/kecamatan-final-schema-check.sql"),
]);
assert.match(actor, /role\s*!==\s*"Operator Kecamatan"/u);
assert.match(actor, /wilayah\?\.jenis\s*!==\s*"KECAMATAN"/u);
assert.ok(home.includes('profile.role === "Operator Kecamatan"') && home.includes('return "/kecamatan"'));
for (const route of ["/kecamatan", "/kecamatan/warga", "/kecamatan/verifikasi", "/kecamatan/rujukan"]) assert.ok(shell.includes(route), `Navigasi ${route} hilang.`);
for (const label of ["Beranda", "Data Warga", "Verifikasi Lapangan", "Pelacakan Rujukan"]) assert.ok(shell.includes(label), `Label ${label} hilang.`);
for (const table of ["kecamatan_warga_usulan", "kecamatan_survei", "kecamatan_documents", "kecamatan_referral_details", "kecamatan_events", "kecamatan_helpdesk_tickets"]) {
  assert.ok(foundation.includes(`public.${table}`)); assert.ok(audit.includes(`'${table}'`));
}
for (const rpc of ["kecamatan_create_proposal", "kecamatan_assign_survey", "kecamatan_submit_survey", "kecamatan_review_survey", "kecamatan_send_referral", "kecamatan_create_helpdesk_ticket"]) {
  assert.ok(operations.includes(`public.${rpc}`), `RPC ${rpc} hilang.`);
  assert.ok(operations.includes(`'public.${rpc}(`), `Signature penguncian RPC ${rpc} hilang.`);
}
assert.match(operations, /revoke all on function %s from public, anon, authenticated/u);
for (const guard of ["INVALID_KECAMATAN_JURISDICTION", "INVALID_KECAMATAN_REFERRAL_LINEAGE", "KECAMATAN_INTEGRITY_VIOLATION"]) assert.ok(hardening.includes(guard));
assert.match(input, /\^\\d\{16\}\$/u); assert.match(input, /factualDesil.*1, 5/u); assert.doesNotMatch(data, /\b\d{16}\b/u);
console.log("Kontrak actor, navigasi, input, RLS, RPC, lineage, dan privasi Kecamatan: PASS");
