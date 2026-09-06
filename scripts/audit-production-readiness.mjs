import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseAdminEnvironment,
  loadProjectEnvironment,
} from "./lib/project-env.mjs";

const SENSITIVE_KEY =
  /(password|passwd|token|secret|authorization|cookie|api[_-]?key|credential)/i;
const TEST_PROFILE_IDS = [
  "3b6bf014-f8c7-48c8-ae72-0cb1e70e6b5c",
  "18319332-ee6b-4b29-b226-74b234119169",
  "bc9ddc99-b7ff-4a6c-a73e-b8147ec4a4c6",
];

function findUnredactedSensitiveValues(value, path = "metadata", findings = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      findUnredactedSensitiveValues(item, `${path}[${index}]`, findings),
    );
    return findings;
  }

  if (!value || typeof value !== "object") return findings;

  for (const [key, item] of Object.entries(value)) {
    const itemPath = `${path}.${key}`;
    if (SENSITIVE_KEY.test(key) && item !== "[REDACTED]") {
      findings.push(itemPath);
    } else {
      findUnredactedSensitiveValues(item, itemPath, findings);
    }
  }

  return findings;
}

function hostAllowlist() {
  return new Set(
    (process.env.INTEGRATION_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function count(query) {
  const result = await query;
  if (result.error) throw result.error;
  return result.count ?? 0;
}

await loadProjectEnvironment();
const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const admin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const [
  activeTestAccounts,
  developmentIntegrations,
  unresolvedWarga,
  legacyUsers,
  untestedIntegrations,
  openCriticalAlerts,
  totalUsers,
  totalIntegrations,
  totalLogs,
  totalWilayah,
  integrations,
  auditMetadata,
  dinsosFixtures,
  dinsosAdmin,
  waitingStabilization,
  waitingSplit,
] = await Promise.all([
  count(
    admin
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .in("id", TEST_PROFILE_IDS)
      .eq("status", "AKTIF"),
  ),
  count(
    admin
      .from("integrasi_api")
      .select("id", { count: "exact", head: true })
      .or(
        "layanan.ilike.%fixture%,instansi.ilike.%fixture%,notes.ilike.%fixture%",
      ),
  ),
  count(
    admin
      .from("warga")
      .select("id", { count: "exact", head: true })
      .or("kecamatan_id.is.null,kelurahan_id.is.null"),
  ),
  count(
    admin
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .is("username", null)
      .is("nip", null),
  ),
  count(
    admin
      .from("integrasi_api")
      .select("id", { count: "exact", head: true })
      .eq("status", "BELUM_DITEST"),
  ),
  count(
    admin
      .from("system_alerts")
      .select("id", { count: "exact", head: true })
      .eq("status", "OPEN")
      .eq("severity", "CRITICAL"),
  ),
  count(admin.from("user_profiles").select("id", { count: "exact", head: true })),
  count(admin.from("integrasi_api").select("id", { count: "exact", head: true })),
  count(admin.from("log_aktivitas").select("id", { count: "exact", head: true })),
  count(admin.from("master_wilayah").select("id", { count: "exact", head: true })),
  admin
    .from("integrasi_api")
    .select("id, endpoint_url, credential_type, credential_ref"),
  admin.from("log_aktivitas").select("id, metadata"),
  count(admin.from("dinsos_cases").select("id", { count: "exact", head: true }).eq("is_fixture", true)),
  admin.from("user_profiles").select("id,auth_user_id,status,role,master_opd(kode_opd)").eq("email", "dinsos@bandung.go.id").maybeSingle(),
  count(admin.from("dinsos_cases").select("id", { count: "exact", head: true }).eq("current_stage", "MENUNGGU_STABILISASI")),
  count(admin.from("dinsos_cases").select("id", { count: "exact", head: true }).eq("current_stage", "MENUNGGU_SPLIT_JALUR")),
]);

if (integrations.error) throw integrations.error;
if (auditMetadata.error) throw auditMetadata.error;

const blockers = [];
const warnings = [];
const info = [];
const allowedHosts = hostAllowlist();

if (activeTestAccounts > 0) {
  blockers.push(`Akun uji aktif: ${activeTestAccounts}`);
}
if (developmentIntegrations > 0) {
  blockers.push(`Fixture integrasi development: ${developmentIntegrations}`);
}
if (dinsosFixtures > 0) blockers.push(`Fixture kasus Dinsos: ${dinsosFixtures}`);
const dinsosOpd = Array.isArray(dinsosAdmin.data?.master_opd) ? dinsosAdmin.data.master_opd[0] : dinsosAdmin.data?.master_opd;
if (!dinsosAdmin.data?.auth_user_id || dinsosAdmin.data.status !== "AKTIF" || dinsosAdmin.data.role !== "INTERVENSI" || dinsosOpd?.kode_opd !== "DINSOS") {
  blockers.push("Admin Dinsos belum di-onboard secara valid");
}

const invalidEndpointHosts = [];
const invalidCredentialRows = [];
for (const integration of integrations.data ?? []) {
  if (integration.endpoint_url) {
    try {
      const host = new URL(integration.endpoint_url).hostname.toLowerCase();
      if (!allowedHosts.has(host)) invalidEndpointHosts.push(integration.id);
    } catch {
      invalidEndpointHosts.push(integration.id);
    }
  }

  const ref = integration.credential_ref;
  const validCredential =
    (integration.credential_type === "NONE" && !ref) ||
    (integration.credential_type === "BEARER" &&
      typeof ref === "string" &&
      /^[A-Z][A-Z0-9_]{2,100}$/.test(ref));
  if (!validCredential) invalidCredentialRows.push(integration.id);
}

if (invalidEndpointHosts.length > 0) {
  blockers.push(`Endpoint di luar allowlist: ${invalidEndpointHosts.length}`);
}
if (invalidCredentialRows.length > 0) {
  blockers.push(`Konfigurasi credential database tidak valid: ${invalidCredentialRows.length}`);
}

const sensitiveMetadata = (auditMetadata.data ?? []).flatMap((row) =>
  findUnredactedSensitiveValues(row.metadata).map((path) => ({ id: row.id, path })),
);
if (sensitiveMetadata.length > 0) {
  blockers.push(`Metadata audit sensitif belum disensor: ${sensitiveMetadata.length}`);
}

if (!process.env.APP_ORIGIN) blockers.push("APP_ORIGIN belum dikonfigurasi");
if (process.env.DINSOS_ASSESSMENT_OPTIONS_SOURCE?.toLowerCase() === "dev") {
  blockers.push("Opsi asesmen development Dinsos masih aktif");
}

if (unresolvedWarga > 0) warnings.push(`Warga belum resolved: ${unresolvedWarga}`);
if (legacyUsers > 0) warnings.push(`Akun legacy tanpa username/NIP: ${legacyUsers}`);
if (untestedIntegrations > 0) warnings.push(`Integrasi belum dites: ${untestedIntegrations}`);
if (openCriticalAlerts > 0) warnings.push(`Peringatan kritis terbuka: ${openCriticalAlerts}`);
if ((integrations.data ?? []).every((item) => !item.endpoint_url)) {
  warnings.push("Endpoint integrasi resmi belum dikonfigurasi");
}
if (process.env.APP_ORIGIN?.includes("localhost")) {
  warnings.push("APP_ORIGIN masih menunjuk localhost; ganti saat deployment");
}
if (waitingStabilization > 0) warnings.push(`Kasus menunggu stabilisasi: ${waitingStabilization}`);
if (waitingSplit > 0) warnings.push(`Kasus menunggu Split Jalur: ${waitingSplit}`);
warnings.push("Kebijakan numeric scoring Dinsos belum disetujui");
warnings.push("Rentang pendapatan asesmen menunggu persetujuan stakeholder Dinsos");

info.push(`Total pengguna: ${totalUsers}`);
info.push(`Total integrasi: ${totalIntegrations}`);
info.push(`Total log audit: ${totalLogs}`);
info.push(`Total master wilayah: ${totalWilayah}`);

console.log("BLOCKERS");
console.log(blockers.length ? blockers.map((item) => `- ${item}`).join("\n") : "- NONE");
console.log("WARNINGS");
console.log(warnings.length ? warnings.map((item) => `- ${item}`).join("\n") : "- NONE");
console.log("INFO");
console.log(info.map((item) => `- ${item}`).join("\n"));

if (blockers.length > 0) process.exitCode = 1;
