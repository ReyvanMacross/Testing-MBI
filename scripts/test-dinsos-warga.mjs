import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";

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
  const body = await response.json().catch(() => ({}));
  assert.equal(response.status, 200, JSON.stringify(body));
  return response.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
}

async function patchWarga(wargaId, cookie, payload) {
  return fetch(`${BASE_URL}/api/dinsos/warga/${wargaId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      Origin: ORIGIN,
      "Sec-Fetch-Site": "same-origin",
    },
    body: JSON.stringify(payload),
  });
}

const [wargaResult, verificationResult, desilResult, kelurahanResult] = await Promise.all([
  admin
    .from("warga")
    .select("id,nik,nomor_kk,nama_lengkap,kelurahan_id,status_perkawinan,alamat_lengkap,pekerjaan,updated_at")
    .order("nama_lengkap")
    .limit(50),
  admin
    .from("verifikasi_validasi")
    .select("id,warga_id,status_verifikasi,created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false }),
  admin
    .from("penetapan_desil")
    .select("id,warga_id,desil_dtsen,created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false }),
  admin.from("master_wilayah").select("id,nama").eq("jenis", "KELURAHAN").limit(1),
]);
for (const result of [wargaResult, verificationResult, desilResult, kelurahanResult]) assert.ifError(result.error);
assert.ok(wargaResult.data?.length, "Data warga test tidak tersedia.");
const sample = wargaResult.data[0];

const latestVerification = new Map();
for (const row of verificationResult.data ?? []) {
  if (!latestVerification.has(row.warga_id)) latestVerification.set(row.warga_id, row.status_verifikasi);
}
const latestDesil = new Map();
for (const row of desilResult.data ?? []) {
  if (!latestDesil.has(row.warga_id)) latestDesil.set(row.warga_id, row.desil_dtsen);
}
const totalResult = await admin.from("warga").select("id", { count: "exact", head: true });
assert.ifError(totalResult.error);
const expectedVerified = [...latestVerification.values()].filter((status) => status === "VERIFIED").length;

const dinsosCookie = await login(
  process.env.DINSOS_ADMIN_USERNAME,
  process.env.DINSOS_ADMIN_PASSWORD,
);
const diskCookie = await login(
  process.env.E2E_ADMIN_IDENTIFIER ?? "admin.mbi",
  process.env.E2E_ADMIN_PASSWORD ?? process.env.SUPABASE_TEST_PASSWORD,
);

const summaryPage = await fetch(`${BASE_URL}/dinsos/warga`, { headers: { Cookie: dinsosCookie } });
const summaryHtml = await summaryPage.text();
assert.equal(summaryPage.status, 200);
assert.match(summaryHtml, /Data Warga/);
assert.ok(summaryHtml.includes(String(totalResult.count)));
assert.ok(summaryHtml.includes(String(expectedVerified)));

const nameSearch = await fetch(`${BASE_URL}/dinsos/warga?q=${encodeURIComponent(sample.nama_lengkap)}`, { headers: { Cookie: dinsosCookie } });
assert.ok((await nameSearch.text()).includes(sample.nama_lengkap));
const nikSearch = await fetch(`${BASE_URL}/dinsos/warga?q=${encodeURIComponent(sample.nik)}`, { headers: { Cookie: dinsosCookie } });
assert.ok((await nikSearch.text()).includes(sample.nama_lengkap));

const sampleDesilEntry = [...latestDesil.entries()].find(([, desil]) => Number.isInteger(desil));
assert.ok(sampleDesilEntry);
const desilPage = await fetch(`${BASE_URL}/dinsos/warga?desil=${sampleDesilEntry[1]}`, { headers: { Cookie: dinsosCookie } });
assert.equal(desilPage.status, 200);
const verifiedPage = await fetch(`${BASE_URL}/dinsos/warga?status=TERVERIFIKASI`, { headers: { Cookie: dinsosCookie } });
assert.match(await verifiedPage.text(), /TERVERIFIKASI/);
const canonicalFilter = await fetch(`${BASE_URL}/dinsos/warga?kelurahan=${kelurahanResult.data[0].id}`, { headers: { Cookie: dinsosCookie } });
assert.match(await canonicalFilter.text(), /Tidak ada warga yang sesuai dengan filter/);
const pageTwo = await fetch(`${BASE_URL}/dinsos/warga?page=2`, { headers: { Cookie: dinsosCookie } });
assert.equal(pageTwo.status, 200);
assert.match(await pageTwo.text(), /aria-current="page">2/);

const profileResponse = await fetch(`${BASE_URL}/dinsos/warga?warga=${sample.id}`, { headers: { Cookie: dinsosCookie } });
const profileHtml = await profileResponse.text();
assert.equal(profileResponse.status, 200);
assert.ok(!profileHtml.includes(sample.nik), "NIK penuh tidak boleh masuk HTML.");
if (sample.nomor_kk) assert.ok(!profileHtml.includes(sample.nomor_kk), "Nomor KK penuh tidak boleh masuk HTML.");
assert.match(profileHtml, /x{4,}/);

const payload = {
  namaLengkap: sample.nama_lengkap,
  kelurahanId: sample.kelurahan_id,
  statusPerkawinan: sample.status_perkawinan,
  alamatLengkap: sample.alamat_lengkap,
  pekerjaan: sample.pekerjaan,
  expectedUpdatedAt: sample.updated_at,
};
const unauthenticated = await patchWarga(sample.id, "", payload);
assert.equal(unauthenticated.status, 401);
const diskActor = await patchWarga(sample.id, diskCookie, payload);
assert.equal(diskActor.status, 403);

const profileId = process.env.DINSOS_ADMIN_PROFILE_ID;
assert.ok(profileId);
try {
  const removed = await admin
    .from("user_capabilities")
    .delete()
    .eq("user_id", profileId)
    .eq("capability", "DINSOS_WARGA_EDIT");
  assert.ifError(removed.error);
  const withoutCapability = await patchWarga(sample.id, dinsosCookie, payload);
  assert.equal(withoutCapability.status, 403);
} finally {
  const restored = await admin.from("user_capabilities").upsert({
    user_id: profileId,
    capability: "DINSOS_WARGA_EDIT",
    granted_by: profileId,
  }, { onConflict: "user_id,capability" });
  assert.ifError(restored.error);
}

for (const forbidden of ["nik", "nomor_kk", "desil"]) {
  const response = await patchWarga(sample.id, dinsosCookie, { ...payload, [forbidden]: "forbidden" });
  assert.equal(response.status, 400, `${forbidden} mutation must be rejected`);
}

const successful = await patchWarga(sample.id, dinsosCookie, payload);
assert.equal(successful.status, 200, await successful.text());
const stale = await patchWarga(sample.id, dinsosCookie, payload);
assert.equal(stale.status, 409);

const auditResult = await admin
  .from("log_aktivitas")
  .select("metadata,aktivitas")
  .eq("aktivitas", "Memperbarui data warga")
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
assert.ifError(auditResult.error);
assert.equal(auditResult.data?.metadata?.wargaId, sample.id);
assert.ok(Array.isArray(auditResult.data?.metadata?.changedFields));
const auditText = JSON.stringify(auditResult.data?.metadata ?? {});
for (const pii of [sample.nik, sample.nomor_kk, sample.nama_lengkap, sample.alamat_lengkap].filter(Boolean)) {
  assert.ok(!auditText.includes(pii), "Audit metadata tidak boleh mengandung PII mentah.");
}

const migration = await readFile(
  new URL("../supabase/migrations/202609060009_dinsos_warga_registry.sql", import.meta.url),
  "utf8",
);
assert.match(migration, /security definer/gi);
assert.match(migration, /revoke all on function public\.list_dinsos_warga/);
assert.match(migration, /status_verifikasi::text = 'VERIFIED'/);

console.log(JSON.stringify({
  summary: { total: totalResult.count, verified: expectedVerified, unverified: totalResult.count - expectedVerified },
  searchName: "PASS",
  searchNik: "PASS",
  filterKelurahan: "PASS (0 resolved warga)",
  filterDesil: "PASS",
  filterVerification: "PASS",
  pagination: "PASS",
  maskedNik: "PASS",
  maskedFamilyCard: "PASS",
  unauthenticated: 401,
  diskominfoActor: 403,
  dinsosWithoutCapability: 403,
  dinsosEdit: 200,
  forbiddenMutations: 400,
  staleUpdate: 409,
  auditPrivacy: "PASS",
}, null, 2));
