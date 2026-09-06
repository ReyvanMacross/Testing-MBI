import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import {
  assertSafeIntegrationHost,
  isPublicIntegrationAddress,
} from "../lib/integrations/assert-safe-integration-host.ts";
import { recordHealthResult } from "../lib/integrations/record-health-result.ts";
import {
  classifyIntegrationResponse,
  testIntegration,
} from "../lib/integrations/test-integration.ts";
import { validateIntegrationUrl } from "../lib/integrations/validate-integration-url.ts";
import {
  getSupabaseAdminEnvironment,
  loadProjectEnvironment,
} from "./lib/project-env.mjs";

const allowed = new Set(["api.fixture.example"]);
const config = {
  endpoint_url: "https://api.fixture.example/health",
  http_method: "GET",
  timeout_ms: 500,
  expected_status_min: 200,
  expected_status_max: 299,
  credential_type: "NONE",
  credential_ref: null,
};
const safeHost = async () => {};

function clock(elapsed) {
  const values = [0, elapsed];
  return () => values.shift() ?? elapsed;
}

assert.equal(classifyIntegrationResponse(120, 200, 200, 299).status, "ONLINE");
assert.equal(classifyIntegrationResponse(1250, 200, 200, 299).status, "LAMBAT");
assert.equal(classifyIntegrationResponse(30, 500, 200, 299).status, "OFFLINE");

const online = await testIntegration(config, {
  allowedHosts: allowed,
  assertSafeHost: safeHost,
  fetchImpl: async () => new Response(null, { status: 200 }),
  now: clock(120),
});
assert.deepEqual(online, { status: "ONLINE", latencyMs: 120, httpStatus: 200, errorMessage: null });

const slow = await testIntegration(config, {
  allowedHosts: allowed,
  assertSafeHost: safeHost,
  fetchImpl: async () => new Response(null, { status: 200 }),
  now: clock(1250),
});
assert.equal(slow.status, "LAMBAT");

const offline = await testIntegration(config, {
  allowedHosts: allowed,
  assertSafeHost: safeHost,
  fetchImpl: async () => new Response(null, { status: 500 }),
  now: clock(40),
});
assert.equal(offline.status, "OFFLINE");
assert.equal(offline.errorMessage, "HTTP status tidak sesuai.");

const redirect = await testIntegration(config, {
  allowedHosts: allowed,
  assertSafeHost: safeHost,
  fetchImpl: async () => new Response(null, { status: 302, headers: { Location: "http://127.0.0.1" } }),
  now: clock(20),
});
assert.equal(redirect.status, "OFFLINE");
assert.equal(redirect.errorMessage, "Redirect tidak diizinkan.");

const timeout = await testIntegration({ ...config, timeout_ms: 25 }, {
  allowedHosts: allowed,
  assertSafeHost: safeHost,
  fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  }),
});
assert.equal(timeout.status, "OFFLINE");
assert.equal(timeout.errorMessage, "Timeout koneksi.");

assert.throws(() => validateIntegrationUrl("http://api.fixture.example", allowed), /HTTPS/);
assert.throws(() => validateIntegrationUrl("https://user:pass@api.fixture.example", allowed), /Credential/);
assert.throws(() => validateIntegrationUrl("https://not-allowed.example", allowed), /allowlist/);
for (const address of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fc00::1", "fe80::1", "224.0.0.1"]) {
  assert.equal(isPublicIntegrationAddress(address), false, `${address} must be blocked`);
}
assert.equal(isPublicIntegrationAddress("8.8.8.8"), true);
await assert.rejects(
  () => assertSafeIntegrationHost("api.fixture.example", async () => [{ address: "127.0.0.1", family: 4 }]),
  /tidak diizinkan/,
);

await loadProjectEnvironment();
const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const admin = createClient(supabaseUrl, supabaseSecretKey, { auth: { autoRefreshToken: false, persistSession: false } });
const fixtureName = "Fixture Healthcheck MVP";
let { data: fixture } = await admin.from("integrasi_api").select("id, layanan, instansi, is_critical").eq("layanan", fixtureName).maybeSingle();
if (!fixture) {
  const result = await admin.from("integrasi_api").insert({
    layanan: fixtureName,
    instansi: "Fixture Development",
    status: "BELUM_DITEST",
    healthcheck_enabled: false,
    is_critical: true,
    notes: "Fixture deterministik untuk verifikasi history dan alert; tidak mengirim trafik jaringan.",
  }).select("id, layanan, instansi, is_critical").single();
  if (result.error) throw result.error;
  fixture = result.data;
}
await admin.from("system_alerts").delete().eq("source_type", "INTEGRASI_API").eq("source_id", fixture.id);
await admin.from("integrasi_api_log").delete().eq("integrasi_api_id", fixture.id);
const actorResult = await admin.from("user_profiles").select("id").eq("role", "Admin Diskominfo").eq("status", "AKTIF").limit(1).single();
if (actorResult.error) throw actorResult.error;
const metadata = { fixture: true, networkRequest: false };

