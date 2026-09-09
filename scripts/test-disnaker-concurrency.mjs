import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import { cleanupDisnakerFixtures, seedDisnakerFixtures } from "./dev/disnaker-fixture-lib.mjs";
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
    body: JSON.stringify({ identifier: process.env.E2E_DISNAKER_IDENTIFIER, password: process.env.E2E_DISNAKER_PASSWORD }),
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
  fixture = await seedDisnakerFixtures();
  const quotaProgram = fixture.programs["DEV-PRG-QUOTA-01"];
  const quotaProvider = fixture.providers["DEV-LPK-01"];
  const quotaPayload = {
    programId: quotaProgram.id, lembagaId: quotaProvider.id, startDate: today,
    instruction: "Instruksi concurrency untuk slot terakhir program.",
  };
  const quotaStatuses = await concurrentStatuses(
    () => mutation(`/api/disnaker/referrals/${fixture.referrals.quotaA.referralId}/start`, cookie, quotaPayload),
    () => mutation(`/api/disnaker/referrals/${fixture.referrals.quotaB.referralId}/start`, cookie, quotaPayload),
  );
  assert.deepEqual(quotaStatuses, [200, 409]);
  const quotaInterventions = await admin.from("disnaker_interventions").select("id,referral_id").eq("program_id", quotaProgram.id);
  assert.ifError(quotaInterventions.error);
  assert.equal(quotaInterventions.data.length, 1);
  const quotaEvents = await admin.from("disnaker_intervention_events").select("id").eq("intervention_id", quotaInterventions.data[0].id).eq("event_type", "STARTED");
  assert.ifError(quotaEvents.error);
  assert.equal(quotaEvents.data.length, 1);

  const regularProgram = fixture.programs["DEV-PRG-VOK-01"];
  const provider = fixture.providers["DEV-BLK-01"];
  const start = await mutation(`/api/disnaker/referrals/${fixture.referrals.completion.referralId}/start`, cookie, {
    programId: regularProgram.id, lembagaId: provider.id, startDate: today,
    instruction: "Instruksi concurrency completion untuk peserta.",
  });
  const startText = await start.text();
  assert.equal(start.status, 200, startText);
  const interventionId = JSON.parse(startText).interventionId;
  const completePayload = {
    mitraIndustriId: fixture.partners["DEV-MITRA-BLUEBIRD"].id,
    placementDate: today,
    evaluation: "Evaluasi concurrency penempatan berhasil dan terkontrol.",
  };
  const completionStatuses = await concurrentStatuses(
    () => mutation(`/api/disnaker/interventions/${interventionId}/complete`, cookie, completePayload),
    () => mutation(`/api/disnaker/interventions/${interventionId}/complete`, cookie, completePayload),
  );
  assert.deepEqual(completionStatuses, [200, 409]);
  const [placements, completedEvents] = await Promise.all([
    admin.from("disnaker_penempatan_kerja").select("id").eq("intervention_id", interventionId),
    admin.from("disnaker_intervention_events").select("id").eq("intervention_id", interventionId).eq("event_type", "COMPLETED"),
  ]);
  assert.ifError(placements.error);
  assert.ifError(completedEvents.error);
  assert.equal(placements.data.length, 1);
  assert.equal(completedEvents.data.length, 1);

  console.log(JSON.stringify({ lastQuotaSlot: "1 success / 1 conflict", quotaRows: 1, quotaStartedEvents: 1, concurrentCompletion: "1 success / 1 conflict", placementRows: 1, completedEvents: 1 }, null, 2));
} finally {
  if (fixture) await cleanupDisnakerFixtures();
}
