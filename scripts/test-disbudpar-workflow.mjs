import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import { cleanupDisbudparFixtures, seedDisbudparFixtures } from "./dev/disbudpar-fixture-lib.mjs";
import { getSupabaseAdminEnvironment, loadProjectEnvironment } from "./lib/project-env.mjs";

await loadProjectEnvironment();
const BASE_URL = process.env.MBI_TEST_BASE_URL ?? "http://localhost:3000";
const ORIGIN = process.env.APP_ORIGIN ?? BASE_URL;
const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(publishableKey, "Supabase publishable key wajib tersedia.");
const admin = createClient(supabaseUrl, supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const disbudparIdentifier = process.env.E2E_DISBUDPAR_IDENTIFIER || process.env.DISBUDPAR_ADMIN_USERNAME || "admin.disbudpar";
const disbudparPassword = process.env.E2E_DISBUDPAR_PASSWORD || process.env.DISBUDPAR_ADMIN_PASSWORD || process.env.SUPABASE_TEST_ADMIN_PASSWORD;

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

const disbudparCookie = await login(
  disbudparIdentifier,
  disbudparPassword,
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
  fixture = await seedDisbudparFixtures();
  const primary = fixture.referrals.primary;
  const completion = fixture.referrals.completion;
  const wrongTarget = fixture.referrals.wrongTarget;
  const officerId = fixture.officers["DEV-PDB-01"].id;
  const programId = fixture.programs["DEV-PRG-BUD-01"].id;
  const wrongOpdProgramId = fixture.programs["DEV-PRG-DINSOS-WRONG"].id;
  const wrongPathProgramId = fixture.programs["DEV-PRG-PATH-WRONG"].id;
  const startPayload = {
    programId,
    pendampingId: officerId,
    groupName: "Sanggar Primer Development",
    creativeSubsector: "Kriya & Seni Pertunjukan",
    venueLocation: "Galeri Sukajadi Blok A",
    startDate: today,
    aidPackage: "Paket peralatan seni dan materi pembinaan terkontrol.",
    actionPlan: "Rencana pendampingan ekraf terkontrol untuk peserta fixture DISBUDPAR.",
  };

  const unauthenticated = await mutation(`/api/disbudpar/referrals/${primary.referralId}/start`, "", startPayload);
  assert.equal(unauthenticated.status, 401);
  const dinsosDenied = await mutation(`/api/disbudpar/referrals/${primary.referralId}/start`, dinsosCookie, startPayload);
  assert.equal(dinsosDenied.status, 403);
  const diskDenied = await mutation(`/api/disbudpar/referrals/${primary.referralId}/start`, diskCookie, startPayload);
  assert.equal(diskDenied.status, 403);
  const wrongTargetDenied = await mutation(`/api/disbudpar/referrals/${wrongTarget.referralId}/start`, disbudparCookie, startPayload);
  assert.equal(wrongTargetDenied.status, 403);
  const wrongOpdProgram = await mutation(`/api/disbudpar/referrals/${primary.referralId}/start`, disbudparCookie, { ...startPayload, programId: wrongOpdProgramId });
  assert.equal(wrongOpdProgram.status, 400);
  const wrongPathProgram = await mutation(`/api/disbudpar/referrals/${primary.referralId}/start`, disbudparCookie, { ...startPayload, programId: wrongPathProgramId });
  assert.equal(wrongPathProgram.status, 400);

  const quotaPayload = {
    programId: fixture.programs["DEV-PRG-BUD-QUOTA"].id,
    pendampingId: fixture.officers["DEV-PDB-02"].id,
    groupName: "Sanggar Kuota Pertama",
    creativeSubsector: "Kriya, Seni Rupa, dan Pertunjukan",
    venueLocation: "Galeri Kuota Blok A",
    startDate: today,
    aidPackage: "Paket peralatan seni untuk pengujian kuota internal.",
    actionPlan: "Rencana pengujian batas kuota program DISBUDPAR.",
  };
  const quotaWinner = await mutation(`/api/disbudpar/referrals/${fixture.referrals.quotaA.referralId}/start`, disbudparCookie, quotaPayload);
  assert.equal(quotaWinner.status, 200, await quotaWinner.text());
  const fullQuota = await mutation(`/api/disbudpar/referrals/${fixture.referrals.quotaB.referralId}/start`, disbudparCookie, { ...quotaPayload, groupName: "Sanggar Kuota Kedua", venueLocation: "Galeri Kuota Blok B" });
  assert.equal(fullQuota.status, 409);

  const started = await mutation(`/api/disbudpar/referrals/${primary.referralId}/start`, disbudparCookie, startPayload);
  const startedText = await started.text();
  assert.equal(started.status, 200, startedText);
  const startedBody = JSON.parse(startedText);
  assert.ok(startedBody.interventionId);
  const duplicateStart = await mutation(`/api/disbudpar/referrals/${primary.referralId}/start`, disbudparCookie, startPayload);
  assert.equal(duplicateStart.status, 409);

  const invalidLow = await mutation(`/api/disbudpar/interventions/${startedBody.interventionId}/progress`, disbudparCookie, {
    participantStatus: "AKTIF_PENDAMPINGAN", progressPercent: -1, creativeResultStatus: "BELUM_AKTIF", evaluation: "Evaluasi fixture progress DISBUDPAR.",
  }, "PATCH");
  assert.equal(invalidLow.status, 400);
  const invalidHigh = await mutation(`/api/disbudpar/interventions/${startedBody.interventionId}/progress`, disbudparCookie, {
    participantStatus: "AKTIF_PENDAMPINGAN", progressPercent: 101, creativeResultStatus: "BELUM_AKTIF", evaluation: "Evaluasi fixture progress DISBUDPAR.",
  }, "PATCH");
  assert.equal(invalidHigh.status, 400);
  const progressed = await mutation(`/api/disbudpar/interventions/${startedBody.interventionId}/progress`, disbudparCookie, {
    participantStatus: "AKTIF_PENDAMPINGAN", progressPercent: 75, creativeResultStatus: "AKTIF_TERBATAS", evaluation: "Peserta aktif mengikuti pendampingan ekraf dan pengembangan karya.",
  }, "PATCH");
  assert.equal(progressed.status, 200, await progressed.text());
  const referralAfterProgress = await admin.from("referral_mbi").select("status").eq("id", primary.referralId).single();
  assert.ifError(referralAfterProgress.error);
  assert.equal(referralAfterProgress.data.status, "DIPROSES");

  const completionStart = await mutation(`/api/disbudpar/referrals/${completion.referralId}/start`, disbudparCookie, { ...startPayload, groupName: "Sanggar Penyelesaian", venueLocation: "Galeri Pasteur Blok C" });
  const completionStartText = await completionStart.text();
  assert.equal(completionStart.status, 200, completionStartText);
  const completionBody = JSON.parse(completionStartText);
  const invalidAchievement = await mutation(`/api/disbudpar/interventions/${completionBody.interventionId}/complete`, disbudparCookie, {
    achievementValue: -1, completionDate: today,
    evaluation: "Evaluasi kemandirian fixture DISBUDPAR berhasil.",
  });
  assert.equal(invalidAchievement.status, 400);
  const completed = await mutation(`/api/disbudpar/interventions/${completionBody.interventionId}/complete`, disbudparCookie, {
    achievementValue: 4500000, completionDate: today,
    evaluation: "Peserta fixture berhasil menyelesaikan pendampingan ekraf dan seni.",
  });
  assert.equal(completed.status, 200, await completed.text());
  const duplicateComplete = await mutation(`/api/disbudpar/interventions/${completionBody.interventionId}/complete`, disbudparCookie, {
    achievementValue: 4500000, completionDate: today,
    evaluation: "Peserta fixture berhasil menyelesaikan pendampingan ekraf dan seni.",
  });
  assert.equal(duplicateComplete.status, 409);

  const [referralFinal, interventionRows, outcomeRows, reportRows, events] = await Promise.all([
    admin.from("referral_mbi").select("status,completed_at").eq("id", completion.referralId).single(),
    admin.from("disbudpar_interventions").select("id,participant_status,progress_percent,creative_result_status").in("referral_id", [primary.referralId, completion.referralId]),
    admin.from("disbudpar_kemandirian_ekraf").select("id,intervention_id,lokasi_sanggar,capaian_omzet_nilai_tampil").eq("intervention_id", completionBody.interventionId),
    admin.from("disbudpar_laporan_pembinaan").select("id,intervention_id,nominal,status").eq("intervention_id", completionBody.interventionId),
    admin.from("disbudpar_intervention_events").select("intervention_id,event_type,note").in("intervention_id", [startedBody.interventionId, completionBody.interventionId]),
  ]);
  for (const result of [referralFinal, interventionRows, outcomeRows, reportRows, events]) assert.ifError(result.error);
  assert.equal(referralFinal.data.status, "SELESAI");
  assert.ok(referralFinal.data.completed_at);
  assert.equal(interventionRows.data.length, 2);
  assert.equal(outcomeRows.data.length, 1);
  assert.equal(outcomeRows.data[0].lokasi_sanggar, "Galeri Pasteur Blok C");
  assert.equal(Number(outcomeRows.data[0].capaian_omzet_nilai_tampil), 4500000);
  assert.equal(reportRows.data.length, 1);
  assert.equal(Number(reportRows.data[0].nominal), 4500000);
  assert.ok(events.data.some((row) => row.intervention_id === startedBody.interventionId && row.event_type === "PROGRESS_UPDATED"));
  assert.ok(events.data.some((row) => row.intervention_id === completionBody.interventionId && row.event_type === "COMPLETED"));
  assert.doesNotMatch(JSON.stringify(events.data), /\b\d{16}\b|"nik"|"nomor_kk"|"nomor_hp"/i);

  const profile = await admin.from("user_profiles").select("email").eq("username", "admin.disbudpar").single();
  assert.ifError(profile.error);
  const browser = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const browserLogin = await browser.auth.signInWithPassword({ email: profile.data.email, password: disbudparPassword });
  assert.ifError(browserLogin.error);
  const anonHeaders = { apikey: publishableKey };
  const authHeaders = { apikey: publishableKey, Authorization: `Bearer ${browserLogin.data.session.access_token}` };
  for (const table of [
    "disbudpar_pendamping", "disbudpar_beneficiary_profiles", "disbudpar_program_details", "disbudpar_interventions", "disbudpar_intervention_events",
    "disbudpar_kemandirian_ekraf", "disbudpar_laporan_pembinaan",
  ]) {
    await expectDirectDenied(table, anonHeaders);
    await expectDirectDenied(table, authHeaders);
  }
  await browser.auth.signOut({ scope: "local" });

  console.log(JSON.stringify({
    login: "PASS", roleIsolation: "PASS", targetIsolation: "PASS",
    wrongProgramOpd: 400, wrongProgramPath: 400, fullQuota: 409,
    start: "PASS", duplicateStart: 409, progress: "PASS", progressBounds: "PASS",
    progressKeepsReferralProcessing: "PASS", completeCreativeAssistance: "PASS", invalidAchievement: 400,
    duplicateCompletion: 409, referralCompleted: "PASS", activityReport: "REAL_DB_PASS",
    clientPii: 0, directDatabaseAccess: "BLOCKED",
  }, null, 2));
} finally {
  if (fixture) await cleanupDisbudparFixtures();
}
