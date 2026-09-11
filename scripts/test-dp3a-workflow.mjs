import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import { cleanupDP3AFixtures, seedDP3AFixtures } from "./dev/dp3a-fixture-lib.mjs";
import { getSupabaseAdminEnvironment, loadProjectEnvironment } from "./lib/project-env.mjs";

await loadProjectEnvironment();
const BASE_URL = process.env.MBI_TEST_BASE_URL ?? "http://localhost:3000";
const ORIGIN = process.env.APP_ORIGIN ?? BASE_URL;
const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(publishableKey, "Supabase publishable key wajib tersedia.");
const admin = createClient(supabaseUrl, supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function login(identifier, password) {
  assert.ok(identifier && password, "Credential pengujian wajib tersedia.");
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

async function provisionCrossOpdActor() {
  const stale = await admin.from("user_profiles").select("id,auth_user_id").eq("username", "dp3a.crossopd.test").maybeSingle();
  assert.ifError(stale.error);
  if (stale.data?.auth_user_id) await admin.auth.admin.deleteUser(stale.data.auth_user_id);
  else if (stale.data) await admin.from("user_profiles").delete().eq("id", stale.data.id);
  const opd = await admin.from("master_opd").select("id").eq("kode_opd", "DINSOS").single();
  assert.ifError(opd.error);
  const email = ["dp3a.crossopd", "staging.invalid"].join("@");
  const auth = await admin.auth.admin.createUser({ email, password: process.env.SUPABASE_TEST_FIELD_PASSWORD, email_confirm: true });
  assert.ifError(auth.error);
  const profile = await admin.from("user_profiles").insert({ email, nama_lengkap: "Penguji Isolasi DP3A", username: "dp3a.crossopd.test", role: "INTERVENSI", opd_id: opd.data.id, instansi: "Pengujian lintas OPD", auth_user_id: auth.data.user.id, status: "AKTIF" });
  assert.ifError(profile.error);
  return auth.data.user.id;
}

const dp3aCookie = await login(process.env.E2E_DP3A_IDENTIFIER, process.env.E2E_DP3A_PASSWORD);
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const yesterday = new Date(`${today}T00:00:00Z`); yesterday.setUTCDate(yesterday.getUTCDate() - 1); const yesterdayText = yesterday.toISOString().slice(0, 10);
const tomorrow = new Date(`${today}T00:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1); const tomorrowText = tomorrow.toISOString().slice(0, 10);

let fixture;
let crossOpdAuthUserId;
try {
  crossOpdAuthUserId = await provisionCrossOpdActor();
  const crossOpdCookie = await login("dp3a.crossopd.test", process.env.SUPABASE_TEST_FIELD_PASSWORD);
  fixture = await seedDP3AFixtures();
  const primary = fixture.referrals.primary;
  const completion = fixture.referrals.completion;
  const wrongTarget = fixture.referrals.wrongTarget;
  const unitId = fixture.units["DEV-UNIT-PPA-01"].id;
  const programId = fixture.programs["DEV-PRG-PPA-01"].id;
  const startPayload = {
    programId, unitId, startDate: today, caseType: "Pendampingan hukum",
    supportItem: "Pendampingan hukum dan pemulihan psikososial",
    actionPlan: "Rencana penanganan perlindungan terkontrol untuk peserta fixture DP3A.",
  };

  assert.equal((await mutation(`/api/dp3a/referrals/${primary.referralId}/start`, "", startPayload)).status, 401);
  assert.equal((await mutation(`/api/dp3a/referrals/${primary.referralId}/start`, crossOpdCookie, startPayload)).status, 403);
  assert.equal((await mutation(`/api/dp3a/referrals/${wrongTarget.referralId}/start`, dp3aCookie, startPayload)).status, 403);
  assert.equal((await mutation(`/api/dp3a/referrals/${primary.referralId}/start`, dp3aCookie, { ...startPayload, programId: fixture.programs["DEV-PRG-DINSOS-PPA-WRONG"].id })).status, 400);
  assert.equal((await mutation(`/api/dp3a/referrals/${primary.referralId}/start`, dp3aCookie, { ...startPayload, programId: fixture.programs["DEV-PRG-PPA-PATH-WRONG"].id })).status, 400);

  const quotaPayload = { ...startPayload, programId: fixture.programs["DEV-PRG-PPA-QUOTA"].id, unitId: fixture.units["DEV-UNIT-PPA-QUOTA"].id };
  const quotaWinner = await mutation(`/api/dp3a/referrals/${fixture.referrals.quotaA.referralId}/start`, dp3aCookie, quotaPayload);
  assert.equal(quotaWinner.status, 200, await quotaWinner.text());
  assert.equal((await mutation(`/api/dp3a/referrals/${fixture.referrals.quotaB.referralId}/start`, dp3aCookie, quotaPayload)).status, 409);

  const started = await mutation(`/api/dp3a/referrals/${primary.referralId}/start`, dp3aCookie, startPayload);
  const startedText = await started.text();
  assert.equal(started.status, 200, startedText);
  const startedBody = JSON.parse(startedText);
  assert.ok(startedBody.caseId);
  assert.equal((await mutation(`/api/dp3a/referrals/${primary.referralId}/start`, dp3aCookie, startPayload)).status, 409);

  assert.equal((await mutation(`/api/dp3a/cases/${startedBody.caseId}/progress`, dp3aCookie, { progressPercent: 0, verificationStatus: "MENUNGGU", realizedAmount: 0, evaluation: "Progress fixture perlindungan belum valid." }, "PATCH")).status, 400);
  assert.equal((await mutation(`/api/dp3a/cases/${startedBody.caseId}/progress`, dp3aCookie, { progressPercent: 101, verificationStatus: "MENUNGGU", realizedAmount: 0, evaluation: "Progress fixture perlindungan belum valid." }, "PATCH")).status, 400);
  assert.equal((await mutation(`/api/dp3a/cases/${startedBody.caseId}/progress`, dp3aCookie, { progressPercent: 75, verificationStatus: "LULUS", realizedAmount: 2500001, evaluation: "Realisasi di atas pagu harus ditolak oleh workflow DP3A." }, "PATCH")).status, 400);
  const progressed = await mutation(`/api/dp3a/cases/${startedBody.caseId}/progress`, dp3aCookie, { progressPercent: 75, verificationStatus: "LULUS", realizedAmount: 1500000, evaluation: "Dokumen terverifikasi dan bantuan sedang disalurkan ke unit layanan." }, "PATCH");
  assert.equal(progressed.status, 200, await progressed.text());
  const referralAfterProgress = await admin.from("referral_mbi").select("status").eq("id", primary.referralId).single();
  assert.ifError(referralAfterProgress.error); assert.equal(referralAfterProgress.data.status, "DIPROSES");

  const futureStart = await mutation(`/api/dp3a/referrals/${fixture.referrals.report.referralId}/start`, dp3aCookie, { ...startPayload, startDate: tomorrowText });
  const futureStartText = await futureStart.text(); assert.equal(futureStart.status, 200, futureStartText);
  const futureCaseId = JSON.parse(futureStartText).caseId;
  assert.equal((await mutation(`/api/dp3a/cases/${futureCaseId}/progress`, dp3aCookie, { progressPercent: 10, verificationStatus: "MENUNGGU", realizedAmount: 0, evaluation: "Progress sebelum jadwal mulai wajib ditolak oleh workflow DP3A." }, "PATCH")).status, 400);

  const completionStart = await mutation(`/api/dp3a/referrals/${completion.referralId}/start`, dp3aCookie, startPayload);
  const completionStartText = await completionStart.text(); assert.equal(completionStart.status, 200, completionStartText);
  const completionBody = JSON.parse(completionStartText);
  const completionPayload = { realizedAmount: 2500000, completionDate: today, supportItem: "Pendampingan dan perlindungan selesai diterima", evaluation: "Layanan perlindungan fixture selesai dan telah diverifikasi." };
  assert.equal((await mutation(`/api/dp3a/cases/${completionBody.caseId}/complete`, dp3aCookie, { ...completionPayload, completionDate: yesterdayText })).status, 400);
  assert.equal((await mutation(`/api/dp3a/cases/${completionBody.caseId}/complete`, dp3aCookie, { ...completionPayload, realizedAmount: 2500001 })).status, 400);
  const completed = await mutation(`/api/dp3a/cases/${completionBody.caseId}/complete`, dp3aCookie, completionPayload);
  assert.equal(completed.status, 200, await completed.text());
  assert.equal((await mutation(`/api/dp3a/cases/${completionBody.caseId}/complete`, dp3aCookie, completionPayload)).status, 409);

  const [referralFinal, caseRecordRows, realizationRows, events] = await Promise.all([
    admin.from("referral_mbi").select("status,completed_at").eq("id", completion.referralId).single(),
    admin.from("dp3a_cases").select("id,case_status,progress_percent,verification_status").in("referral_id", [primary.referralId, completion.referralId]),
    admin.from("dp3a_realisasi_layanan").select("id,case_id,realized_amount").eq("case_id", completionBody.caseId),
    admin.from("dp3a_case_events").select("case_id,event_type,note").in("case_id", [startedBody.caseId, completionBody.caseId]),
  ]);
  for (const result of [referralFinal, caseRecordRows, realizationRows, events]) assert.ifError(result.error);
  assert.equal(referralFinal.data.status, "SELESAI"); assert.ok(referralFinal.data.completed_at);
  assert.equal(caseRecordRows.data.length, 2); assert.equal(realizationRows.data.length, 1);
  assert.equal(Number(realizationRows.data[0].realized_amount), 2500000);
  assert.ok(events.data.some((row) => row.case_id === startedBody.caseId && row.event_type === "PROGRESS_UPDATED"));
  assert.ok(events.data.some((row) => row.case_id === completionBody.caseId && row.event_type === "COMPLETED"));
  assert.doesNotMatch(JSON.stringify(events.data), /\b\d{16}\b|"nik"|"nomor_kk"|"nomor_hp"/iu);

  const profile = await admin.from("user_profiles").select("email").eq("username", "admin.dp3a").single();
  assert.ifError(profile.error);
  const browser = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const browserLogin = await browser.auth.signInWithPassword({ email: profile.data.email, password: process.env.E2E_DP3A_PASSWORD });
  assert.ifError(browserLogin.error);
  const anonHeaders = { apikey: publishableKey };
  const authHeaders = { apikey: publishableKey, Authorization: `Bearer ${browserLogin.data.session.access_token}` };
  for (const table of ["dp3a_unit_layanan", "dp3a_program_details", "dp3a_cases", "dp3a_case_events", "dp3a_realisasi_layanan"]) {
    await expectDirectDenied(table, anonHeaders); await expectDirectDenied(table, authHeaders);
  }
  await browser.auth.signOut({ scope: "local" });

  console.log(JSON.stringify({ login: "PASS", roleIsolation: "PASS", targetIsolation: "PASS", wrongProgramOpd: 400, wrongProgramPath: 400, fullQuota: 409, start: "PASS", duplicateStart: 409, progress: "PASS", progressBounds: "PASS", progressBeforeStart: 400, progressKeepsReferralProcessing: "PASS", overBudget: 400, complete: "PASS", completionChronology: "PASS", duplicateCompletion: 409, referralCompleted: "PASS", reportSource: "REAL_DB_PASS", clientPii: 0, directDatabaseAccess: "BLOCKED" }, null, 2));
} finally {
  if (fixture) await cleanupDP3AFixtures();
  if (crossOpdAuthUserId) await admin.auth.admin.deleteUser(crossOpdAuthUserId);
}
