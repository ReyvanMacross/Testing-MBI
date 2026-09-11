import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import { cleanupDkppFixtures, seedDkppFixtures } from "./dev/dkpp-fixture-lib.mjs";
import { getSupabaseAdminEnvironment, loadProjectEnvironment } from "./lib/project-env.mjs";

await loadProjectEnvironment();
const BASE_URL = process.env.MBI_TEST_BASE_URL ?? "http://localhost:3000";
const ORIGIN = process.env.APP_ORIGIN ?? BASE_URL;
const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const admin = createClient(supabaseUrl, supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const dkppIdentifier = process.env.E2E_DKPP_IDENTIFIER || process.env.DKPP_ADMIN_USERNAME || "admin.dkpp";
const dkppPassword = process.env.E2E_DKPP_PASSWORD || process.env.DKPP_ADMIN_PASSWORD || process.env.SUPABASE_TEST_ADMIN_PASSWORD;

async function login() {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, "Sec-Fetch-Site": "same-origin" },
    body: JSON.stringify({ identifier: dkppIdentifier, password: dkppPassword }),
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
  fixture = await seedDkppFixtures();
  const quotaProgram = fixture.programs["DEV-PRG-SAE-QUOTA"];
  const quotaOfficer = fixture.officers["DEV-PPL-02"];
  const quotaPayload = {
    programId: quotaProgram.id, penyuluhId: quotaOfficer.id, startDate: today,
    groupName: "KWT Kuota Concurrent A", foodCategory: "Bantuan Bibit dan Ternak", plotLocation: "Demplot Concurrent A",
    aidPackage: "Paket bibit concurrency untuk slot terakhir.",
    actionPlan: "Rencana concurrency untuk slot terakhir program DKPP.",
  };
  const quotaStatuses = await concurrentStatuses(
    () => mutation(`/api/dkpp/referrals/${fixture.referrals.quotaA.referralId}/start`, cookie, quotaPayload),
    () => mutation(`/api/dkpp/referrals/${fixture.referrals.quotaB.referralId}/start`, cookie, { ...quotaPayload, groupName: "KWT Kuota Concurrent B", plotLocation: "Demplot Concurrent B" }),
  );
  assert.deepEqual(quotaStatuses, [200, 409]);
  const quotaInterventions = await admin.from("dkpp_interventions").select("id,referral_id").eq("program_id", quotaProgram.id);
  assert.ifError(quotaInterventions.error);
  assert.equal(quotaInterventions.data.length, 1);
  const quotaEvents = await admin.from("dkpp_intervention_events").select("id").eq("intervention_id", quotaInterventions.data[0].id).eq("event_type", "STARTED");
  assert.ifError(quotaEvents.error);
  assert.equal(quotaEvents.data.length, 1);

  const regularProgram = fixture.programs["DEV-PRG-SAE-01"];
  const officer = fixture.officers["DEV-PPL-01"];
  const start = await mutation(`/api/dkpp/referrals/${fixture.referrals.completion.referralId}/start`, cookie, {
    programId: regularProgram.id, penyuluhId: officer.id, startDate: today,
    groupName: "KWT Completion Concurrent", foodCategory: "Urban Farming", plotLocation: "Demplot Completion Concurrent",
    aidPackage: "Paket budidaya concurrency untuk penyelesaian.",
    actionPlan: "Rencana concurrency completion untuk peserta DKPP.",
  });
  const startText = await start.text();
  assert.equal(start.status, 200, startText);
  const interventionId = JSON.parse(startText).interventionId;
  const completePayload = {
    harvestValue: 5200000,
    completionDate: today,
    evaluation: "Evaluasi concurrency kemandirian berhasil dan terkontrol.",
  };
  const completionStatuses = await concurrentStatuses(
    () => mutation(`/api/dkpp/interventions/${interventionId}/complete`, cookie, completePayload),
    () => mutation(`/api/dkpp/interventions/${interventionId}/complete`, cookie, completePayload),
  );
  assert.deepEqual(completionStatuses, [200, 409]);
  const [outcomes, reports, completedEvents] = await Promise.all([
    admin.from("dkpp_ketahanan_pangan").select("id").eq("intervention_id", interventionId),
    admin.from("dkpp_laporan_panen").select("id").eq("intervention_id", interventionId),
    admin.from("dkpp_intervention_events").select("id").eq("intervention_id", interventionId).eq("event_type", "COMPLETED"),
  ]);
  assert.ifError(outcomes.error);
  assert.ifError(reports.error);
  assert.ifError(completedEvents.error);
  assert.equal(outcomes.data.length, 1);
  assert.equal(reports.data.length, 1);
  assert.equal(completedEvents.data.length, 1);

  console.log(JSON.stringify({ lastQuotaSlot: "1 success / 1 conflict", quotaRows: 1, quotaStartedEvents: 1, concurrentCompletion: "1 success / 1 conflict", outcomeRows: 1, reportRows: 1, completedEvents: 1 }, null, 2));
} finally {
  if (fixture) await cleanupDkppFixtures();
}
