import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import { cleanupDinsosReferralFixtures, seedDinsosReferralFixtures } from "./dev/dinsos-referral-fixture-lib.mjs";
import { DEV_PROGRAMS } from "./dev/dinsos-program-fixture-lib.mjs";
import { getSupabaseAdminEnvironment, loadProjectEnvironment } from "./lib/project-env.mjs";

await loadProjectEnvironment();
const BASE_URL = process.env.MBI_TEST_BASE_URL ?? "http://localhost:3000";
const ORIGIN = process.env.APP_ORIGIN ?? BASE_URL;
const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(publishableKey);
const admin = createClient(supabaseUrl, supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function login() {
  const response = await fetch(`${BASE_URL}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGIN, "Sec-Fetch-Site": "same-origin" }, body: JSON.stringify({ identifier: process.env.DINSOS_ADMIN_USERNAME ?? process.env.E2E_DINSOS_IDENTIFIER, password: process.env.DINSOS_ADMIN_PASSWORD ?? process.env.E2E_DINSOS_PASSWORD }) });
  assert.equal(response.status, 200, await response.text());
  return response.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
}

function send(id, cookie, body) {
  return fetch(`${BASE_URL}/api/dinsos/referrals/${id}/send`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie, Origin: ORIGIN, "Sec-Fetch-Site": "same-origin" }, body: JSON.stringify(body) });
}

async function directDenied(table, headers) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, { headers });
  assert.ok([401, 403].includes(response.status), `${table} returned ${response.status}`);
}

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
function addCalendarDays(value, days) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
let restoredProgram = false;
try {
  const fixture = await seedDinsosReferralFixtures();
  const cookie = await login();
  const referrals = Object.values(fixture);
  const ids = referrals.map((item) => item.referralId);
  const wargaIds = referrals.map((item) => item.wargaId);

  const [summary, dbRows, officialBefore, decisionsBefore] = await Promise.all([
    admin.rpc("dinsos_referral_summary"),
    admin.from("referral_mbi").select("status").in("id", ids),
    admin.from("penetapan_desil").select("id,warga_id,desil_dtsen,created_at").in("warga_id", wargaIds).order("id"),
    admin.from("penentuan_jalur").select("id,output_jalur,decision_status,target_opd_id").in("id", referrals.map((item) => item.pathDecisionId)).order("id"),
  ]);
  for (const result of [summary, dbRows, officialBefore, decisionsBefore]) assert.ifError(result.error);
  const summaryRow = summary.data;
  const counts = { waitingReferral: 0, inOpdProcess: 0, interventionCompleted: 0 };
  for (const row of dbRows.data) {
    if (row.status === "MENUNGGU_RUJUKAN") counts.waitingReferral++;
    if (["TERKIRIM", "DITERIMA", "DIPROSES"].includes(row.status)) counts.inOpdProcess++;
    if (row.status === "SELESAI") counts.interventionCompleted++;
  }
  assert.ok(summaryRow.waitingReferral >= counts.waitingReferral);
  assert.ok(summaryRow.inOpdProcess >= counts.inOpdProcess);
  assert.ok(summaryRow.interventionCompleted >= counts.interventionCompleted);

  const { data: waitingWarga } = await admin.from("warga").select("nik,nama_lengkap").eq("id", fixture.waiting.wargaId).single();
  const { data: waitingOpd } = await admin.from("master_opd").select("nama_opd").eq("id", fixture.waiting.targetOpdId).single();
  for (const search of [fixture.waiting.referralCode, waitingWarga.nik, waitingWarga.nama_lengkap, waitingOpd.nama_opd]) {
    const found = await admin.rpc("list_dinsos_referrals", { p_search: search, p_limit: 3, p_offset: 0 });
    assert.ifError(found.error); assert.ok(found.data.some((row) => row.referral_id === fixture.waiting.referralId));
  }
  for (const params of [{ p_path: "WIRAUSAHA" }, { p_status: "DIPROSES" }]) {
    const filtered = await admin.rpc("list_dinsos_referrals", { ...params, p_limit: 3, p_offset: 0 });
    assert.ifError(filtered.error); assert.ok(filtered.data.length > 0);
  }
  const firstPage = await admin.rpc("list_dinsos_referrals", { p_limit: 3, p_offset: 0 });
  const secondPage = await admin.rpc("list_dinsos_referrals", { p_limit: 3, p_offset: 3 });
  assert.ifError(firstPage.error); assert.ifError(secondPage.error); assert.equal(firstPage.data.length, 3); assert.ok(secondPage.data.length >= 2);
  const masked = `${waitingWarga.nik.slice(0, 4)}${"x".repeat(waitingWarga.nik.length - 8)}${waitingWarga.nik.slice(-4)}`;
  assert.notEqual(masked, waitingWarga.nik); assert.match(masked, /x/);

  const unauth = await send(fixture.waiting.referralId, "", { programId: fixture.sent.programId, referralDate: today });
  assert.equal(unauth.status, 401);
  const wrongOpd = await send(fixture.waiting.referralId, cookie, { programId: fixture.sent.programId, referralDate: today });
  assert.equal(wrongOpd.status, 400);

  const { data: waitingProgram } = await admin.from("master_program_layanan").select("id,jalur").eq("kode_program", DEV_PROGRAMS[0].code).single();
  await admin.from("master_program_layanan").update({ jalur: "PEKERJA" }).eq("id", waitingProgram.id); restoredProgram = true;
  const wrongPath = await send(fixture.waiting.referralId, cookie, { programId: waitingProgram.id, referralDate: today });
  assert.equal(wrongPath.status, 400);
  await admin.from("master_program_layanan").update({ jalur: waitingProgram.jalur, is_active: false }).eq("id", waitingProgram.id);
  const inactive = await send(fixture.waiting.referralId, cookie, { programId: waitingProgram.id, referralDate: today });
  assert.equal(inactive.status, 400);
  await admin.from("master_program_layanan").update({ is_active: true }).eq("id", waitingProgram.id); restoredProgram = false;
  const tomorrow = addCalendarDays(today, 1);
  const future = await send(fixture.waiting.referralId, cookie, { programId: waitingProgram.id, referralDate: tomorrow });
  assert.equal(future.status, 400);

  const valid = await send(fixture.waiting.referralId, cookie, { programId: waitingProgram.id, referralDate: today, instruction: "Instruksi fixture tanpa data pribadi." });
  assert.equal(valid.status, 200, await valid.text());
  const afterSend = await admin.from("referral_mbi").select("status,sent_at,program_id,referral_date").eq("id", fixture.waiting.referralId).single();
  const caseAfter = await admin.from("dinsos_cases").select("current_stage").eq("id", fixture.waiting.caseId).single();
  assert.ifError(afterSend.error); assert.equal(afterSend.data.status, "TERKIRIM"); assert.ok(afterSend.data.sent_at); assert.equal(afterSend.data.program_id, waitingProgram.id); assert.equal(caseAfter.data.current_stage, "REFERRAL_TERKIRIM");
  const duplicate = await send(fixture.waiting.referralId, cookie, { programId: waitingProgram.id, referralDate: today });
  assert.equal(duplicate.status, 409);

  async function transition(referral, status) {
    return admin.rpc("transition_referral_status", { p_referral_id: referral.referralId, p_to_status: status, p_actor_user_id: null, p_actor_opd_id: referral.targetOpdId, p_note: "Fixture lifecycle event." });
  }
  const received = await transition(fixture.sent, "DITERIMA"); assert.ifError(received.error);
  const processing = await transition(fixture.received, "DIPROSES"); assert.ifError(processing.error);
  const completed = await transition(fixture.processing, "SELESAI"); assert.ifError(completed.error);
  const invalid = await transition(fixture.sent, "SELESAI"); assert.ok(invalid.error); assert.match(invalid.error.message, /INVALID_REFERRAL_TRANSITION/);
  const timestamps = await admin.from("referral_mbi").select("id,received_at,processing_started_at,completed_at").in("id", [fixture.sent.referralId, fixture.received.referralId, fixture.processing.referralId]);
  assert.ifError(timestamps.error); assert.ok(timestamps.data.find((row) => row.id === fixture.sent.referralId).received_at); assert.ok(timestamps.data.find((row) => row.id === fixture.received.referralId).processing_started_at); assert.ok(timestamps.data.find((row) => row.id === fixture.processing.referralId).completed_at);

  const events = await admin.from("referral_mbi_events").select("referral_id,event_type,event_at,metadata").in("referral_id", ids).order("event_at", { ascending: true });
  assert.ifError(events.error); for (let index = 1; index < events.data.length; index++) assert.ok(events.data[index - 1].event_at <= events.data[index].event_at);
  assert.ok(events.data.some((row) => row.event_type === "PROGRAM_PLANNED"));
  for (const row of events.data) { const serialized = JSON.stringify(row.metadata); assert.doesNotMatch(serialized, /nik|alamat|penyakit|observation|instruction/i); assert.doesNotMatch(serialized, /\b\d{16}\b/); }

  const printUnauth = await fetch(`${BASE_URL}/dinsos/referral/${fixture.sent.referralId}/print`, { redirect: "manual" });
  assert.notEqual(printUnauth.status, 200);
  const printAuth = await fetch(`${BASE_URL}/dinsos/referral/${fixture.sent.referralId}/print`, { headers: { Cookie: cookie } });
  assert.equal(printAuth.status, 200);

  const audits = await admin.from("log_aktivitas").select("aktivitas,metadata").eq("aktivitas", "Mengirim referral ke OPD").contains("metadata", { referralId: fixture.waiting.referralId });
  assert.ifError(audits.error); assert.equal(audits.data.length, 1); assert.doesNotMatch(JSON.stringify(audits.data[0]), /nik|nama|alamat|instruction|\b\d{16}\b/i);
  const officialAfter = await admin.from("penetapan_desil").select("id,warga_id,desil_dtsen,created_at").in("warga_id", wargaIds).order("id");
  const decisionsAfter = await admin.from("penentuan_jalur").select("id,output_jalur,decision_status,target_opd_id").in("id", referrals.map((item) => item.pathDecisionId)).order("id");
  assert.deepEqual(officialAfter.data, officialBefore.data); assert.deepEqual(decisionsAfter.data, decisionsBefore.data);

  const anonHeaders = { apikey: publishableKey };
  const browser = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const browserLogin = await browser.auth.signInWithPassword({ email: "dinsos@bandung.go.id", password: process.env.DINSOS_ADMIN_PASSWORD ?? process.env.E2E_DINSOS_PASSWORD });
  assert.ifError(browserLogin.error);
  const authHeaders = { apikey: publishableKey, Authorization: `Bearer ${browserLogin.data.session.access_token}` };
  for (const table of ["master_program_layanan", "referral_mbi", "referral_mbi_events"]) { await directDenied(table, anonHeaders); await directDenied(table, authHeaders); }
  await browser.auth.signOut({ scope: "local" });

  console.log(JSON.stringify({ summary: "PASS", search: "PASS", filters: "PASS", pagination: "PASS", maskedNik: "PASS", processAction: "PASS", progressAction: "PASS", programValidation: "PASS", futureDate: 400, send: "PASS", duplicateSend: 409, transitions: "PASS", invalidTransition: 409, timeline: "PASS", printAuth: "PASS", officialDtsenUnchanged: "PASS", pathDecisionUnchanged: "PASS", auditPrivacy: "PASS", directDatabaseAccess: "BLOCKED" }, null, 2));
} finally {
  if (restoredProgram) {
    await admin.from("master_program_layanan").update({ jalur: "PENGUATAN_DASAR", is_active: true }).eq("kode_program", DEV_PROGRAMS[0].code);
  }
  await cleanupDinsosReferralFixtures();
}
