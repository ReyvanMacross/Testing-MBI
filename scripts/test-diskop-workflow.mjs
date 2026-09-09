import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import { cleanupDiskopFixtures, seedDiskopFixtures } from "./dev/diskop-fixture-lib.mjs";
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

const diskopCookie = await login(
  process.env.E2E_DISKOP_IDENTIFIER,
  process.env.E2E_DISKOP_PASSWORD,
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
  fixture = await seedDiskopFixtures();
  const primary = fixture.referrals.primary;
  const completion = fixture.referrals.completion;
  const wrongTarget = fixture.referrals.wrongTarget;
  const mentorId = fixture.mentors["DEV-PLUT-01"].id;
  const programId = fixture.programs["DEV-PRG-WIR-01"].id;
  const wrongOpdProgramId = fixture.programs["DEV-PRG-DINSOS-WRONG"].id;
  const wrongPathProgramId = fixture.programs["DEV-PRG-PATH-WRONG"].id;
  const startPayload = {
    programId,
    pendampingId: mentorId,
    startDate: today,
    stimulus: "Fasilitasi legalitas usaha terkontrol.",
    actionPlan: "Rencana pendampingan terkontrol untuk peserta fixture Diskop.",
  };

  const unauthenticated = await mutation(`/api/diskop/referrals/${primary.referralId}/start`, "", startPayload);
  assert.equal(unauthenticated.status, 401);
  const dinsosDenied = await mutation(`/api/diskop/referrals/${primary.referralId}/start`, dinsosCookie, startPayload);
  assert.equal(dinsosDenied.status, 403);
  const diskDenied = await mutation(`/api/diskop/referrals/${primary.referralId}/start`, diskCookie, startPayload);
  assert.equal(diskDenied.status, 403);
  const wrongTargetDenied = await mutation(`/api/diskop/referrals/${wrongTarget.referralId}/start`, diskopCookie, startPayload);
  assert.equal(wrongTargetDenied.status, 403);
  const wrongOpdProgram = await mutation(`/api/diskop/referrals/${primary.referralId}/start`, diskopCookie, { ...startPayload, programId: wrongOpdProgramId });
  assert.equal(wrongOpdProgram.status, 400);
  const wrongPathProgram = await mutation(`/api/diskop/referrals/${primary.referralId}/start`, diskopCookie, { ...startPayload, programId: wrongPathProgramId });
  assert.equal(wrongPathProgram.status, 400);

  const quotaPayload = {
    programId: fixture.programs["DEV-PRG-WIR-QUOTA"].id,
    pendampingId: fixture.mentors["DEV-PLUT-02"].id,
    startDate: today,
    stimulus: "Fasilitasi kuota pengujian internal.",
    actionPlan: "Rencana pengujian batas kuota program Diskop UKM.",
  };
  const quotaWinner = await mutation(`/api/diskop/referrals/${fixture.referrals.quotaA.referralId}/start`, diskopCookie, quotaPayload);
  assert.equal(quotaWinner.status, 200, await quotaWinner.text());
  const fullQuota = await mutation(`/api/diskop/referrals/${fixture.referrals.quotaB.referralId}/start`, diskopCookie, quotaPayload);
  assert.equal(fullQuota.status, 409);

  const started = await mutation(`/api/diskop/referrals/${primary.referralId}/start`, diskopCookie, startPayload);
  const startedText = await started.text();
  assert.equal(started.status, 200, startedText);
  const startedBody = JSON.parse(startedText);
  assert.ok(startedBody.interventionId);
  const duplicateStart = await mutation(`/api/diskop/referrals/${primary.referralId}/start`, diskopCookie, startPayload);
  assert.equal(duplicateStart.status, 409);

  const invalidLow = await mutation(`/api/diskop/interventions/${startedBody.interventionId}/progress`, diskopCookie, {
    participantStatus: "AKTIF_PENDAMPINGAN", progressPercent: -1, legalStatus: "BELUM", evaluation: "Evaluasi fixture progress Diskop UKM.",
  }, "PATCH");
  assert.equal(invalidLow.status, 400);
  const invalidHigh = await mutation(`/api/diskop/interventions/${startedBody.interventionId}/progress`, diskopCookie, {
    participantStatus: "AKTIF_PENDAMPINGAN", progressPercent: 101, legalStatus: "BELUM", evaluation: "Evaluasi fixture progress Diskop UKM.",
  }, "PATCH");
  assert.equal(invalidHigh.status, 400);
  const progressed = await mutation(`/api/diskop/interventions/${startedBody.interventionId}/progress`, diskopCookie, {
    participantStatus: "AKTIF_PENDAMPINGAN", progressPercent: 75, legalStatus: "PROSES_NIB_HALAL", evaluation: "Peserta aktif mengikuti seluruh modul pengujian usaha.",
  }, "PATCH");
  assert.equal(progressed.status, 200, await progressed.text());
  const referralAfterProgress = await admin.from("referral_mbi").select("status").eq("id", primary.referralId).single();
  assert.ifError(referralAfterProgress.error);
  assert.equal(referralAfterProgress.data.status, "DIPROSES");

  const completionStart = await mutation(`/api/diskop/referrals/${completion.referralId}/start`, diskopCookie, startPayload);
  const completionStartText = await completionStart.text();
  assert.equal(completionStart.status, 200, completionStartText);
  const completionBody = JSON.parse(completionStartText);
  const invalidNib = await mutation(`/api/diskop/interventions/${completionBody.interventionId}/complete`, diskopCookie, {
    nib: "123", monthlyRevenue: 4500000, completionDate: today,
    evaluation: "Evaluasi kemandirian fixture Diskop berhasil.",
  });
  assert.equal(invalidNib.status, 400);
  const completed = await mutation(`/api/diskop/interventions/${completionBody.interventionId}/complete`, diskopCookie, {
    nib: "9000000009001", monthlyRevenue: 4500000, completionDate: today,
    evaluation: "Peserta fixture berhasil menyelesaikan pendampingan usaha development.",
  });
  assert.equal(completed.status, 200, await completed.text());
  const duplicateComplete = await mutation(`/api/diskop/interventions/${completionBody.interventionId}/complete`, diskopCookie, {
    nib: "9000000009001", monthlyRevenue: 4500000, completionDate: today,
    evaluation: "Peserta fixture berhasil menyelesaikan pendampingan usaha development.",
  });
  assert.equal(duplicateComplete.status, 409);

  const [referralFinal, interventionRows, outcomeRows, revenueRows, events] = await Promise.all([
    admin.from("referral_mbi").select("status,completed_at").eq("id", completion.referralId).single(),
    admin.from("diskop_interventions").select("id,participant_status,progress_percent,legal_status").in("referral_id", [primary.referralId, completion.referralId]),
    admin.from("diskop_kemandirian_usaha").select("id,intervention_id,nib,omzet_bulanan").eq("intervention_id", completionBody.interventionId),
    admin.from("diskop_laporan_omzet").select("id,intervention_id,nominal,status").eq("intervention_id", completionBody.interventionId),
    admin.from("diskop_intervention_events").select("intervention_id,event_type,note").in("intervention_id", [startedBody.interventionId, completionBody.interventionId]),
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

  const profile = await admin.from("user_profiles").select("email").eq("username", "admin.diskop").single();
  assert.ifError(profile.error);
  const browser = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const browserLogin = await browser.auth.signInWithPassword({ email: profile.data.email, password: process.env.E2E_DISKOP_PASSWORD });
  assert.ifError(browserLogin.error);
  const anonHeaders = { apikey: publishableKey };
  const authHeaders = { apikey: publishableKey, Authorization: `Bearer ${browserLogin.data.session.access_token}` };
  for (const table of [
    "diskop_pendamping", "diskop_program_details", "diskop_interventions", "diskop_intervention_events",
    "diskop_kemandirian_usaha", "diskop_laporan_omzet",
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
    duplicateCompletion: 409, referralCompleted: "PASS", revenueReport: "REAL_DB_PASS",
    clientPii: 0, directDatabaseAccess: "BLOCKED",
  }, null, 2));
} finally {
  if (fixture) await cleanupDiskopFixtures();
}
