import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import { cleanupKecamatanFixtures, seedKecamatanFixtures } from "./dev/kecamatan-fixture-lib.mjs";
import { getSupabaseAdminEnvironment, loadProjectEnvironment } from "./lib/project-env.mjs";

await loadProjectEnvironment();
const BASE_URL = process.env.MBI_TEST_BASE_URL ?? "http://localhost:3000";
const ORIGIN = process.env.APP_ORIGIN ?? BASE_URL;
const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(publishableKey, "Publishable key Supabase wajib tersedia.");
const admin = createClient(supabaseUrl, supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const helpdeskDescription = "Kendala sintetis workflow Kecamatan untuk menguji pencatatan helpdesk terkontrol.";

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

function mutation(path, cookie, body, method = "POST", origin = ORIGIN) {
  return fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie, Origin: origin, "Sec-Fetch-Site": "same-origin" },
    body: JSON.stringify(body),
  });
}

let fixture;
try {
  fixture = await seedKecamatanFixtures();
  const cookie = await login(process.env.E2E_KECAMATAN_IDENTIFIER, process.env.E2E_KECAMATAN_PASSWORD);

  const page = await fetch(`${BASE_URL}/kecamatan`, { headers: { Cookie: cookie } });
  const pageText = await page.text();
  assert.equal(page.status, 200, pageText);
  assert.match(pageText, /Antrian Kerja Kewilayahan/u);
  assert.doesNotMatch(pageText, /\b\d{16}\b/u, "NIK/KK mentah tidak boleh terkirim ke HTML.");

  const deniedRole = await mutation(`/api/kecamatan/usulan/${fixture.proposals.waiting.id}/survei`, "", {
    surveyorName: "Surveyor ditolak", dueDate: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), instruction: "Permintaan lintas peran harus ditolak.",
  });
  assert.equal(deniedRole.status, 401, await deniedRole.text());
  const deniedOrigin = await mutation(`/api/kecamatan/usulan/${fixture.proposals.waiting.id}/survei`, cookie, {
    surveyorName: "Surveyor ditolak", dueDate: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), instruction: "Permintaan lintas origin harus ditolak.",
  }, "POST", "https://contoh-tidak-sah.invalid");
  assert.equal(deniedOrigin.status, 403, await deniedOrigin.text());

  const lookup = await mutation("/api/kecamatan/warga/lookup", cookie, { nik: fixture.citizens.waiting.nik });
  const lookupBody = await lookup.text();
  assert.equal(lookup.status, 200, lookupBody);
  assert.doesNotMatch(lookupBody, /\b\d{16}\b/u);
  const outsideLookup = await mutation("/api/kecamatan/warga/lookup", cookie, { nik: fixture.citizens.outside.nik });
  assert.equal(outsideLookup.status, 403, await outsideLookup.text());

  const dueDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const assigned = await mutation(`/api/kecamatan/usulan/${fixture.proposals.waiting.id}/survei`, cookie, {
    surveyorName: "PSM Workflow Kecamatan", dueDate,
    instruction: "Lakukan verifikasi faktual terkontrol untuk alur penuh pengujian Kecamatan.",
  });
  const assignedBody = await assigned.text();
  assert.equal(assigned.status, 201, assignedBody);
  const surveyId = JSON.parse(assignedBody).surveyId;
  const duplicateAssign = await mutation(`/api/kecamatan/usulan/${fixture.proposals.waiting.id}/survei`, cookie, {
    surveyorName: "PSM Workflow Kecamatan", dueDate, instruction: "Penugasan ganda ini harus ditolak oleh transaksi database.",
  });
  assert.equal(duplicateAssign.status, 409, await duplicateAssign.text());

  const invalidResult = await mutation(`/api/kecamatan/survei/${surveyId}`, cookie, {
    score: 101, factualDesil: 1, notes: "Nilai di luar batas harus ditolak oleh validasi input aplikasi.",
  }, "PATCH");
  assert.equal(invalidResult.status, 400, await invalidResult.text());
  const result = await mutation(`/api/kecamatan/survei/${surveyId}`, cookie, {
    score: 86, factualDesil: 1,
    notes: "Hasil verifikasi lapangan terkontrol menyatakan warga layak diteruskan ke OPD teknis.",
  }, "PATCH");
  assert.equal(result.status, 200, await result.text());
  const review = await mutation(`/api/kecamatan/survei/${surveyId}/review`, cookie, {
    decision: "APPROVE", targetProgramId: fixture.program.id,
    reviewNote: "Kecamatan menyetujui hasil survei dan menetapkan program tujuan sesuai kebutuhan warga.",
  });
  assert.equal(review.status, 200, await review.text());
  const referral = await mutation(`/api/kecamatan/usulan/${fixture.proposals.waiting.id}/rujukan`, cookie, {
    programId: fixture.program.id, category: "Bantuan Pendidikan",
    instruction: "OPD tujuan diminta menindaklanjuti hasil verifikasi Kecamatan sesuai SLA layanan.", slaHours: 48,
  });
  const referralBody = await referral.text();
  assert.equal(referral.status, 201, referralBody);
  const createdReferral = JSON.parse(referralBody);
  const duplicateReferral = await mutation(`/api/kecamatan/usulan/${fixture.proposals.waiting.id}/rujukan`, cookie, {
    programId: fixture.program.id, category: "Bantuan Pendidikan",
    instruction: "Rujukan kedua untuk usulan yang sama harus ditolak secara transaksional.", slaHours: 48,
  });
  assert.equal(duplicateReferral.status, 409, await duplicateReferral.text());

  const repeat = await mutation(`/api/kecamatan/survei/${fixture.surveys.approval.id}/review`, cookie, {
    decision: "REPEAT", targetProgramId: fixture.program.id,
    reviewNote: "Bukti lapangan perlu dilengkapi melalui satu survei ulang sebelum persetujuan akhir.",
  });
  assert.equal(repeat.status, 200, await repeat.text());
  const repeatResult = await mutation(`/api/kecamatan/survei/${fixture.surveys.approval.id}`, cookie, {
    score: 78, factualDesil: 2,
    notes: "Survei ulang telah melengkapi bukti lapangan dan mengonfirmasi kelayakan rujukan warga.",
  }, "PATCH");
  assert.equal(repeatResult.status, 200, await repeatResult.text());
  const repeatApproval = await mutation(`/api/kecamatan/survei/${fixture.surveys.approval.id}/review`, cookie, {
    decision: "APPROVE", targetProgramId: fixture.program.id,
    reviewNote: "Bukti survei ulang telah lengkap dan hasil verifikasi disetujui Kecamatan.",
  });
  assert.equal(repeatApproval.status, 200, await repeatApproval.text());

  const targetReferral = await admin.from("referral_mbi")
    .select("referral_code,target_opd_id,master_opd!referral_mbi_target_opd_id_fkey(kode_opd)")
    .eq("id", createdReferral.referralId)
    .single();
  assert.ifError(targetReferral.error);
  const targetOpd = Array.isArray(targetReferral.data.master_opd) ? targetReferral.data.master_opd[0] : targetReferral.data.master_opd;
  assert.equal(targetOpd?.kode_opd, "DISDIK", "Rujukan Kecamatan harus masuk antrean target Disdik.");

  const helpdesk = await mutation("/api/kecamatan/helpdesk", cookie, {
    wargaId: fixture.citizens.waiting.id, category: "Kendala Teknis Aplikasi", description: helpdeskDescription,
  });
  assert.equal(helpdesk.status, 201, await helpdesk.text());

  const integrity = await admin.rpc("kecamatan_validate_domain_integrity");
  assert.ifError(integrity.error);
  assert.equal(integrity.data.status, "PASS");
  const eventCount = await admin.from("kecamatan_events").select("id", { count: "exact", head: true }).eq("usulan_id", fixture.proposals.waiting.id);
  assert.ifError(eventCount.error);
  assert.equal(eventCount.count, 5);

  const browser = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const session = await browser.auth.signInWithPassword({
    email: ["admin.kecamatan.sukajadi", "staging.invalid"].join("@"), password: process.env.E2E_KECAMATAN_PASSWORD,
  });
  assert.ifError(session.error);
  const anonHeaders = { apikey: publishableKey };
  const authHeaders = { apikey: publishableKey, Authorization: `Bearer ${session.data.session.access_token}` };
  for (const table of ["kecamatan_warga_usulan", "kecamatan_survei", "kecamatan_documents", "kecamatan_referral_details", "kecamatan_events", "kecamatan_helpdesk_tickets"]) {
    for (const headers of [anonHeaders, authHeaders]) {
      const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=id&limit=1`, { headers });
      assert.ok([401, 403].includes(response.status), `${table} direct access menghasilkan ${response.status}.`);
    }
  }
  await browser.auth.signOut({ scope: "local" });
  console.log(JSON.stringify({
    login: "PASS", authenticationBoundary: "PASS", originGuard: "PASS", jurisdiction: "PASS",
    workflow: "proposal -> survey -> approval -> referral PASS", repeatSurvey: "PASS", duplicateProtection: "PASS",
    crossOpdVisibility: "DISDIK PASS", integrity: "PASS", clientPii: 0, directDatabaseAccess: "BLOCKED",
  }, null, 2));
} finally {
  if (fixture?.actor?.id) {
    await admin.from("kecamatan_helpdesk_tickets").delete().eq("submitted_by", fixture.actor.id).eq("description", helpdeskDescription);
  }
  if (fixture) await cleanupKecamatanFixtures();
}
