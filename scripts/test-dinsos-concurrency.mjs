import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import {
  cleanupDinsosAssessmentFixtures,
  seedDinsosAssessmentFixtures,
} from "./dev/dinsos-assessment-fixture-lib.mjs";
import {
  cleanupDinsosFixtures,
  seedDinsosFixtures,
} from "./dev/dinsos-fixture-lib.mjs";
import {
  cleanupDinsosPathFixtures,
  seedDinsosPathFixtures,
} from "./dev/dinsos-path-fixture-lib.mjs";
import { DEV_PROGRAMS } from "./dev/dinsos-program-fixture-lib.mjs";
import {
  cleanupDinsosReferralFixtures,
  seedDinsosReferralFixtures,
} from "./dev/dinsos-referral-fixture-lib.mjs";
import {
  getSupabaseAdminEnvironment,
  loadProjectEnvironment,
} from "./lib/project-env.mjs";

await loadProjectEnvironment();
const BASE_URL = process.env.MBI_TEST_BASE_URL ?? "http://localhost:3000";
const ORIGIN = process.env.APP_ORIGIN ?? BASE_URL;
const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const admin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function login() {
  const identifier = process.env.DINSOS_ADMIN_USERNAME ?? process.env.E2E_DINSOS_IDENTIFIER;
  const password = process.env.DINSOS_ADMIN_PASSWORD ?? process.env.E2E_DINSOS_PASSWORD;
  assert.ok(identifier && password, "Credential Admin Dinsos wajib tersedia.");
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
      "Sec-Fetch-Site": "same-origin",
    },
    body: JSON.stringify({ identifier, password }),
  });
  assert.equal(response.status, 200, await response.text());
  return response.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
}

function mutation(path, cookie, body, method = "POST") {
  return fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      Origin: ORIGIN,
      "Sec-Fetch-Site": "same-origin",
    },
    body: JSON.stringify(body),
  });
}

async function concurrentStatuses(requestA, requestB) {
  const results = await Promise.allSettled([requestA(), requestB()]);
  assert.ok(results.every((result) => result.status === "fulfilled"));
  return results.map((result) => result.value.status).sort((a, b) => a - b);
}

const assessmentPayload = {
  rentangPendapatan: "Konfigurasi lokal terverifikasi",
  statusBekerja: "TIDAK_BEKERJA",
  jenisPekerjaan: null,
  penghasilanBulanan: "Belum berpenghasilan",
  pendidikanTertinggi: "SMA",
  literasiDigital: "CUKUP",
  penyakitKronisDisabilitas: "TIDAK_ADA",
  penyakitDetail: null,
  balitaStunting: "TIDAK_ADA_BALITA",
  lansiaTanpaPendamping: "TIDAK",
  anakPutusSekolahCount: 0,
  kelayakanRumah: "LAYAK",
  airSanitasi: "MEMADAI",
  nikValid: true,
  kkTerbaru: true,
  bpjsAktif: true,
  rekeningBank: false,
  motivasiPerubahan: 4,
  keterampilan: "Keterampilan fixture concurrency",
  catatanPetugas: null,
};

const cookie = await login();
const results = {};

