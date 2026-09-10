import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import { cleanupDP3AFixtures, seedDP3AFixtures } from "./dev/dp3a-fixture-lib.mjs";
import { getSupabaseAdminEnvironment, loadProjectEnvironment } from "./lib/project-env.mjs";

await loadProjectEnvironment();
const BASE_URL = process.env.MBI_TEST_BASE_URL ?? "http://localhost:3000";
const ORIGIN = process.env.APP_ORIGIN ?? BASE_URL;
const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const admin = createClient(supabaseUrl, supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function login() {
  const response = await fetch(`${BASE_URL}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGIN, "Sec-Fetch-Site": "same-origin" }, body: JSON.stringify({ identifier: process.env.E2E_DP3A_IDENTIFIER, password: process.env.E2E_DP3A_PASSWORD }) });
  assert.equal(response.status, 200, await response.text());
  return response.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
}

function mutation(path, cookie, body) {
  return fetch(`${BASE_URL}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie, Origin: ORIGIN, "Sec-Fetch-Site": "same-origin" }, body: JSON.stringify(body) });
}

async function concurrentStatuses(requestA, requestB) {
  const settled = await Promise.allSettled([requestA(), requestB()]);
  assert.ok(settled.every((result) => result.status === "fulfilled"));
  return settled.map((result) => result.value.status).sort((a, b) => a - b);
}

const cookie = await login();
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
let fixture;
try {
  fixture = await seedDP3AFixtures();
  const quotaProgram = fixture.programs["DEV-PRG-PPA-QUOTA"];
  const quotaUnit = fixture.units["DEV-UNIT-PPA-QUOTA"];
  const quotaPayload = { programId: quotaProgram.id, unitId: quotaUnit.id, startDate: today, caseType: "SMP Kelas 8", supportItem: "Bantuan perlindungan slot terakhir", actionPlan: "Rencana concurrency untuk slot terakhir program DP3A." };
  const quotaStatuses = await concurrentStatuses(
    () => mutation(`/api/dp3a/referrals/${fixture.referrals.quotaA.referralId}/start`, cookie, quotaPayload),
    () => mutation(`/api/dp3a/referrals/${fixture.referrals.quotaB.referralId}/start`, cookie, quotaPayload),
  );
  assert.deepEqual(quotaStatuses, [200, 409]);
  const quotaCases = await admin.from("dp3a_cases").select("id,referral_id").eq("program_id", quotaProgram.id);
  assert.ifError(quotaCases.error); assert.equal(quotaCases.data.length, 1);
  const quotaEvents = await admin.from("dp3a_case_events").select("id").eq("case_id", quotaCases.data[0].id).eq("event_type", "STARTED");
  assert.ifError(quotaEvents.error); assert.equal(quotaEvents.data.length, 1);

  const program = fixture.programs["DEV-PRG-PPA-01"];
  const unit = fixture.units["DEV-UNIT-PPA-01"];
  const start = await mutation(`/api/dp3a/referrals/${fixture.referrals.completion.referralId}/start`, cookie, { ...quotaPayload, programId: program.id, unitId: unit.id });
  const startText = await start.text(); assert.equal(start.status, 200, startText);
  const caseId = JSON.parse(startText).caseId;
  const completePayload = { realizedAmount: 2500000, completionDate: today, supportItem: "Bantuan perlindungan selesai diterima", evaluation: "Evaluasi concurrency penyelesaian bantuan DP3A berhasil." };
  const completionStatuses = await concurrentStatuses(
    () => mutation(`/api/dp3a/cases/${caseId}/complete`, cookie, completePayload),
    () => mutation(`/api/dp3a/cases/${caseId}/complete`, cookie, completePayload),
  );
  assert.deepEqual(completionStatuses, [200, 409]);
  const [realizations, completedEvents] = await Promise.all([
    admin.from("dp3a_realisasi_layanan").select("id").eq("case_id", caseId),
    admin.from("dp3a_case_events").select("id").eq("case_id", caseId).eq("event_type", "COMPLETED"),
  ]);
  assert.ifError(realizations.error); assert.ifError(completedEvents.error);
  assert.equal(realizations.data.length, 1); assert.equal(completedEvents.data.length, 1);
  console.log(JSON.stringify({ lastQuotaSlot: "1 success / 1 conflict", quotaRows: 1, quotaStartedEvents: 1, concurrentCompletion: "1 success / 1 conflict", realizationRows: 1, completedEvents: 1 }, null, 2));
} finally {
  if (fixture) await cleanupDP3AFixtures();
}
