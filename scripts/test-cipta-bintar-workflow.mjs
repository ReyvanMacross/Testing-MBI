import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import { cleanupCiptaBintarFixtures, seedCiptaBintarFixtures } from "./dev/cipta-bintar-fixture-lib.mjs";
import { getSupabaseAdminEnvironment, loadProjectEnvironment } from "./lib/project-env.mjs";

await loadProjectEnvironment();
const BASE_URL = process.env.MBI_TEST_BASE_URL ?? "http://localhost:3000";
const ORIGIN = process.env.APP_ORIGIN ?? BASE_URL;
const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(publishableKey, "Supabase publishable key wajib tersedia.");
const admin = createClient(supabaseUrl, supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const ciptaBintarIdentifier = process.env.E2E_CIPTA_BINTAR_IDENTIFIER || process.env.CIPTA_BINTAR_ADMIN_USERNAME || "admin.cipta-bintar";
const ciptaBintarPassword = process.env.E2E_CIPTA_BINTAR_PASSWORD || process.env.CIPTA_BINTAR_ADMIN_PASSWORD || process.env.SUPABASE_TEST_ADMIN_PASSWORD;

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

const ciptaBintarCookie = await login(
  ciptaBintarIdentifier,
  ciptaBintarPassword,
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
  fixture = await seedCiptaBintarFixtures();
  const primary = fixture.referrals.primary;
  const completion = fixture.referrals.completion;
  const wrongTarget = fixture.referrals.wrongTarget;
  const officerId = fixture.officers["DEV-PINF-01"].id;
  const programId = fixture.programs["DEV-PRG-INF-01"].id;
  const wrongOpdProgramId = fixture.programs["DEV-PRG-DINSOS-WRONG"].id;
  const wrongPathProgramId = fixture.programs["DEV-PRG-PATH-WRONG"].id;
  const startPayload = {
    programId,
    petugasId: officerId,
    objectAddress: "Lokasi objek sintetis Sukajadi",
    infrastructureCategory: "Rehabilitasi Rutilahu",
    objectLocation: "Sukajadi Blok A",
    startDate: today,
    aidPackage: "Perbaikan atap, dinding, lantai, dan sanitasi keluarga.",
    allocatedBudget: 25000000,
    actionPlan: "Rencana rehabilitasi fisik terkontrol untuk unit rumah fixture CIPTA_BINTAR.",
  };

  const unauthenticated = await mutation(`/api/cipta-bintar/referrals/${primary.referralId}/start`, "", startPayload);
  assert.equal(unauthenticated.status, 401);
  const dinsosDenied = await mutation(`/api/cipta-bintar/referrals/${primary.referralId}/start`, dinsosCookie, startPayload);
  assert.equal(dinsosDenied.status, 403);
  const diskDenied = await mutation(`/api/cipta-bintar/referrals/${primary.referralId}/start`, diskCookie, startPayload);
  assert.equal(diskDenied.status, 403);
  const wrongTargetDenied = await mutation(`/api/cipta-bintar/referrals/${wrongTarget.referralId}/start`, ciptaBintarCookie, startPayload);
  assert.equal(wrongTargetDenied.status, 403);
  const wrongOpdProgram = await mutation(`/api/cipta-bintar/referrals/${primary.referralId}/start`, ciptaBintarCookie, { ...startPayload, programId: wrongOpdProgramId });
  assert.equal(wrongOpdProgram.status, 400);
  const wrongPathProgram = await mutation(`/api/cipta-bintar/referrals/${primary.referralId}/start`, ciptaBintarCookie, { ...startPayload, programId: wrongPathProgramId });
  assert.equal(wrongPathProgram.status, 400);

  const quotaPayload = {
    programId: fixture.programs["DEV-PRG-INF-QUOTA"].id,
    petugasId: fixture.officers["DEV-PINF-02"].id,
    objectAddress: "Lokasi Infrastruktur Kuota Pertama",
    infrastructureCategory: "Sambungan Air Bersih",
    objectLocation: "Sekeloa Blok A",
    startDate: today,
    aidPackage: "Pemasangan pipa distribusi dan meteran air.",
    allocatedBudget: 8500000,
    actionPlan: "Rencana pengujian batas kuota program CIPTA_BINTAR.",
  };
  const quotaWinner = await mutation(`/api/cipta-bintar/referrals/${fixture.referrals.quotaA.referralId}/start`, ciptaBintarCookie, quotaPayload);
  assert.equal(quotaWinner.status, 200, await quotaWinner.text());
  const fullQuota = await mutation(`/api/cipta-bintar/referrals/${fixture.referrals.quotaB.referralId}/start`, ciptaBintarCookie, { ...quotaPayload, objectAddress: "Lokasi Infrastruktur Kuota Kedua", objectLocation: "Sekeloa Blok B" });
  assert.equal(fullQuota.status, 409);

  const started = await mutation(`/api/cipta-bintar/referrals/${primary.referralId}/start`, ciptaBintarCookie, startPayload);
  const startedText = await started.text();
  assert.equal(started.status, 200, startedText);
  const startedBody = JSON.parse(startedText);
  assert.ok(startedBody.interventionId);
  const duplicateStart = await mutation(`/api/cipta-bintar/referrals/${primary.referralId}/start`, ciptaBintarCookie, startPayload);
  assert.equal(duplicateStart.status, 409);

  const invalidLow = await mutation(`/api/cipta-bintar/interventions/${startedBody.interventionId}/progress`, ciptaBintarCookie, {
    participantStatus: "DALAM_PENGERJAAN", progressPercent: -1, feasibilityStatus: "BELUM_DIVERIFIKASI", evaluation: "Evaluasi fixture progress CIPTA_BINTAR.",
  }, "PATCH");
  assert.equal(invalidLow.status, 400);
  const invalidHigh = await mutation(`/api/cipta-bintar/interventions/${startedBody.interventionId}/progress`, ciptaBintarCookie, {
    participantStatus: "DALAM_PENGERJAAN", progressPercent: 101, feasibilityStatus: "BELUM_DIVERIFIKASI", evaluation: "Evaluasi fixture progress CIPTA_BINTAR.",
  }, "PATCH");
  assert.equal(invalidHigh.status, 400);
  const progressed = await mutation(`/api/cipta-bintar/interventions/${startedBody.interventionId}/progress`, ciptaBintarCookie, {
    participantStatus: "DALAM_PENGERJAAN", progressPercent: 75, feasibilityStatus: "PROGRES_FISIK", evaluation: "Perbaikan atap dan pasangan dinding telah mencapai 75 persen.",
  }, "PATCH");
  assert.equal(progressed.status, 200, await progressed.text());
  const referralAfterProgress = await admin.from("referral_mbi").select("status").eq("id", primary.referralId).single();
  assert.ifError(referralAfterProgress.error);
  assert.equal(referralAfterProgress.data.status, "DIPROSES");

  const completionStart = await mutation(`/api/cipta-bintar/referrals/${completion.referralId}/start`, ciptaBintarCookie, { ...startPayload, objectAddress: "Rumah Penyelesaian", objectLocation: "Pasteur Blok C" });
  const completionStartText = await completionStart.text();
  assert.equal(completionStart.status, 200, completionStartText);
  const completionBody = JSON.parse(completionStartText);
  const invalidAchievement = await mutation(`/api/cipta-bintar/interventions/${completionBody.interventionId}/complete`, ciptaBintarCookie, {
    realizationValue: -1, completionDate: today,
    evaluation: "Evaluasi kemandirian fixture CIPTA_BINTAR berhasil.",
  });
  assert.equal(invalidAchievement.status, 400);
  const completed = await mutation(`/api/cipta-bintar/interventions/${completionBody.interventionId}/complete`, ciptaBintarCookie, {
    realizationValue: 4500000, completionDate: today,
    evaluation: "Unit fixture telah selesai direhabilitasi dan dinyatakan layak huni.",
  });
  assert.equal(completed.status, 200, await completed.text());
  const duplicateComplete = await mutation(`/api/cipta-bintar/interventions/${completionBody.interventionId}/complete`, ciptaBintarCookie, {
    realizationValue: 4500000, completionDate: today,
    evaluation: "Unit fixture telah selesai direhabilitasi dan dinyatakan layak huni.",
  });
  assert.equal(duplicateComplete.status, 409);

  const [referralFinal, interventionRows, outcomeRows, reportRows, events] = await Promise.all([
    admin.from("referral_mbi").select("status,completed_at").eq("id", completion.referralId).single(),
    admin.from("cipta_bintar_interventions").select("id,participant_status,progress_percent,feasibility_status").in("referral_id", [primary.referralId, completion.referralId]),
    admin.from("cipta_bintar_realisasi_infrastruktur").select("id,intervention_id,lokasi_objek,realisasi_anggaran").eq("intervention_id", completionBody.interventionId),
    admin.from("cipta_bintar_laporan_realisasi").select("id,intervention_id,nominal,status").eq("intervention_id", completionBody.interventionId),
    admin.from("cipta_bintar_intervention_events").select("intervention_id,event_type,note").in("intervention_id", [startedBody.interventionId, completionBody.interventionId]),
  ]);
  for (const result of [referralFinal, interventionRows, outcomeRows, reportRows, events]) assert.ifError(result.error);
  assert.equal(referralFinal.data.status, "SELESAI");
  assert.ok(referralFinal.data.completed_at);
  assert.equal(interventionRows.data.length, 2);
  assert.equal(outcomeRows.data.length, 1);
  assert.equal(outcomeRows.data[0].lokasi_objek, "Pasteur Blok C");
  assert.equal(Number(outcomeRows.data[0].realisasi_anggaran), 4500000);
  assert.equal(reportRows.data.length, 1);
  assert.equal(Number(reportRows.data[0].nominal), 4500000);
  assert.ok(events.data.some((row) => row.intervention_id === startedBody.interventionId && row.event_type === "PROGRESS_UPDATED"));
  assert.ok(events.data.some((row) => row.intervention_id === completionBody.interventionId && row.event_type === "COMPLETED"));
  assert.doesNotMatch(JSON.stringify(events.data), /\b\d{16}\b|"nik"|"nomor_kk"|"nomor_hp"/i);

  const profile = await admin.from("user_profiles").select("email").eq("username", "admin.cipta-bintar").single();
  assert.ifError(profile.error);
  const browser = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const browserLogin = await browser.auth.signInWithPassword({ email: profile.data.email, password: ciptaBintarPassword });
  assert.ifError(browserLogin.error);
  const anonHeaders = { apikey: publishableKey };
  const authHeaders = { apikey: publishableKey, Authorization: `Bearer ${browserLogin.data.session.access_token}` };
  for (const table of [
    "cipta_bintar_petugas", "cipta_bintar_beneficiary_profiles", "cipta_bintar_program_details", "cipta_bintar_interventions", "cipta_bintar_intervention_events",
    "cipta_bintar_realisasi_infrastruktur", "cipta_bintar_laporan_realisasi",
  ]) {
    await expectDirectDenied(table, anonHeaders);
    await expectDirectDenied(table, authHeaders);
  }
  await browser.auth.signOut({ scope: "local" });

  console.log(JSON.stringify({
    login: "PASS", roleIsolation: "PASS", targetIsolation: "PASS",
    wrongProgramOpd: 400, wrongProgramPath: 400, fullQuota: 409,
    start: "PASS", duplicateStart: 409, progress: "PASS", progressBounds: "PASS",
    progressKeepsReferralProcessing: "PASS", completeInfrastructureWork: "PASS", invalidAchievement: 400,
    duplicateCompletion: 409, referralCompleted: "PASS", activityReport: "REAL_DB_PASS",
    clientPii: 0, directDatabaseAccess: "BLOCKED",
  }, null, 2));
} finally {
  if (fixture) await cleanupCiptaBintarFixtures();
}
