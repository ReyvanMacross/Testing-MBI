import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import { cleanupDisdikFixtures, seedDisdikFixtures } from "./dev/disdik-fixture-lib.mjs";
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

const disdikCookie = await login(process.env.E2E_DISDIK_IDENTIFIER, process.env.E2E_DISDIK_PASSWORD);
const dinsosCookie = await login(process.env.E2E_DINSOS_IDENTIFIER ?? process.env.DINSOS_ADMIN_USERNAME, process.env.E2E_DINSOS_PASSWORD ?? process.env.DINSOS_ADMIN_PASSWORD);
const diskCookie = await login(process.env.E2E_ADMIN_IDENTIFIER ?? "admin.mbi", process.env.E2E_ADMIN_PASSWORD ?? process.env.SUPABASE_TEST_PASSWORD);
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const yesterday = new Date(`${today}T00:00:00Z`); yesterday.setUTCDate(yesterday.getUTCDate() - 1); const yesterdayText = yesterday.toISOString().slice(0, 10);

let fixture;
try {
  fixture = await seedDisdikFixtures();
  const primary = fixture.referrals.primary;
  const completion = fixture.referrals.completion;
  const wrongTarget = fixture.referrals.wrongTarget;
  const schoolId = fixture.schools["DEV-SCH-EDU-01"].id;
  const programId = fixture.programs["DEV-PRG-EDU-01"].id;
  const startPayload = {
    programId, schoolId, startDate: today, studentLevel: "SMP Kelas 8",
    aidItem: "Beasiswa operasional dan perlengkapan sekolah",
    actionPlan: "Rencana intervensi pendidikan terkontrol untuk peserta fixture Disdik.",
  };

  assert.equal((await mutation(`/api/disdik/referrals/${primary.referralId}/start`, "", startPayload)).status, 401);
  assert.equal((await mutation(`/api/disdik/referrals/${primary.referralId}/start`, dinsosCookie, startPayload)).status, 403);
  assert.equal((await mutation(`/api/disdik/referrals/${primary.referralId}/start`, diskCookie, startPayload)).status, 403);
  assert.equal((await mutation(`/api/disdik/referrals/${wrongTarget.referralId}/start`, disdikCookie, startPayload)).status, 403);
  assert.equal((await mutation(`/api/disdik/referrals/${primary.referralId}/start`, disdikCookie, { ...startPayload, programId: fixture.programs["DEV-PRG-DINSOS-EDU-WRONG"].id })).status, 400);
  assert.equal((await mutation(`/api/disdik/referrals/${primary.referralId}/start`, disdikCookie, { ...startPayload, programId: fixture.programs["DEV-PRG-EDU-PATH-WRONG"].id })).status, 400);

  const quotaPayload = { ...startPayload, programId: fixture.programs["DEV-PRG-EDU-QUOTA"].id, schoolId: fixture.schools["DEV-SCH-EDU-QUOTA"].id };
  const quotaWinner = await mutation(`/api/disdik/referrals/${fixture.referrals.quotaA.referralId}/start`, disdikCookie, quotaPayload);
  assert.equal(quotaWinner.status, 200, await quotaWinner.text());
  assert.equal((await mutation(`/api/disdik/referrals/${fixture.referrals.quotaB.referralId}/start`, disdikCookie, quotaPayload)).status, 409);

  const started = await mutation(`/api/disdik/referrals/${primary.referralId}/start`, disdikCookie, startPayload);
  const startedText = await started.text();
  assert.equal(started.status, 200, startedText);
  const startedBody = JSON.parse(startedText);
  assert.ok(startedBody.interventionId);
  assert.equal((await mutation(`/api/disdik/referrals/${primary.referralId}/start`, disdikCookie, startPayload)).status, 409);

  assert.equal((await mutation(`/api/disdik/interventions/${startedBody.interventionId}/progress`, disdikCookie, { progressPercent: 0, documentStatus: "MENUNGGU", realizedAmount: 0, evaluation: "Progress fixture pendidikan belum valid." }, "PATCH")).status, 400);
  assert.equal((await mutation(`/api/disdik/interventions/${startedBody.interventionId}/progress`, disdikCookie, { progressPercent: 101, documentStatus: "MENUNGGU", realizedAmount: 0, evaluation: "Progress fixture pendidikan belum valid." }, "PATCH")).status, 400);
  assert.equal((await mutation(`/api/disdik/interventions/${startedBody.interventionId}/progress`, disdikCookie, { progressPercent: 75, documentStatus: "LULUS", realizedAmount: 2500001, evaluation: "Realisasi di atas pagu harus ditolak oleh workflow Disdik." }, "PATCH")).status, 400);
  const progressed = await mutation(`/api/disdik/interventions/${startedBody.interventionId}/progress`, disdikCookie, { progressPercent: 75, documentStatus: "LULUS", realizedAmount: 1500000, evaluation: "Dokumen terverifikasi dan bantuan sedang disalurkan ke sekolah." }, "PATCH");
  assert.equal(progressed.status, 200, await progressed.text());
  const referralAfterProgress = await admin.from("referral_mbi").select("status").eq("id", primary.referralId).single();
  assert.ifError(referralAfterProgress.error); assert.equal(referralAfterProgress.data.status, "DIPROSES");

  const completionStart = await mutation(`/api/disdik/referrals/${completion.referralId}/start`, disdikCookie, startPayload);
  const completionStartText = await completionStart.text(); assert.equal(completionStart.status, 200, completionStartText);
  const completionBody = JSON.parse(completionStartText);
  const completionPayload = { realizedAmount: 2500000, completionDate: today, aidItem: "Beasiswa dan perlengkapan pendidikan selesai diterima", evaluation: "Bantuan pendidikan fixture selesai disalurkan dan diverifikasi." };
  assert.equal((await mutation(`/api/disdik/interventions/${completionBody.interventionId}/complete`, disdikCookie, { ...completionPayload, completionDate: yesterdayText })).status, 400);
  assert.equal((await mutation(`/api/disdik/interventions/${completionBody.interventionId}/complete`, disdikCookie, { ...completionPayload, realizedAmount: 2500001 })).status, 400);
  const completed = await mutation(`/api/disdik/interventions/${completionBody.interventionId}/complete`, disdikCookie, completionPayload);
  assert.equal(completed.status, 200, await completed.text());
  assert.equal((await mutation(`/api/disdik/interventions/${completionBody.interventionId}/complete`, disdikCookie, completionPayload)).status, 409);

  const [referralFinal, interventionRows, realizationRows, events] = await Promise.all([
    admin.from("referral_mbi").select("status,completed_at").eq("id", completion.referralId).single(),
    admin.from("disdik_interventions").select("id,aid_status,progress_percent,document_status").in("referral_id", [primary.referralId, completion.referralId]),
    admin.from("disdik_realisasi_bantuan").select("id,intervention_id,realized_amount").eq("intervention_id", completionBody.interventionId),
    admin.from("disdik_intervention_events").select("intervention_id,event_type,note").in("intervention_id", [startedBody.interventionId, completionBody.interventionId]),
  ]);
  for (const result of [referralFinal, interventionRows, realizationRows, events]) assert.ifError(result.error);
  assert.equal(referralFinal.data.status, "SELESAI"); assert.ok(referralFinal.data.completed_at);
  assert.equal(interventionRows.data.length, 2); assert.equal(realizationRows.data.length, 1);
  assert.equal(Number(realizationRows.data[0].realized_amount), 2500000);
  assert.ok(events.data.some((row) => row.intervention_id === startedBody.interventionId && row.event_type === "PROGRESS_UPDATED"));
  assert.ok(events.data.some((row) => row.intervention_id === completionBody.interventionId && row.event_type === "COMPLETED"));
  assert.doesNotMatch(JSON.stringify(events.data), /\b\d{16}\b|"nik"|"nomor_kk"|"nomor_hp"/iu);

  const profile = await admin.from("user_profiles").select("email").eq("username", "admin.disdik").single();
  assert.ifError(profile.error);
  const browser = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const browserLogin = await browser.auth.signInWithPassword({ email: profile.data.email, password: process.env.E2E_DISDIK_PASSWORD });
  assert.ifError(browserLogin.error);
  const anonHeaders = { apikey: publishableKey };
  const authHeaders = { apikey: publishableKey, Authorization: `Bearer ${browserLogin.data.session.access_token}` };
  for (const table of ["disdik_sekolah", "disdik_program_details", "disdik_interventions", "disdik_intervention_events", "disdik_realisasi_bantuan"]) {
    await expectDirectDenied(table, anonHeaders); await expectDirectDenied(table, authHeaders);
  }
  await browser.auth.signOut({ scope: "local" });

  console.log(JSON.stringify({ login: "PASS", roleIsolation: "PASS", targetIsolation: "PASS", wrongProgramOpd: 400, wrongProgramPath: 400, fullQuota: 409, start: "PASS", duplicateStart: 409, progress: "PASS", progressBounds: "PASS", progressKeepsReferralProcessing: "PASS", overBudget: 400, complete: "PASS", completionChronology: "PASS", duplicateCompletion: 409, referralCompleted: "PASS", reportSource: "REAL_DB_PASS", clientPii: 0, directDatabaseAccess: "BLOCKED" }, null, 2));
} finally {
  if (fixture) await cleanupDisdikFixtures();
}
