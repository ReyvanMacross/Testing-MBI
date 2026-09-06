import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";

import {
  cleanupDinsosPathFixtures,
  seedDinsosPathFixtures,
} from "./dev/dinsos-path-fixture-lib.mjs";
import {
  getSupabaseAdminEnvironment,
  loadProjectEnvironment,
} from "./lib/project-env.mjs";

await loadProjectEnvironment();
const BASE_URL = process.env.MBI_TEST_BASE_URL ?? "http://localhost:3000";
const ORIGIN = process.env.APP_ORIGIN ?? BASE_URL;
const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(publishableKey, "Publishable key wajib tersedia.");
const admin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function login(identifier, password) {
  assert.ok(identifier && password, "Credential test Dinsos wajib tersedia.");
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
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
}

function publish(caseId, cookie, body) {
  return fetch(`${BASE_URL}/api/dinsos/cases/${caseId}/path/publish`, {
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

async function snapshotOfficial(wargaIds) {
  const result = await admin
    .from("penetapan_desil")
    .select("id,warga_id,desil_dtsen,created_at")
    .in("warga_id", wargaIds)
    .order("id");
  assert.ifError(result.error);
  return result.data;
}

async function assertDirectDenied(table, headers, label) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, {
    headers,
  });
  assert.ok(
    response.status === 401 || response.status === 403,
    `${label} ${table} returned ${response.status}`,
  );
}

let capabilityRemoved = false;
try {
  const fixture = await seedDinsosPathFixtures();
  const cases = Object.values(fixture);
  const wargaIds = cases.map((item) => item.wargaId);
  const officialBefore = await snapshotOfficial(wargaIds);
  const caseResultsBefore = await admin
    .from("dinsos_case_results")
    .select("id,case_id,official_desil,operational_desil,disposition,status")
    .in("case_id", cases.map((item) => item.caseId))
    .order("id");
  assert.ifError(caseResultsBefore.error);

  const migration = await readFile(
    new URL(
      "../supabase/migrations/202609060011_dinsos_split_path_foundation.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const [appPath, dbLabel] of [
    ["PEKERJA", "PEKERJA"],
    ["WIRAUSAHA", "WIRAUSAHA"],
    ["PENGUATAN_DASAR", "PENGUATAN_DASAR"],
  ]) {
    assert.match(migration, new RegExp(`when '${appPath}' then '${dbLabel}'::public\\.jalur_intervensi_enum`));
  }

  const cookie = await login(
    process.env.DINSOS_ADMIN_USERNAME ?? process.env.E2E_DINSOS_IDENTIFIER,
    process.env.DINSOS_ADMIN_PASSWORD ?? process.env.E2E_DINSOS_PASSWORD,
  );

  const unauthenticated = await publish(fixture.wirausaha.caseId, "", {
    path: "WIRAUSAHA",
    targetOpdId: fixture.wirausaha.targetOpdId,
  });
  assert.equal(unauthenticated.status, 401);

  const normal = await publish(fixture.wirausaha.caseId, cookie, {
    path: "WIRAUSAHA",
    targetOpdId: fixture.wirausaha.targetOpdId,
    referralNote: "Instruksi referral fixture tanpa data pribadi warga.",
  });
  const normalBody = await normal.json();
  assert.equal(normal.status, 201, JSON.stringify(normalBody));
  assert.equal(normalBody.finalPath, "WIRAUSAHA");
  assert.equal(normalBody.overrideUsed, false);

  const [normalDecision, normalReferral, normalCase, normalOverrides] =
    await Promise.all([
      admin
        .from("penentuan_jalur")
        .select("id,output_jalur,decision_status,decision_source,target_opd_id")
        .eq("assessment_id", fixture.wirausaha.assessmentId)
        .single(),
      admin
        .from("referral_mbi")
        .select("id,referral_code,status,jalur,sent_at")
        .eq("assessment_id", fixture.wirausaha.assessmentId)
        .single(),
      admin
        .from("dinsos_cases")
        .select("current_stage")
        .eq("id", fixture.wirausaha.caseId)
        .single(),
      admin
        .from("dinsos_path_overrides")
        .select("id", { count: "exact", head: true })
        .eq("assessment_id", fixture.wirausaha.assessmentId),
    ]);
  for (const result of [normalDecision, normalReferral, normalCase, normalOverrides]) {
    assert.ifError(result.error);
  }
  assert.equal(normalDecision.data.decision_status, "FINAL");
  assert.equal(normalDecision.data.decision_source, "ASSESSMENT_REVIEW");
  assert.equal(normalDecision.data.output_jalur, "WIRAUSAHA");
  assert.equal(normalReferral.data.status, "TERKIRIM");
  assert.match(normalReferral.data.referral_code, /^REF-\d{4}-\d{6}$/);
  assert.ok(normalReferral.data.sent_at);
  assert.equal(normalCase.data.current_stage, "REFERRAL_TERKIRIM");
  assert.equal(normalOverrides.count, 0);

  const duplicate = await publish(fixture.wirausaha.caseId, cookie, {
    path: "WIRAUSAHA",
    targetOpdId: fixture.wirausaha.targetOpdId,
  });
  assert.equal(duplicate.status, 409);

  const { data: diskop } = await admin
    .from("master_opd")
    .select("id")
    .eq("kode_opd", "DISKOP")
    .single();
  const wrongTarget = await publish(fixture.pekerja.caseId, cookie, {
    path: "PEKERJA",
    targetOpdId: diskop.id,
  });
  assert.equal(wrongTarget.status, 400);

  const shortReason = await publish(fixture.pekerja.caseId, cookie, {
    path: "WIRAUSAHA",
    targetOpdId: diskop.id,
    overrideReason: "Terlalu singkat",
  });
  assert.equal(shortReason.status, 400);

  const profileId = process.env.DINSOS_ADMIN_PROFILE_ID;
  assert.ok(profileId, "DINSOS_ADMIN_PROFILE_ID wajib tersedia.");
  const removed = await admin
    .from("user_capabilities")
    .delete()
    .eq("user_id", profileId)
    .eq("capability", "DINSOS_PATH_OVERRIDE");
  assert.ifError(removed.error);
  capabilityRemoved = true;
  const forbiddenOverride = await publish(fixture.pekerja.caseId, cookie, {
    path: "WIRAUSAHA",
    targetOpdId: diskop.id,
    overrideReason: "Perubahan jalur diuji tanpa capability yang diperlukan.",
  });
  assert.equal(forbiddenOverride.status, 403);

  const restored = await admin.from("user_capabilities").upsert(
    {
      user_id: profileId,
      capability: "DINSOS_PATH_OVERRIDE",
      granted_by: profileId,
    },
    { onConflict: "user_id,capability" },
  );
  assert.ifError(restored.error);
  capabilityRemoved = false;

  const overridden = await publish(fixture.pekerja.caseId, cookie, {
    path: "WIRAUSAHA",
    targetOpdId: diskop.id,
    overrideReason:
      "Kesiapan usaha telah diverifikasi dan jalur wirausaha lebih sesuai.",
  });
  const overriddenBody = await overridden.json();
  assert.equal(overridden.status, 201, JSON.stringify(overriddenBody));
  assert.equal(overriddenBody.overrideUsed, true);

  const [overrideDecision, overrideHistory] = await Promise.all([
    admin
      .from("penentuan_jalur")
      .select("decision_source,output_jalur,readiness_score,employability_score,entrepreneurship_score")
      .eq("assessment_id", fixture.pekerja.assessmentId)
      .single(),
    admin
      .from("dinsos_path_overrides")
      .select("old_path,new_path,reason")
      .eq("assessment_id", fixture.pekerja.assessmentId)
      .single(),
  ]);
  assert.ifError(overrideDecision.error);
  assert.ifError(overrideHistory.error);
  assert.equal(overrideDecision.data.decision_source, "MANUAL_OVERRIDE");
  assert.equal(overrideDecision.data.output_jalur, "WIRAUSAHA");
  assert.equal(overrideDecision.data.readiness_score, null);
  assert.equal(overrideDecision.data.employability_score, null);
  assert.equal(overrideDecision.data.entrepreneurship_score, null);
  assert.equal(overrideHistory.data.old_path, "PEKERJA");
  assert.equal(overrideHistory.data.new_path, "WIRAUSAHA");

  const deleteReview = await admin
    .from("dinsos_assessment_reviews")
    .delete()
    .eq("assessment_id", fixture.penguatanDasar.assessmentId);
  assert.ifError(deleteReview.error);
  const makeUnreviewed = await admin
    .from("dinsos_assessments")
    .update({ status: "PERLU_REVIEW" })
    .eq("id", fixture.penguatanDasar.assessmentId);
  assert.ifError(makeUnreviewed.error);
  const unreviewed = await publish(fixture.penguatanDasar.caseId, cookie, {
    path: "PENGUATAN_DASAR",
    targetOpdId: fixture.penguatanDasar.targetOpdId,
  });
  assert.equal(unreviewed.status, 409);

  assert.deepEqual(await snapshotOfficial(wargaIds), officialBefore);
  const caseResultsAfter = await admin
    .from("dinsos_case_results")
    .select("id,case_id,official_desil,operational_desil,disposition,status")
    .in("case_id", cases.map((item) => item.caseId))
    .order("id");
  assert.ifError(caseResultsAfter.error);
  assert.deepEqual(caseResultsAfter.data, caseResultsBefore.data);

  const audits = await admin
    .from("log_aktivitas")
    .select("aktivitas,metadata")
    .in("aktivitas", [
      "Menerbitkan referral jalur MBI",
      "Mengubah dan menerbitkan jalur MBI",
    ]);
  assert.ifError(audits.error);
  assert.ok(audits.data.length >= 2);
  const events = await admin
    .from("dinsos_case_events")
    .select("event_type,metadata")
    .in("case_id", [fixture.wirausaha.caseId, fixture.pekerja.caseId])
    .eq("event_type", "PATH_FINALIZED");
  assert.ifError(events.error);
  assert.equal(events.data.length, 2);
  for (const row of [...audits.data, ...events.data]) {
    const serialized = JSON.stringify(row);
    assert.doesNotMatch(serialized, /nik|alamat|penyakit|observation|reviewer_note|referralNote|instruction/i);
    assert.doesNotMatch(serialized, /\b\d{16}\b/);
  }

  const anonHeaders = { apikey: publishableKey };
  const browser = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const browserLogin = await browser.auth.signInWithPassword({
    email: "dinsos@bandung.go.id",
    password:
      process.env.DINSOS_ADMIN_PASSWORD ?? process.env.E2E_DINSOS_PASSWORD,
  });
  assert.ifError(browserLogin.error);
  const authenticatedHeaders = {
    apikey: publishableKey,
    Authorization: `Bearer ${browserLogin.data.session.access_token}`,
  };
  for (const table of [
    "penentuan_jalur",
    "referral_mbi",
    "dinsos_path_overrides",
  ]) {
    await assertDirectDenied(table, anonHeaders, "anon");
    await assertDirectDenied(table, authenticatedHeaders, "authenticated");
  }
  await browser.auth.signOut({ scope: "local" });

  console.log(
    JSON.stringify(
      {
        enumMapping: "PASS",
        approvedAssessmentRequired: "PASS",
        normalPublish: "PASS",
        decisionFinal: "PASS",
        referralCreated: "PASS",
        referralCode: "PASS",
        caseStage: "REFERRAL_TERKIRIM",
        duplicatePublish: 409,
        wrongTargetPolicy: 400,
        overrideWithoutCapability: 403,
        overrideWithCapability: "PASS",
        overrideHistory: "PASS",
        officialDtsenUnchanged: "PASS",
        caseResultUnchanged: "PASS",
        nullScores: "PASS",
        auditPrivacy: "PASS",
        caseEventPrivacy: "PASS",
        directDatabaseAccess: "BLOCKED",
      },
      null,
      2,
    ),
  );
} finally {
  if (capabilityRemoved && process.env.DINSOS_ADMIN_PROFILE_ID) {
    await admin.from("user_capabilities").upsert(
      {
        user_id: process.env.DINSOS_ADMIN_PROFILE_ID,
        capability: "DINSOS_PATH_OVERRIDE",
        granted_by: process.env.DINSOS_ADMIN_PROFILE_ID,
      },
      { onConflict: "user_id,capability" },
    );
  }
  await cleanupDinsosPathFixtures();
}
