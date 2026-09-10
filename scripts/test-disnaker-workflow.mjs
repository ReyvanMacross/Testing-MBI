import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import { cleanupDisnakerFixtures, seedDisnakerFixtures } from "./dev/disnaker-fixture-lib.mjs";
import { getSupabaseAdminEnvironment, loadProjectEnvironment } from "./lib/project-env.mjs";

await loadProjectEnvironment();
const BASE_URL = process.env.MBI_TEST_BASE_URL ?? "http://localhost:3000";
const ORIGIN = process.env.APP_ORIGIN ?? BASE_URL;
const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(publishableKey, "Supabase publishable key wajib tersedia.");
const admin = createClient(supabaseUrl, supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function login(identifier, password) {
  assert.ok(identifier && password, `Credential ${identifier ?? "unknown"} wajib tersedia.`);
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, "Sec-Fetch-Site": "same-origin" },
    body: JSON.stringify({ identifier, password }),
  });
  assert.equal(response.status, 200, await response.text());
  return response.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
}

function mutation(path, cookie, body, method = "POST") {
  return fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie, Origin: ORIGIN, "Sec-Fetch-Site": "same-origin" },
    body: JSON.stringify(body),
  });
}

async function expectDirectDenied(table, headers) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, { headers });
  assert.ok([401, 403].includes(response.status), `${table} direct REST returned ${response.status}`);
}

const disnakerCookie = await login(
  process.env.E2E_DISNAKER_IDENTIFIER,
  process.env.E2E_DISNAKER_PASSWORD,
);
const dinsosCookie = await login(
  process.env.E2E_DINSOS_IDENTIFIER ?? process.env.DINSOS_ADMIN_USERNAME,
  process.env.E2E_DINSOS_PASSWORD ?? process.env.DINSOS_ADMIN_PASSWORD,
);
const diskCookie = await login(
  process.env.E2E_ADMIN_IDENTIFIER ?? "admin.mbi",
  process.env.E2E_ADMIN_PASSWORD ?? process.env.SUPABASE_TEST_PASSWORD,
);
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

