import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import { cleanupDisdaginFixtures, seedDisdaginFixtures } from "./dev/disdagin-fixture-lib.mjs";
import { getSupabaseAdminEnvironment, loadProjectEnvironment } from "./lib/project-env.mjs";

await loadProjectEnvironment();
const BASE_URL = process.env.MBI_TEST_BASE_URL ?? "http://localhost:3000";
const ORIGIN = process.env.APP_ORIGIN ?? BASE_URL;
const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const admin = createClient(supabaseUrl, supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function login() {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, "Sec-Fetch-Site": "same-origin" },
    body: JSON.stringify({ identifier: process.env.E2E_DISDAGIN_IDENTIFIER, password: process.env.E2E_DISDAGIN_PASSWORD }),
  });
  assert.equal(response.status, 200, await response.text());
  return response.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
}

function mutation(path, cookie, body) {
  return fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie, Origin: ORIGIN, "Sec-Fetch-Site": "same-origin" },
    body: JSON.stringify(body),
  });
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
  fixture = await seedDisdaginFixtures();
  const quotaProgram = fixture.programs["DEV-PRG-DAG-QUOTA"];
  const quotaMentor = fixture.mentors["DEV-PLUT-02"];
  const quotaPayload = {
    programId: quotaProgram.id, pendampingId: quotaMentor.id, startDate: today,
    businessName: "Usaha Kuota Concurrent A", businessCategory: "Olahan Kuliner", nib: "9000000009201",
    stimulus: "Fasilitasi concurrency untuk slot terakhir.",
    actionPlan: "Rencana concurrency untuk slot terakhir program Disdagin.",
  };
  const quotaStatuses = await concurrentStatuses(
    () => mutation(`/api/disdagin/referrals/${fixture.referrals.quotaA.referralId}/start`, cookie, quotaPayload),
    () => mutation(`/api/disdagin/referrals/${fixture.referrals.quotaB.referralId}/start`, cookie, { ...quotaPayload, businessName: "Usaha Kuota Concurrent B", nib: "9000000009202" }),
  );
  assert.deepEqual(quotaStatuses, [200, 409]);
  const quotaInterventions = await admin.from("disdagin_interventions").select("id,referral_id").eq("program_id", quotaProgram.id);
  assert.ifError(quotaInterventions.error);
  assert.equal(quotaInterventions.data.length, 1);
  const quotaEvents = await admin.from("disdagin_intervention_events").select("id").eq("intervention_id", quotaInterventions.data[0].id).eq("event_type", "STARTED");
  assert.ifError(quotaEvents.error);
  assert.equal(quotaEvents.data.length, 1);

  const regularProgram = fixture.programs["DEV-PRG-DAG-01"];
  const mentor = fixture.mentors["DEV-PLUT-01"];
  const start = await mutation(`/api/disdagin/referrals/${fixture.referrals.completion.referralId}/start`, cookie, {
    programId: regularProgram.id, pendampingId: mentor.id, startDate: today,
    businessName: "Usaha Completion Concurrent", businessCategory: "Confectionery & Fashion", nib: "9000000009002",
    stimulus: "Fasilitasi concurrency untuk penyelesaian.",
    actionPlan: "Rencana concurrency completion untuk peserta Disdagin.",
  });
  const startText = await start.text();
  assert.equal(start.status, 200, startText);
  const interventionId = JSON.parse(startText).interventionId;
  const completePayload = {
    nib: "9000000009002",
    monthlyRevenue: 5200000,
    completionDate: today,
    evaluation: "Evaluasi concurrency kemandirian berhasil dan terkontrol.",
  };
  const completionStatuses = await concurrentStatuses(
    () => mutation(`/api/disdagin/interventions/${interventionId}/complete`, cookie, completePayload),
    () => mutation(`/api/disdagin/interventions/${interventionId}/complete`, cookie, completePayload),
  );
  assert.deepEqual(completionStatuses, [200, 409]);
  const [outcomes, reports, completedEvents] = await Promise.all([
    admin.from("disdagin_kemandirian_usaha").select("id").eq("intervention_id", interventionId),
    admin.from("disdagin_laporan_omzet").select("id").eq("intervention_id", interventionId),
    admin.from("disdagin_intervention_events").select("id").eq("intervention_id", interventionId).eq("event_type", "COMPLETED"),
  ]);
  assert.ifError(outcomes.error);
  assert.ifError(reports.error);
  assert.ifError(completedEvents.error);
  assert.equal(outcomes.data.length, 1);
  assert.equal(reports.data.length, 1);
  assert.equal(completedEvents.data.length, 1);

  console.log(JSON.stringify({ lastQuotaSlot: "1 success / 1 conflict", quotaRows: 1, quotaStartedEvents: 1, concurrentCompletion: "1 success / 1 conflict", outcomeRows: 1, reportRows: 1, completedEvents: 1 }, null, 2));
} finally {
  if (fixture) await cleanupDisdaginFixtures();
}
