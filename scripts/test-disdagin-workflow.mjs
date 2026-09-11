import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import { cleanupDisdaginFixtures, seedDisdaginFixtures } from "./dev/disdagin-fixture-lib.mjs";
import { getSupabaseAdminEnvironment, loadProjectEnvironment } from "./lib/project-env.mjs";

await loadProjectEnvironment();
const BASE_URL = process.env.MBI_TEST_BASE_URL ?? "http://localhost:3000";
const ORIGIN = process.env.APP_ORIGIN ?? BASE_URL;
const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(publishableKey, "Supabase publishable key wajib tersedia.");
const admin = createClient(supabaseUrl, supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const disdaginIdentifier = process.env.E2E_DISDAGIN_IDENTIFIER || process.env.DISDAGIN_ADMIN_USERNAME || "admin.disdagin";
const disdaginPassword = process.env.E2E_DISDAGIN_PASSWORD || process.env.DISDAGIN_ADMIN_PASSWORD || process.env.SUPABASE_TEST_ADMIN_PASSWORD;

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

const disdaginCookie = await login(
  disdaginIdentifier,
  disdaginPassword,
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
  fixture = await seedDisdaginFixtures();
  const primary = fixture.referrals.primary;
  const completion = fixture.referrals.completion;
  const wrongTarget = fixture.referrals.wrongTarget;
  const mentorId = fixture.mentors["DEV-PLUT-01"].id;
  const programId = fixture.programs["DEV-PRG-DAG-01"].id;
  const wrongOpdProgramId = fixture.programs["DEV-PRG-DINSOS-WRONG"].id;
  const wrongPathProgramId = fixture.programs["DEV-PRG-PATH-WRONG"].id;
  const startPayload = {
    programId,
    pendampingId: mentorId,
    businessName: "Usaha Pameran Primer",
    businessCategory: "Confectionery & Fashion",
    nib: "9000000009101",
    startDate: today,
    stimulus: "Fasilitasi legalitas usaha terkontrol.",
    actionPlan: "Rencana pendampingan terkontrol untuk peserta fixture Disdagin.",
  };

  const unauthenticated = await mutation(`/api/disdagin/referrals/${primary.referralId}/start`, "", startPayload);
  assert.equal(unauthenticated.status, 401);
  const dinsosDenied = await mutation(`/api/disdagin/referrals/${primary.referralId}/start`, dinsosCookie, startPayload);
  assert.equal(dinsosDenied.status, 403);
  const diskDenied = await mutation(`/api/disdagin/referrals/${primary.referralId}/start`, diskCookie, startPayload);
  assert.equal(diskDenied.status, 403);
  const wrongTargetDenied = await mutation(`/api/disdagin/referrals/${wrongTarget.referralId}/start`, disdaginCookie, startPayload);
  assert.equal(wrongTargetDenied.status, 403);
  const wrongOpdProgram = await mutation(`/api/disdagin/referrals/${primary.referralId}/start`, disdaginCookie, { ...startPayload, programId: wrongOpdProgramId });
  assert.equal(wrongOpdProgram.status, 400);
  const wrongPathProgram = await mutation(`/api/disdagin/referrals/${primary.referralId}/start`, disdaginCookie, { ...startPayload, programId: wrongPathProgramId });
  assert.equal(wrongPathProgram.status, 400);

  const quotaPayload = {
    programId: fixture.programs["DEV-PRG-DAG-QUOTA"].id,
    pendampingId: fixture.mentors["DEV-PLUT-02"].id,
    businessName: "Usaha Kuota Pertama",
    businessCategory: "Olahan Kuliner",
    nib: "9000000009102",
    startDate: today,
    stimulus: "Fasilitasi kuota pengujian internal.",
    actionPlan: "Rencana pengujian batas kuota program Disdagin.",
  };
  const quotaWinner = await mutation(`/api/disdagin/referrals/${fixture.referrals.quotaA.referralId}/start`, disdaginCookie, quotaPayload);
  assert.equal(quotaWinner.status, 200, await quotaWinner.text());
  const fullQuota = await mutation(`/api/disdagin/referrals/${fixture.referrals.quotaB.referralId}/start`, disdaginCookie, { ...quotaPayload, businessName: "Usaha Kuota Kedua", nib: "9000000009103" });
  assert.equal(fullQuota.status, 409);

  const started = await mutation(`/api/disdagin/referrals/${primary.referralId}/start`, disdaginCookie, startPayload);
  const startedText = await started.text();
  assert.equal(started.status, 200, startedText);
  const startedBody = JSON.parse(startedText);
  assert.ok(startedBody.interventionId);
  const duplicateStart = await mutation(`/api/disdagin/referrals/${primary.referralId}/start`, disdaginCookie, startPayload);
  assert.equal(duplicateStart.status, 409);

  const invalidLow = await mutation(`/api/disdagin/interventions/${startedBody.interventionId}/progress`, disdaginCookie, {
    participantStatus: "AKTIF_PENDAMPINGAN", progressPercent: -1, legalStatus: "BELUM", evaluation: "Evaluasi fixture progress Disdagin.",
  }, "PATCH");
  assert.equal(invalidLow.status, 400);
  const invalidHigh = await mutation(`/api/disdagin/interventions/${startedBody.interventionId}/progress`, disdaginCookie, {
    participantStatus: "AKTIF_PENDAMPINGAN", progressPercent: 101, legalStatus: "BELUM", evaluation: "Evaluasi fixture progress Disdagin.",
  }, "PATCH");
  assert.equal(invalidHigh.status, 400);
  const progressed = await mutation(`/api/disdagin/interventions/${startedBody.interventionId}/progress`, disdaginCookie, {
    participantStatus: "AKTIF_PENDAMPINGAN", progressPercent: 75, legalStatus: "PROSES_NIB_HALAL", evaluation: "Peserta aktif mengikuti seluruh modul pengujian usaha.",
  }, "PATCH");
  assert.equal(progressed.status, 200, await progressed.text());
  const referralAfterProgress = await admin.from("referral_mbi").select("status").eq("id", primary.referralId).single();
  assert.ifError(referralAfterProgress.error);
  assert.equal(referralAfterProgress.data.status, "DIPROSES");

  const completionStart = await mutation(`/api/disdagin/referrals/${completion.referralId}/start`, disdaginCookie, { ...startPayload, businessName: "Usaha Penyelesaian", nib: "9000000009001" });
  const completionStartText = await completionStart.text();
  assert.equal(completionStart.status, 200, completionStartText);
  const completionBody = JSON.parse(completionStartText);
  const invalidNib = await mutation(`/api/disdagin/interventions/${completionBody.interventionId}/complete`, disdaginCookie, {
    nib: "123", monthlyRevenue: 4500000, completionDate: today,
    evaluation: "Evaluasi kemandirian fixture Disdagin berhasil.",
  });
  assert.equal(invalidNib.status, 400);
  const mismatchedBusiness = await mutation(`/api/disdagin/interventions/${completionBody.interventionId}/complete`, disdaginCookie, {
    nib: "9000000009099", monthlyRevenue: 4500000, completionDate: today,
    evaluation: "Evaluasi profil usaha yang sengaja tidak cocok untuk kontrol negatif.",
  });
  assert.equal(mismatchedBusiness.status, 400);
  const completed = await mutation(`/api/disdagin/interventions/${completionBody.interventionId}/complete`, disdaginCookie, {
    nib: "9000000009001", monthlyRevenue: 4500000, completionDate: today,
    evaluation: "Peserta fixture berhasil menyelesaikan pendampingan usaha development.",
  });
  assert.equal(completed.status, 200, await completed.text());
  const duplicateComplete = await mutation(`/api/disdagin/interventions/${completionBody.interventionId}/complete`, disdaginCookie, {
    nib: "9000000009001", monthlyRevenue: 4500000, completionDate: today,
    evaluation: "Peserta fixture berhasil menyelesaikan pendampingan usaha development.",
  });
  assert.equal(duplicateComplete.status, 409);

  const [referralFinal, interventionRows, outcomeRows, revenueRows, events] = await Promise.all([
    admin.from("referral_mbi").select("status,completed_at").eq("id", completion.referralId).single(),
    admin.from("disdagin_interventions").select("id,participant_status,progress_percent,legal_status").in("referral_id", [primary.referralId, completion.referralId]),
    admin.from("disdagin_kemandirian_usaha").select("id,intervention_id,nib,omzet_bulanan").eq("intervention_id", completionBody.interventionId),
    admin.from("disdagin_laporan_omzet").select("id,intervention_id,nominal,status").eq("intervention_id", completionBody.interventionId),
    admin.from("disdagin_intervention_events").select("intervention_id,event_type,note").in("intervention_id", [startedBody.interventionId, completionBody.interventionId]),
  ]);
  for (const result of [referralFinal, interventionRows, outcomeRows, revenueRows, events]) assert.ifError(result.error);
  assert.equal(referralFinal.data.status, "SELESAI");
  assert.ok(referralFinal.data.completed_at);
  assert.equal(interventionRows.data.length, 2);
  assert.equal(outcomeRows.data.length, 1);
  assert.equal(outcomeRows.data[0].nib, "9000000009001");
  assert.equal(Number(outcomeRows.data[0].omzet_bulanan), 4500000);
  assert.equal(revenueRows.data.length, 1);
  assert.equal(Number(revenueRows.data[0].nominal), 4500000);
  assert.ok(events.data.some((row) => row.intervention_id === startedBody.interventionId && row.event_type === "PROGRESS_UPDATED"));
  assert.ok(events.data.some((row) => row.intervention_id === completionBody.interventionId && row.event_type === "COMPLETED"));
  assert.doesNotMatch(JSON.stringify(events.data), /\b\d{16}\b|"nik"|"nomor_kk"|"nomor_hp"/i);

  const profile = await admin.from("user_profiles").select("email").eq("username", "admin.disdagin").single();
  assert.ifError(profile.error);
  const browser = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const browserLogin = await browser.auth.signInWithPassword({ email: profile.data.email, password: disdaginPassword });
  assert.ifError(browserLogin.error);
  const anonHeaders = { apikey: publishableKey };
  const authHeaders = { apikey: publishableKey, Authorization: `Bearer ${browserLogin.data.session.access_token}` };
  for (const table of [
    "disdagin_pendamping", "disdagin_business_profiles", "disdagin_program_details", "disdagin_interventions", "disdagin_intervention_events",
    "disdagin_kemandirian_usaha", "disdagin_laporan_omzet",
  ]) {
    await expectDirectDenied(table, anonHeaders);
    await expectDirectDenied(table, authHeaders);
  }
  await browser.auth.signOut({ scope: "local" });

  console.log(JSON.stringify({
    login: "PASS", roleIsolation: "PASS", targetIsolation: "PASS",
    wrongProgramOpd: 400, wrongProgramPath: 400, fullQuota: 409,
    start: "PASS", duplicateStart: 409, progress: "PASS", progressBounds: "PASS",
    progressKeepsReferralProcessing: "PASS", completeBusiness: "PASS", invalidNib: 400,
    mismatchedBusinessProfile: 400,
    duplicateCompletion: 409, referralCompleted: "PASS", revenueReport: "REAL_DB_PASS",
    clientPii: 0, directDatabaseAccess: "BLOCKED",
  }, null, 2));
} finally {
  if (fixture) await cleanupDisdaginFixtures();
}