let fixture;
try {
  fixture = await seedDisnakerFixtures();
  const primary = fixture.referrals.primary;
  const completion = fixture.referrals.completion;
  const wrongTarget = fixture.referrals.wrongTarget;
  const providerId = fixture.providers["DEV-BLK-01"].id;
  const programId = fixture.programs["DEV-PRG-VOK-01"].id;
  const wrongOpdProgramId = fixture.programs["DEV-PRG-DINSOS-WRONG"].id;
  const wrongPathProgramId = fixture.programs["DEV-PRG-PATH-WRONG"].id;
  const partnerId = fixture.partners["DEV-MITRA-BLUEBIRD"].id;
  const startPayload = {
    programId,
    lembagaId: providerId,
    startDate: today,
    instruction: "Instruksi terkontrol untuk peserta fixture Disnaker.",
  };

  const unauthenticated = await mutation(`/api/disnaker/referrals/${primary.referralId}/start`, "", startPayload);
  assert.equal(unauthenticated.status, 401);
  const dinsosDenied = await mutation(`/api/disnaker/referrals/${primary.referralId}/start`, dinsosCookie, startPayload);
  assert.equal(dinsosDenied.status, 403);
  const diskDenied = await mutation(`/api/disnaker/referrals/${primary.referralId}/start`, diskCookie, startPayload);
  assert.equal(diskDenied.status, 403);
  const wrongTargetDenied = await mutation(`/api/disnaker/referrals/${wrongTarget.referralId}/start`, disnakerCookie, startPayload);
  assert.equal(wrongTargetDenied.status, 403);
  const wrongOpdProgram = await mutation(`/api/disnaker/referrals/${primary.referralId}/start`, disnakerCookie, { ...startPayload, programId: wrongOpdProgramId });
  assert.equal(wrongOpdProgram.status, 400);
  const wrongPathProgram = await mutation(`/api/disnaker/referrals/${primary.referralId}/start`, disnakerCookie, { ...startPayload, programId: wrongPathProgramId });
  assert.equal(wrongPathProgram.status, 400);

  const quotaPayload = {
    programId: fixture.programs["DEV-PRG-QUOTA-01"].id,
    lembagaId: fixture.providers["DEV-LPK-01"].id,
    startDate: today,
    instruction: "Instruksi pengujian batas kuota program Disnaker.",
  };
  const quotaWinner = await mutation(`/api/disnaker/referrals/${fixture.referrals.quotaA.referralId}/start`, disnakerCookie, quotaPayload);
  assert.equal(quotaWinner.status, 200, await quotaWinner.text());
  const fullQuota = await mutation(`/api/disnaker/referrals/${fixture.referrals.quotaB.referralId}/start`, disnakerCookie, quotaPayload);
  assert.equal(fullQuota.status, 409);

  const started = await mutation(`/api/disnaker/referrals/${primary.referralId}/start`, disnakerCookie, startPayload);
  const startedText = await started.text();
  assert.equal(started.status, 200, startedText);
  const startedBody = JSON.parse(startedText);
  assert.ok(startedBody.interventionId);
  const duplicateStart = await mutation(`/api/disnaker/referrals/${primary.referralId}/start`, disnakerCookie, startPayload);
  assert.equal(duplicateStart.status, 409);

  const invalidLow = await mutation(`/api/disnaker/interventions/${startedBody.interventionId}/progress`, disnakerCookie, {
    statusPeserta: "AKTIF_PELATIHAN", kehadiranPersen: -1, evaluasiInstruktur: "Evaluasi fixture progress Disnaker.",
  }, "PATCH");
  assert.equal(invalidLow.status, 400);
  const invalidHigh = await mutation(`/api/disnaker/interventions/${startedBody.interventionId}/progress`, disnakerCookie, {
    statusPeserta: "AKTIF_PELATIHAN", kehadiranPersen: 101, evaluasiInstruktur: "Evaluasi fixture progress Disnaker.",
  }, "PATCH");
  assert.equal(invalidHigh.status, 400);
  const progressed = await mutation(`/api/disnaker/interventions/${startedBody.interventionId}/progress`, disnakerCookie, {
    statusPeserta: "AKTIF_PELATIHAN", kehadiranPersen: 85, evaluasiInstruktur: "Peserta aktif mengikuti seluruh modul pengujian.",
  }, "PATCH");
  assert.equal(progressed.status, 200, await progressed.text());
  const referralAfterProgress = await admin.from("referral_mbi").select("status").eq("id", primary.referralId).single();
  assert.ifError(referralAfterProgress.error);
  assert.equal(referralAfterProgress.data.status, "DIPROSES");

  const completionStart = await mutation(`/api/disnaker/referrals/${completion.referralId}/start`, disnakerCookie, startPayload);
  const completionStartText = await completionStart.text();
  assert.equal(completionStart.status, 200, completionStartText);
  const completionBody = JSON.parse(completionStartText);
  const unknownPartner = await mutation(`/api/disnaker/interventions/${completionBody.interventionId}/complete`, disnakerCookie, {
    mitraIndustriId: "00000000-0000-4000-8000-000000000001", placementDate: today,
    evaluation: "Evaluasi penempatan fixture Disnaker berhasil.",
  });
  assert.equal(unknownPartner.status, 400);
  const completed = await mutation(`/api/disnaker/interventions/${completionBody.interventionId}/complete`, disnakerCookie, {
    mitraIndustriId: partnerId, placementDate: today,
    evaluation: "Peserta fixture berhasil ditempatkan pada mitra development.",
  });
  assert.equal(completed.status, 200, await completed.text());
  const duplicateComplete = await mutation(`/api/disnaker/interventions/${completionBody.interventionId}/complete`, disnakerCookie, {
    mitraIndustriId: partnerId, placementDate: today,
    evaluation: "Peserta fixture berhasil ditempatkan pada mitra development.",
  });
  assert.equal(duplicateComplete.status, 409);

  const [referralFinal, interventionRows, placementRows, events, report] = await Promise.all([
    admin.from("referral_mbi").select("status,completed_at").eq("id", completion.referralId).single(),
    admin.from("disnaker_interventions").select("id,participant_status,attendance_percent").in("referral_id", [primary.referralId, completion.referralId]),
    admin.from("disnaker_penempatan_kerja").select("id,intervention_id,mitra_industri_id").eq("intervention_id", completionBody.interventionId),
    admin.from("disnaker_intervention_events").select("intervention_id,event_type,note").in("intervention_id", [startedBody.interventionId, completionBody.interventionId]),
    admin.rpc("list_disnaker_placement_partners", { p_search: null, p_sector: null, p_status: null, p_limit: 100, p_offset: 0 }),
  ]);
  for (const result of [referralFinal, interventionRows, placementRows, events, report]) assert.ifError(result.error);
  assert.equal(referralFinal.data.status, "SELESAI");
  assert.ok(referralFinal.data.completed_at);
  assert.equal(interventionRows.data.length, 2);
  assert.equal(placementRows.data.length, 1);
  assert.ok(events.data.some((row) => row.intervention_id === startedBody.interventionId && row.event_type === "PROGRESS_UPDATED"));
  assert.ok(events.data.some((row) => row.intervention_id === completionBody.interventionId && row.event_type === "COMPLETED"));
  assert.ok(report.data.some((row) => row.company_id === partnerId && Number(row.workers_absorbed) === 1));
  assert.doesNotMatch(JSON.stringify(events.data), /\b\d{16}\b|"nik"|"nomor_kk"|"nomor_hp"/i);

  const profile = await admin.from("user_profiles").select("email").eq("username", "admin.disnaker").single();
  assert.ifError(profile.error);
  const browser = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const browserLogin = await browser.auth.signInWithPassword({ email: profile.data.email, password: process.env.E2E_DISNAKER_PASSWORD });
  assert.ifError(browserLogin.error);
  const anonHeaders = { apikey: publishableKey };
  const authHeaders = { apikey: publishableKey, Authorization: `Bearer ${browserLogin.data.session.access_token}` };
  for (const table of [
    "disnaker_program_details", "disnaker_interventions", "disnaker_intervention_events",
    "disnaker_lembaga_pelaksana", "disnaker_mitra_industri", "disnaker_penempatan_kerja",
  ]) {
    await expectDirectDenied(table, anonHeaders);
    await expectDirectDenied(table, authHeaders);
  }
  await browser.auth.signOut({ scope: "local" });

  console.log(JSON.stringify({
    login: "PASS", roleIsolation: "PASS", targetIsolation: "PASS",
    wrongProgramOpd: 400, wrongProgramPath: 400, fullQuota: 409,
    start: "PASS", duplicateStart: 409, progress: "PASS", attendanceBounds: "PASS",
    progressKeepsReferralProcessing: "PASS", completePlacement: "PASS", unknownCompany: 400,
    duplicatePlacement: 409, referralCompleted: "PASS", placementReport: "REAL_DB_PASS",
    clientPii: 0, directDatabaseAccess: "BLOCKED",
  }, null, 2));
} finally {
  if (fixture) await cleanupDisnakerFixtures();
}
