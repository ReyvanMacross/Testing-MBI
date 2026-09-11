import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import { cleanupCiptaBintarFixtures, seedCiptaBintarFixtures } from "./dev/cipta-bintar-fixture-lib.mjs";
import { getSupabaseAdminEnvironment, loadProjectEnvironment } from "./lib/project-env.mjs";

await loadProjectEnvironment();
const BASE_URL = process.env.MBI_TEST_BASE_URL ?? "http://localhost:3000";
const ORIGIN = process.env.APP_ORIGIN ?? BASE_URL;
const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const admin = createClient(supabaseUrl, supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const ciptaBintarIdentifier = process.env.E2E_CIPTA_BINTAR_IDENTIFIER || process.env.CIPTA_BINTAR_ADMIN_USERNAME || "admin.cipta-bintar";
const ciptaBintarPassword = process.env.E2E_CIPTA_BINTAR_PASSWORD || process.env.CIPTA_BINTAR_ADMIN_PASSWORD || process.env.SUPABASE_TEST_ADMIN_PASSWORD;

async function login() {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, "Sec-Fetch-Site": "same-origin" },
    body: JSON.stringify({ identifier: ciptaBintarIdentifier, password: ciptaBintarPassword }),
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
  fixture = await seedCiptaBintarFixtures();
  const quotaProgram = fixture.programs["DEV-PRG-INF-QUOTA"];
  const quotaOfficer = fixture.officers["DEV-PINF-02"];
  const quotaPayload = {
    programId: quotaProgram.id, petugasId: quotaOfficer.id, startDate: today,
    objectAddress: "Lokasi Kuota Concurrent A", infrastructureCategory: "Sambungan Air Bersih", objectLocation: "Sekeloa Concurrent A",
    aidPackage: "Pemasangan pipa air concurrency untuk slot terakhir.", allocatedBudget: 8500000,
    actionPlan: "Rencana concurrency untuk slot terakhir program CIPTA_BINTAR.",
  };
  const quotaStatuses = await concurrentStatuses(
    () => mutation(`/api/cipta-bintar/referrals/${fixture.referrals.quotaA.referralId}/start`, cookie, quotaPayload),
    () => mutation(`/api/cipta-bintar/referrals/${fixture.referrals.quotaB.referralId}/start`, cookie, { ...quotaPayload, objectAddress: "Lokasi Kuota Concurrent B", objectLocation: "Sekeloa Concurrent B" }),
  );
  assert.deepEqual(quotaStatuses, [200, 409]);
  const quotaInterventions = await admin.from("cipta_bintar_interventions").select("id,referral_id").eq("program_id", quotaProgram.id);
  assert.ifError(quotaInterventions.error);
  assert.equal(quotaInterventions.data.length, 1);
  const quotaEvents = await admin.from("cipta_bintar_intervention_events").select("id").eq("intervention_id", quotaInterventions.data[0].id).eq("event_type", "STARTED");
  assert.ifError(quotaEvents.error);
  assert.equal(quotaEvents.data.length, 1);

  const regularProgram = fixture.programs["DEV-PRG-INF-01"];
  const officer = fixture.officers["DEV-PINF-01"];
  const start = await mutation(`/api/cipta-bintar/referrals/${fixture.referrals.completion.referralId}/start`, cookie, {
    programId: regularProgram.id, petugasId: officer.id, startDate: today,
    objectAddress: "Rumah Completion Concurrent", infrastructureCategory: "Rehabilitasi Rutilahu", objectLocation: "Sukajadi Concurrent",
    aidPackage: "Perbaikan fisik rumah concurrency untuk penyelesaian.", allocatedBudget: 25000000,
    actionPlan: "Rencana concurrency completion untuk peserta CIPTA_BINTAR.",
  });
  const startText = await start.text();
  assert.equal(start.status, 200, startText);
  const interventionId = JSON.parse(startText).interventionId;
  const completePayload = {
    realizationValue: 5200000,
    completionDate: today,
    evaluation: "Evaluasi concurrency kemandirian berhasil dan terkontrol.",
  };
  const completionStatuses = await concurrentStatuses(
    () => mutation(`/api/cipta-bintar/interventions/${interventionId}/complete`, cookie, completePayload),
    () => mutation(`/api/cipta-bintar/interventions/${interventionId}/complete`, cookie, completePayload),
  );
  assert.deepEqual(completionStatuses, [200, 409]);
  const [outcomes, reports, completedEvents] = await Promise.all([
    admin.from("cipta_bintar_realisasi_infrastruktur").select("id").eq("intervention_id", interventionId),
    admin.from("cipta_bintar_laporan_realisasi").select("id").eq("intervention_id", interventionId),
    admin.from("cipta_bintar_intervention_events").select("id").eq("intervention_id", interventionId).eq("event_type", "COMPLETED"),
  ]);
  assert.ifError(outcomes.error);
  assert.ifError(reports.error);
  assert.ifError(completedEvents.error);
  assert.equal(outcomes.data.length, 1);
  assert.equal(reports.data.length, 1);
  assert.equal(completedEvents.data.length, 1);

  console.log(JSON.stringify({ lastQuotaSlot: "1 success / 1 conflict", quotaRows: 1, quotaStartedEvents: 1, concurrentCompletion: "1 success / 1 conflict", outcomeRows: 1, reportRows: 1, completedEvents: 1 }, null, 2));
} finally {
  if (fixture) await cleanupCiptaBintarFixtures();
}
