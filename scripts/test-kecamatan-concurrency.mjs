import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import { cleanupKecamatanFixtures, seedKecamatanFixtures } from "./dev/kecamatan-fixture-lib.mjs";
import { getSupabaseAdminEnvironment, loadProjectEnvironment } from "./lib/project-env.mjs";

await loadProjectEnvironment();
const BASE_URL = process.env.MBI_TEST_BASE_URL ?? "http://localhost:3000";
const ORIGIN = process.env.APP_ORIGIN ?? BASE_URL;
const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const admin = createClient(supabaseUrl, supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const kecamatanIdentifier = process.env.E2E_KECAMATAN_IDENTIFIER || process.env.KECAMATAN_ADMIN_USERNAME || "admin.kecamatan";
const kecamatanPassword = process.env.E2E_KECAMATAN_PASSWORD || process.env.KECAMATAN_ADMIN_PASSWORD || process.env.SUPABASE_TEST_ADMIN_PASSWORD;

async function login() {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, "Sec-Fetch-Site": "same-origin" },
    body: JSON.stringify({ identifier: kecamatanIdentifier, password: kecamatanPassword }),
  });
  assert.equal(response.status, 200, await response.text());
  return response.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
}

function mutation(path, cookie, body) {
  return fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie, Origin: ORIGIN, "Sec-Fetch-Site": "same-origin" },
    body: JSON.stringify(body),
  });
}

async function concurrentStatuses(...requests) {
  const settled = await Promise.allSettled(requests.map((request) => request()));
  assert.ok(settled.every((result) => result.status === "fulfilled"));
  return settled.map((result) => result.value.status).sort((a, b) => a - b);
}

let fixture;
try {
  fixture = await seedKecamatanFixtures();
  const cookie = await login();
  const dueDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const assignment = {
    surveyorName: "PSM Uji Konkurensi", dueDate,
    instruction: "Penugasan survei terakhir harus hanya menghasilkan satu transaksi yang sah.",
  };
  const assignmentStatuses = await concurrentStatuses(
    () => mutation(`/api/kecamatan/usulan/${fixture.proposals.waiting.id}/survei`, cookie, assignment),
    () => mutation(`/api/kecamatan/usulan/${fixture.proposals.waiting.id}/survei`, cookie, assignment),
  );
  assert.deepEqual(assignmentStatuses, [201, 409]);
  const surveys = await admin.from("kecamatan_survei").select("id").eq("usulan_id", fixture.proposals.waiting.id);
  assert.ifError(surveys.error); assert.equal(surveys.data.length, 1);
  const assignmentEvents = await admin.from("kecamatan_events").select("id").eq("usulan_id", fixture.proposals.waiting.id).eq("event_type", "SURVEY_ASSIGNED");
  assert.ifError(assignmentEvents.error); assert.equal(assignmentEvents.data.length, 1);

  const reviewPayload = {
    decision: "APPROVE", targetProgramId: fixture.program.id,
    reviewNote: "Persetujuan konkurensi hanya boleh menghasilkan satu perubahan status dan satu audit event.",
  };
  const reviewStatuses = await concurrentStatuses(
    () => mutation(`/api/kecamatan/survei/${fixture.surveys.approval.id}/review`, cookie, reviewPayload),
    () => mutation(`/api/kecamatan/survei/${fixture.surveys.approval.id}/review`, cookie, reviewPayload),
  );
  assert.deepEqual(reviewStatuses, [200, 409]);
  const reviewEvents = await admin.from("kecamatan_events").select("id").eq("usulan_id", fixture.proposals.approval.id).eq("event_type", "SURVEY_APPROVED");
  assert.ifError(reviewEvents.error); assert.equal(reviewEvents.data.length, 1);

  const referralPayload = {
    programId: fixture.program.id, category: "Bantuan Pendidikan",
    instruction: "Pengiriman rujukan konkurensi harus menghasilkan tepat satu referral ke OPD teknis.", slaHours: 48,
  };
  const referralStatuses = await concurrentStatuses(
    () => mutation(`/api/kecamatan/usulan/${fixture.proposals.approved.id}/rujukan`, cookie, referralPayload),
    () => mutation(`/api/kecamatan/usulan/${fixture.proposals.approved.id}/rujukan`, cookie, referralPayload),
  );
  assert.deepEqual(referralStatuses, [201, 409]);
  const details = await admin.from("kecamatan_referral_details").select("id,referral_id").eq("usulan_id", fixture.proposals.approved.id);
  assert.ifError(details.error); assert.equal(details.data.length, 1);
  const referralEvents = await admin.from("kecamatan_events").select("id").eq("usulan_id", fixture.proposals.approved.id).eq("event_type", "REFERRAL_SENT");
  assert.ifError(referralEvents.error); assert.equal(referralEvents.data.length, 1);

  const integrity = await admin.rpc("kecamatan_validate_domain_integrity");
  assert.ifError(integrity.error); assert.equal(integrity.data.status, "PASS");
  console.log(JSON.stringify({
    concurrentAssignment: "1 success / 1 conflict", surveyRows: 1, assignmentEvents: 1,
    concurrentReview: "1 success / 1 conflict", reviewEvents: 1,
    concurrentReferral: "1 success / 1 conflict", referralRows: 1, referralEvents: 1,
    integrity: "PASS",
  }, null, 2));
} finally {
  if (fixture) await cleanupKecamatanFixtures();
}