await recordHealthResult(admin, fixture, { status: "LAMBAT", latencyMs: 1250, httpStatus: 200, errorMessage: null }, actorResult.data.id, metadata);
await recordHealthResult(admin, fixture, { status: "LAMBAT", latencyMs: 1300, httpStatus: 200, errorMessage: null }, actorResult.data.id, metadata);
let openAlerts = await admin.from("system_alerts").select("id", { count: "exact" }).eq("source_type", "INTEGRASI_API").eq("source_id", fixture.id).eq("status", "OPEN");
assert.equal(openAlerts.count, 1, "duplicate slow alerts must be prevented");
await recordHealthResult(admin, fixture, { status: "OFFLINE", latencyMs: null, httpStatus: null, errorMessage: "Timeout koneksi." }, actorResult.data.id, metadata);
openAlerts = await admin.from("system_alerts").select("id, title", { count: "exact" }).eq("source_type", "INTEGRASI_API").eq("source_id", fixture.id).eq("status", "OPEN");
assert.equal(openAlerts.count, 1);
assert.match(openAlerts.data[0].title, /Terputus/);
await recordHealthResult(admin, fixture, { status: "ONLINE", latencyMs: 120, httpStatus: 200, errorMessage: null }, actorResult.data.id, metadata);
openAlerts = await admin.from("system_alerts").select("id", { count: "exact" }).eq("source_type", "INTEGRASI_API").eq("source_id", fixture.id).eq("status", "OPEN");
assert.equal(openAlerts.count, 0, "online recovery must resolve open alerts");
const history = await admin.from("integrasi_api_log").select("id", { count: "exact" }).eq("integrasi_api_id", fixture.id);
assert.equal(history.count, 4);
await admin.from("integrasi_api").update({ status: "BELUM_DITEST", latency_ms: null, last_test_at: null }).eq("id", fixture.id);

const fixtureActivity = `Melakukan uji koneksi: ${fixtureName}`;
await admin.from("log_aktivitas").delete().eq("aktivitas", fixtureActivity);
const auditResult = await admin.from("log_aktivitas").insert({
  user_id: actorResult.data.id,
  nama_pengguna: "Admin MBI",
  role_pengguna: "Admin Diskominfo",
  aktivitas: fixtureActivity,
  modul: "Integrasi API",
  status: "BERHASIL",
  metadata: {
    integrationId: fixture.id,
    result: "ONLINE",
    latencyMs: 120,
    httpStatus: 200,
    fixture: true,
    networkRequest: false,
  },
});
if (auditResult.error) throw auditResult.error;

const searchResult = await admin.rpc("list_integrations", {
  p_search: "DTKS", p_status: null, p_opd_id: null, p_limit: 15, p_offset: 0,
});
if (searchResult.error) throw searchResult.error;
assert.deepEqual(searchResult.data.map((row) => row.layanan), ["Sinkronisasi DTKS"]);
const offlineResult = await admin.rpc("list_integrations", {
  p_search: null, p_status: "OFFLINE", p_opd_id: null, p_limit: 15, p_offset: 0,
});
if (offlineResult.error) throw offlineResult.error;
assert.ok(offlineResult.data.every((row) => row.status === "OFFLINE"));
const opdResult = await admin.rpc("list_integrations", {
  p_search: null, p_status: null, p_opd_id: "3306ead2-8dc4-4f8d-9923-e56df1ce3c2d", p_limit: 15, p_offset: 0,
});
if (opdResult.error) throw opdResult.error;
assert.ok(opdResult.data.every((row) => row.opd_id === "3306ead2-8dc4-4f8d-9923-e56df1ce3c2d"));
const [firstPage, secondPage] = await Promise.all([
  admin.rpc("list_integrations", { p_search: null, p_status: null, p_opd_id: null, p_limit: 3, p_offset: 0 }),
  admin.rpc("list_integrations", { p_search: null, p_status: null, p_opd_id: null, p_limit: 3, p_offset: 3 }),
]);
if (firstPage.error) throw firstPage.error;
if (secondPage.error) throw secondPage.error;
assert.equal(firstPage.data.length, 3);
assert.equal(secondPage.data.length, 3);
assert.equal(firstPage.data.some((row) => secondPage.data.some((other) => other.id === row.id)), false);

console.log(JSON.stringify({
  pure: { online: true, slow: true, offline: true, timeout: true, redirect: true },
  ssrf: { nonHttps: true, credentialsInUrl: true, nonAllowlisted: true, privateIp: true, loopback: true },
    database: { fixtureIntegrationId: fixture.id, historyRows: history.count, duplicateOpenAlerts: 0, recoveryOpenAlerts: 0, testAudit: true },
    listing: { search: true, statusFilter: true, opdFilter: true, pagination: true },
  }, null, 2));

await admin.from("system_alerts").delete().eq("source_type", "INTEGRASI_API").eq("source_id", fixture.id);
const fixtureCleanup = await admin.from("integrasi_api").delete().eq("id", fixture.id);
if (fixtureCleanup.error) throw fixtureCleanup.error;
