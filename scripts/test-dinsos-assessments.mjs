import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";

import {
  cleanupDinsosAssessmentFixtures,
  seedDinsosAssessmentFixtures,
} from "./dev/dinsos-assessment-fixture-lib.mjs";
import {
  cleanupDinsosFixtures,
  seedDinsosFixtures,
  validAssessment,
} from "./dev/dinsos-fixture-lib.mjs";
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
const createdIds = [];

async function login(identifier, password) {
  assert.ok(identifier && password, "Credential test wajib tersedia.");
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

function post(path, cookie, body) {
  return fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      Origin: ORIGIN,
      "Sec-Fetch-Site": "same-origin",
    },
    body: JSON.stringify(body),
  });
}

async function createAssessment(cookie, body, expectedStatus = 201) {
  const response = await post("/api/dinsos/assessments", cookie, body);
  const result = await response.json().catch(() => ({}));
  assert.equal(response.status, expectedStatus, JSON.stringify(result));
  if (result.assessmentId) createdIds.push(result.assessmentId);
  return result;
}

const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const tomorrowDate = new Date(`${today}T12:00:00+07:00`);
tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
const tomorrow = tomorrowDate.toISOString().slice(0, 10);

try {
  const fixture = await seedDinsosAssessmentFixtures();
  const { data: citizens, error: citizensError } = await admin
    .from("warga")
    .select("id,nik,nama_lengkap")
    .order("id")
    .limit(6);
  assert.ifError(citizensError);
  assert.ok(citizens?.length >= 6);
  const officialBefore = await admin
    .from("penetapan_desil")
    .select("id,warga_id,desil_dtsen,created_at")
    .order("id");
  assert.ifError(officialBefore.error);

  const summary = await admin.rpc("dinsos_assessment_summary");
  assert.ifError(summary.error);
  const [total, needsReview, reconciled] = await Promise.all([
    admin.from("dinsos_assessments").select("id", { count: "exact", head: true }),
    admin.from("dinsos_assessments").select("id", { count: "exact", head: true }).eq("status", "PERLU_REVIEW"),
    admin.from("dinsos_assessments").select("id", { count: "exact", head: true }).eq("status", "DISETUJUI"),
  ]);
  for (const result of [total, needsReview, reconciled]) assert.ifError(result.error);
  assert.equal(Number(summary.data.needsReview), needsReview.count);
  assert.equal(Number(summary.data.reconciledToPath), reconciled.count);
  assert.ok(Number(summary.data.totalThisYear) <= total.count);

  const sample = fixture.approvedWirausaha;
  for (const search of [sample.assessment_code, citizens[0].nama_lengkap, citizens[0].nik]) {
    const result = await admin.rpc("list_dinsos_assessments", {
      p_search: search,
      p_limit: 3,
      p_offset: 0,
    });
    assert.ifError(result.error);
    assert.ok(result.data.length > 0, `Search failed for ${search === citizens[0].nik ? "NIK" : "text"}`);
  }
  for (const filter of [
    { p_type: "KEBUTUHAN_DASAR" },
    { p_path: "WIRAUSAHA" },
    { p_status: "DISETUJUI" },
  ]) {
    const result = await admin.rpc("list_dinsos_assessments", { ...filter, p_limit: 3, p_offset: 0 });
    assert.ifError(result.error);
    assert.ok(result.data.length > 0);
  }
  const paged = await admin.rpc("list_dinsos_assessments", { p_limit: 3, p_offset: 3 });
  assert.ifError(paged.error);
  assert.ok(paged.data.length > 0);

  const dinsosCookie = await login(process.env.DINSOS_ADMIN_USERNAME, process.env.DINSOS_ADMIN_PASSWORD);
  const diskCookie = await login(
    process.env.E2E_ADMIN_IDENTIFIER ?? "admin.mbi",
    process.env.E2E_ADMIN_PASSWORD ?? process.env.SUPABASE_TEST_PASSWORD,
  );
  const registryPage = await fetch(`${BASE_URL}/dinsos/asesmen`, { headers: { Cookie: dinsosCookie } });
  const registryHtml = await registryPage.text();
  assert.equal(registryPage.status, 200);
  assert.ok(!registryHtml.includes(citizens[0].nik), "NIK penuh tidak boleh masuk registry HTML.");
  assert.match(registryHtml, /x{4,}/);

  const baseInput = {
    wargaId: citizens[4].id,
    assessmentDate: today,
    observation: "Observasi pengujian asesmen yang memenuhi batas minimum karakter.",
    recommendation: "WIRAUSAHA",
  };
  await createAssessment(dinsosCookie, { ...baseInput, assessmentTypeCode: "INTERVENSI_MBI" });
  await createAssessment(dinsosCookie, { ...baseInput, assessmentTypeCode: "INTERVENSI_MBI", recommendation: null }, 400);
  await createAssessment(dinsosCookie, { ...baseInput, wargaId: citizens[5].id, assessmentTypeCode: "KEBUTUHAN_DASAR", recommendation: null });
  await createAssessment(dinsosCookie, { ...baseInput, assessmentTypeCode: "KEBUTUHAN_DASAR", assessmentDate: tomorrow }, 400);
  await createAssessment(dinsosCookie, { ...baseInput, assessmentTypeCode: "KEBUTUHAN_DASAR", observation: "terlalu pendek" }, 400);

  const reviewPath = `/api/dinsos/assessments/${fixture.needsReview.id}/review`;
  const approveBody = {
    decision: "APPROVED",
    path: "PENGUATAN_DASAR",
    targetOpdId: (await admin.from("master_opd").select("id").eq("kode_opd", "DINSOS").single()).data.id,
    note: "Keputusan supervisor sudah diverifikasi dalam pengujian.",
  };
  assert.equal((await post(reviewPath, "", approveBody)).status, 401);
  assert.equal((await post(reviewPath, diskCookie, approveBody)).status, 403);
  const profileId = process.env.DINSOS_ADMIN_PROFILE_ID;
  assert.ok(profileId);
  try {
    const removed = await admin.from("user_capabilities").delete().eq("user_id", profileId).eq("capability", "DINSOS_ASSESSMENT_REVIEW");
    assert.ifError(removed.error);
    assert.equal((await post(reviewPath, dinsosCookie, approveBody)).status, 403);
  } finally {
    const restored = await admin.from("user_capabilities").upsert({ user_id: profileId, capability: "DINSOS_ASSESSMENT_REVIEW", granted_by: profileId }, { onConflict: "user_id,capability" });
    assert.ifError(restored.error);
  }
  assert.equal((await post(reviewPath, dinsosCookie, approveBody)).status, 200);
  assert.equal((await post(reviewPath, dinsosCookie, approveBody)).status, 409);

  const requestCandidate = await createAssessment(dinsosCookie, {
    ...baseInput,
    wargaId: citizens[3].id,
    assessmentTypeCode: "KEBUTUHAN_DASAR",
    recommendation: null,
  });
  const requestResponse = await post(
    `/api/dinsos/assessments/${requestCandidate.assessmentId}/review`,
    dinsosCookie,
    { decision: "REQUEST_REASSESSMENT", note: "Mohon lengkapi kembali observasi lapangan warga ini." },
  );
  assert.equal(requestResponse.status, 200, await requestResponse.text());

  await createAssessment(dinsosCookie, {
    ...baseInput,
    wargaId: citizens[2].id,
    assessmentTypeCode: "INTERVENSI_MBI",
    reassessmentOf: fixture.needsReassessment.id,
  }, 409);
  await createAssessment(dinsosCookie, {
    ...baseInput,
    wargaId: fixture.approvedPekerja.warga_id,
    assessmentTypeCode: "INTERVENSI_MBI",
    reassessmentOf: fixture.approvedPekerja.id,
  }, 409);
  await createAssessment(dinsosCookie, {
    ...baseInput,
    wargaId: fixture.needsReassessment.warga_id,
    assessmentTypeCode: "INTERVENSI_MBI",
    reassessmentOf: fixture.needsReassessment.id,
  });

  const workflow = await seedDinsosFixtures();
  const actor = await admin.from("user_profiles").select("id").eq("email", "dinsos@bandung.go.id").single();
  assert.ifError(actor.error);
  const draft = await admin.from("dinsos_asesmen_sosial").insert({
    case_id: workflow.workflow,
    created_by: actor.data.id,
    ...validAssessment,
    status: "DRAFT",
  });
  assert.ifError(draft.error);
  const completion = await admin.rpc("dinsos_complete_assessment", { p_case_id: workflow.workflow, p_actor_id: actor.data.id });
  assert.ifError(completion.error);
  assert.ok(completion.data.registryAssessmentId);
  const linked = await admin.from("dinsos_asesmen_sosial").select("registry_assessment_id").eq("case_id", workflow.workflow).single();
  assert.equal(linked.data.registry_assessment_id, completion.data.registryAssessmentId);

  const officialAfter = await admin
    .from("penetapan_desil")
    .select("id,warga_id,desil_dtsen,created_at")
    .order("id");
  assert.ifError(officialAfter.error);
  assert.deepEqual(officialAfter.data, officialBefore.data, "Official DTSEN must remain unchanged.");

  const audits = await admin
    .from("log_aktivitas")
    .select("aktivitas,metadata")
    .in("aktivitas", ["Membuat asesmen sosial", "Menyetujui asesmen sosial", "Meminta re-asesmen sosial"]);
  assert.ifError(audits.error);
  assert.ok(audits.data.length > 0);
  for (const row of audits.data) {
    const serialized = JSON.stringify(row);
    assert.doesNotMatch(serialized, /\b\d{16}\b/);
    assert.doesNotMatch(serialized, /observation|reviewer_note|alamat|penyakit|nomor_hp/i);
  }

  const migration = await readFile(
    new URL("../supabase/migrations/202609060010_dinsos_assessment_registry.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /security definer/gi);
  assert.match(migration, /revoke all on function public\.dinsos_review_assessment/);
  assert.match(migration, /registry_assessment_id/);

  console.log(JSON.stringify({
    summary: "PASS",
    createIntervensi: "PASS",
    createKebutuhanDasar: "PASS",
    validation: "PASS",
    search: "PASS",
    filters: "PASS",
    pagination: "PASS",
    nikMasked: "PASS",
    reviewAuthorization: "401/403/PASS",
    approve: "PASS",
    duplicateApprove: 409,
    requestReassessment: "PASS",
    reassessmentValidation: "PASS",
    officialDtsenUnchanged: "PASS",
    auditPrivacy: "PASS",
    structuredRegistrySync: "PASS",
  }, null, 2));
} finally {
  if (createdIds.length) {
    await admin.from("dinsos_assessments").delete().in("id", createdIds);
  }
  await cleanupDinsosFixtures();
  await cleanupDinsosAssessmentFixtures();
}