try {
  const fixture = await seedDinsosFixtures();
  try {
    const statuses = await concurrentStatuses(
      () => mutation(`/api/dinsos/cases/${fixture.workflow}/assessment/complete`, cookie, assessmentPayload),
      () => mutation(`/api/dinsos/cases/${fixture.workflow}/assessment/complete`, cookie, assessmentPayload),
    );
    assert.deepEqual(statuses, [200, 409]);
    const [assessment, events] = await Promise.all([
      admin.from("dinsos_asesmen_sosial").select("id,status").eq("case_id", fixture.workflow),
      admin.from("dinsos_case_events").select("id").eq("case_id", fixture.workflow).eq("event_type", "ASSESSMENT_COMPLETED"),
    ]);
    assert.ifError(assessment.error);
    assert.ifError(events.error);
    assert.equal(assessment.data.length, 1);
    assert.equal(assessment.data[0].status, "COMPLETED");
    assert.equal(events.data.length, 1);
    results.assessmentCompletion = "1 success / 1 conflict / 1 event";
  } finally {
    await cleanupDinsosFixtures();
  }

  const assessmentFixtures = await seedDinsosAssessmentFixtures();
  try {
    const dinsosOpd = await admin.from("master_opd").select("id").eq("kode_opd", "DINSOS").single();
    assert.ifError(dinsosOpd.error);
    const reviewBody = {
      decision: "APPROVED",
      path: "PENGUATAN_DASAR",
      targetOpdId: dinsosOpd.data.id,
      note: "Keputusan concurrency telah diverifikasi oleh supervisor Dinsos.",
    };
    const statuses = await concurrentStatuses(
      () => mutation(`/api/dinsos/assessments/${assessmentFixtures.needsReview.id}/review`, cookie, reviewBody),
      () => mutation(`/api/dinsos/assessments/${assessmentFixtures.needsReview.id}/review`, cookie, reviewBody),
    );
    assert.deepEqual(statuses, [200, 409]);
    const reviews = await admin.from("dinsos_assessment_reviews").select("id").eq("assessment_id", assessmentFixtures.needsReview.id);
    assert.ifError(reviews.error);
    assert.equal(reviews.data.length, 1);
    results.supervisorReview = "1 success / 1 conflict / 1 review";
  } finally {
    await cleanupDinsosAssessmentFixtures();
  }

  const pathFixtures = await seedDinsosPathFixtures();
  try {
    const body = {
      path: "WIRAUSAHA",
      targetOpdId: pathFixtures.wirausaha.targetOpdId,
      referralNote: "Instruksi fixture concurrency tanpa data pribadi.",
    };
    const statuses = await concurrentStatuses(
      () => mutation(`/api/dinsos/cases/${pathFixtures.wirausaha.caseId}/path/publish`, cookie, body),
      () => mutation(`/api/dinsos/cases/${pathFixtures.wirausaha.caseId}/path/publish`, cookie, body),
    );
    assert.deepEqual(statuses, [201, 409]);
    const [paths, referrals] = await Promise.all([
      admin.from("penentuan_jalur").select("id").eq("assessment_id", pathFixtures.wirausaha.assessmentId),
      admin.from("referral_mbi").select("id,status").eq("assessment_id", pathFixtures.wirausaha.assessmentId),
    ]);
    assert.ifError(paths.error);
    assert.ifError(referrals.error);
    assert.equal(paths.data.length, 1);
    assert.equal(referrals.data.length, 1);
    const createdEvents = await admin.from("referral_mbi_events").select("id").eq("referral_id", referrals.data[0].id).eq("event_type", "CREATED");
    assert.ifError(createdEvents.error);
    assert.equal(createdEvents.data.length, 1);
    results.pathPublish = "1 success / 1 conflict / 1 path / 1 referral / 1 CREATED";
  } finally {
    await cleanupDinsosPathFixtures();
  }

  const referralFixtures = await seedDinsosReferralFixtures();
  try {
    const waitingProgram = await admin.from("master_program_layanan").select("id").eq("kode_program", DEV_PROGRAMS[0].code).single();
    assert.ifError(waitingProgram.error);
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const body = {
      programId: waitingProgram.data.id,
      referralDate: today,
      instruction: "Instruksi fixture concurrency tanpa data pribadi.",
    };
    const sendStatuses = await concurrentStatuses(
      () => mutation(`/api/dinsos/referrals/${referralFixtures.waiting.referralId}/send`, cookie, body),
      () => mutation(`/api/dinsos/referrals/${referralFixtures.waiting.referralId}/send`, cookie, body),
    );
    assert.deepEqual(sendStatuses, [200, 409]);
    const sentRow = await admin.from("referral_mbi").select("sent_at").eq("id", referralFixtures.waiting.referralId).single();
    const sentEvents = await admin.from("referral_mbi_events").select("id").eq("referral_id", referralFixtures.waiting.referralId).eq("event_type", "SENT");
    assert.ifError(sentRow.error);
    assert.ifError(sentEvents.error);
    assert.ok(sentRow.data.sent_at);
    assert.equal(sentEvents.data.length, 1);
    results.referralSend = "1 success / 1 conflict / 1 SENT";

    const transition = () => admin.rpc("transition_referral_status", {
      p_referral_id: referralFixtures.sent.referralId,
      p_to_status: "DITERIMA",
      p_actor_user_id: null,
      p_actor_opd_id: referralFixtures.sent.targetOpdId,
      p_note: "Fixture concurrency lifecycle.",
    });
    const transitions = await Promise.allSettled([transition(), transition()]);
    assert.ok(transitions.every((result) => result.status === "fulfilled"));
    const transitionResults = transitions.map((result) => result.value);
    assert.equal(transitionResults.filter((result) => !result.error).length, 1);
    assert.equal(transitionResults.filter((result) => result.error).length, 1);
    const receivedEvents = await admin.from("referral_mbi_events").select("id").eq("referral_id", referralFixtures.sent.referralId).eq("event_type", "RECEIVED");
    assert.ifError(receivedEvents.error);
    assert.equal(receivedEvents.data.length, 1);
    results.opdTransition = "1 success / 1 invalid transition / 1 RECEIVED";
  } finally {
    await cleanupDinsosReferralFixtures();
  }

  const warga = await admin
    .from("warga")
    .select("id,nama_lengkap,kelurahan_id,status_perkawinan,alamat_lengkap,pekerjaan,updated_at")
    .order("id")
    .limit(1)
    .single();
  assert.ifError(warga.error);
  const original = warga.data;
  try {
    const temporaryName = `${original.nama_lengkap.slice(0, 180)} Uji Kunci`;
    const payload = {
      namaLengkap: temporaryName,
      kelurahanId: original.kelurahan_id,
      statusPerkawinan: original.status_perkawinan,
      alamatLengkap: original.alamat_lengkap,
      pekerjaan: original.pekerjaan,
      expectedUpdatedAt: original.updated_at,
    };
    const statuses = await concurrentStatuses(
      () => mutation(`/api/dinsos/warga/${original.id}`, cookie, payload, "PATCH"),
      () => mutation(`/api/dinsos/warga/${original.id}`, cookie, payload, "PATCH"),
    );
    assert.deepEqual(statuses, [200, 409]);
    results.wargaOptimisticLock = "1 success / 1 conflict";
  } finally {
    const restored = await admin.from("warga").update({ nama_lengkap: original.nama_lengkap }).eq("id", original.id);
    assert.ifError(restored.error);
  }

  console.log(JSON.stringify({ summary: "PASS", ...results }, null, 2));
} finally {
  await cleanupDinsosReferralFixtures();
  await cleanupDinsosPathFixtures();
  await cleanupDinsosFixtures();
  await cleanupDinsosAssessmentFixtures();
}
