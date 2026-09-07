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
  assessmentFixtures,
  assessmentsNeedsReview,
  assessmentsNeedReassessment,
  pathDecisions,
  pathReferrals,
  approvedAssessments,
  referralFixtures,
  programFixtures,
  referralEvents,
  programs,
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
  count(admin.from("dinsos_assessments").select("id", { count: "exact", head: true }).eq("is_fixture", true)),
  count(admin.from("dinsos_assessments").select("id", { count: "exact", head: true }).eq("status", "PERLU_REVIEW")),
  count(admin.from("dinsos_assessments").select("id", { count: "exact", head: true }).eq("status", "MINTA_REASESMEN")),
  admin.from("penentuan_jalur").select("id,assessment_id,case_id,decision_status,decision_source,approved_path_snapshot,output_jalur,target_opd_id"),
  admin.from("referral_mbi").select("id,assessment_id,path_decision_id,jalur,status,sent_at,program_id,target_opd_id,completed_at"),
  admin.from("dinsos_assessments").select("id").eq("status", "DISETUJUI"),
  count(admin.from("referral_mbi").select("id", { count: "exact", head: true }).eq("is_fixture", true)),
  count(admin.from("master_program_layanan").select("id", { count: "exact", head: true }).like("kode_program", "DEV-%")),
  admin.from("referral_mbi_events").select("id,referral_id"),
  admin.from("master_program_layanan").select("id,opd_id"),
]);

if (integrations.error) throw integrations.error;
if (auditMetadata.error) throw auditMetadata.error;
if (pathDecisions.error) throw pathDecisions.error;
if (pathReferrals.error) throw pathReferrals.error;
if (approvedAssessments.error) throw approvedAssessments.error;
if (referralEvents.error) throw referralEvents.error;
if (programs.error) throw programs.error;

const blockers = [];
const warnings = [];
const info = [];
const allowedHosts = hostAllowlist();

const assessmentBrowserReadable = [];
for (const table of [
  "dinsos_assessment_types",
  "dinsos_assessments",
  "dinsos_assessment_reviews",
  "penentuan_jalur",
  "referral_mbi",
  "dinsos_path_overrides",
  "master_program_layanan",
  "referral_mbi_events",
]) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" },
  });
  if (![401, 403].includes(response.status)) assessmentBrowserReadable.push(table);
}
if (assessmentBrowserReadable.length > 0) {
  blockers.push(`Tabel domain Dinsos dapat dibaca browser: ${assessmentBrowserReadable.join(", ")}`);
}

if (activeTestAccounts > 0) {
  blockers.push(`Akun uji aktif: ${activeTestAccounts}`);
}
if (developmentIntegrations > 0) {
  blockers.push(`Fixture integrasi development: ${developmentIntegrations}`);
}
if (dinsosFixtures > 0) blockers.push(`Fixture kasus/path Dinsos: ${dinsosFixtures}`);
if (assessmentFixtures > 0) blockers.push(`Fixture asesmen Dinsos: ${assessmentFixtures}`);
if (referralFixtures > 0) blockers.push(`Fixture referral Dinsos: ${referralFixtures}`);
if (programFixtures > 0) blockers.push(`Fixture program Dinsos: ${programFixtures}`);

const nonLegacyDecisions = (pathDecisions.data ?? []).filter(
  (item) => item.decision_source !== "LEGACY",
);
const orphanPathDecisions = nonLegacyDecisions.filter(
  (item) => !item.assessment_id || !item.case_id,
);
if (orphanPathDecisions.length > 0) {
  blockers.push(`Keputusan jalur orphan: ${orphanPathDecisions.length}`);
}
const finalWithoutTarget = nonLegacyDecisions.filter(
  (item) => item.decision_status === "FINAL" && !item.target_opd_id,
);
if (finalWithoutTarget.length > 0) {
  blockers.push(`Keputusan jalur FINAL tanpa OPD tujuan: ${finalWithoutTarget.length}`);
}
const finalDecisionsById = new Map(
  nonLegacyDecisions
    .filter((item) => item.decision_status === "FINAL")
    .map((item) => [item.id, item]),
);
const mismatchedFinalPath = (pathReferrals.data ?? []).filter((referral) => {
  if (!referral.path_decision_id) return false;
  const decision = finalDecisionsById.get(referral.path_decision_id);
  return Boolean(decision && referral.jalur !== decision.output_jalur);
});
if (mismatchedFinalPath.length > 0) {
  blockers.push(`Mapping jalur aplikasi/enum tidak valid: ${mismatchedFinalPath.length}`);
}

const activeReferralStatuses = new Set([
  "MENUNGGU_RUJUKAN",
  "TERKIRIM",
  "DITERIMA",
  "DIPROSES",
]);
const referralCounts = new Map();
for (const referral of pathReferrals.data ?? []) {
  if (referral.assessment_id && activeReferralStatuses.has(referral.status)) {
    referralCounts.set(
      referral.assessment_id,
      (referralCounts.get(referral.assessment_id) ?? 0) + 1,
    );
  }
}
const duplicateActiveReferrals = [...referralCounts.values()].filter(
  (countValue) => countValue > 1,
).length;
if (duplicateActiveReferrals > 0) {
  blockers.push(`Duplikasi referral aktif per asesmen: ${duplicateActiveReferrals}`);
}
const sentWithoutTimestamp = (pathReferrals.data ?? []).filter(
  (item) => ["TERKIRIM", "DITERIMA", "DIPROSES", "SELESAI"].includes(item.status) && !item.sent_at,
);
if (sentWithoutTimestamp.length > 0) {
  blockers.push(`Referral TERKIRIM tanpa sent_at: ${sentWithoutTimestamp.length}`);
}
const waitingWithSentAt = (pathReferrals.data ?? []).filter((item) => item.status === "MENUNGGU_RUJUKAN" && item.sent_at);
if (waitingWithSentAt.length > 0) blockers.push(`Referral MENUNGGU_RUJUKAN memiliki sent_at: ${waitingWithSentAt.length}`);
const sentWithoutProgram = (pathReferrals.data ?? []).filter((item) => ["TERKIRIM", "DITERIMA", "DIPROSES", "SELESAI"].includes(item.status) && !item.program_id);
if (sentWithoutProgram.length > 0) blockers.push(`Referral terkirim tanpa program: ${sentWithoutProgram.length}`);
const completedWithoutTimestamp = (pathReferrals.data ?? []).filter((item) => item.status === "SELESAI" && !item.completed_at);
if (completedWithoutTimestamp.length > 0) blockers.push(`Referral SELESAI tanpa completed_at: ${completedWithoutTimestamp.length}`);
const referralIds = new Set((pathReferrals.data ?? []).map((item) => item.id));
const orphanEvents = (referralEvents.data ?? []).filter((event) => !referralIds.has(event.referral_id));
if (orphanEvents.length > 0) blockers.push(`Event referral orphan: ${orphanEvents.length}`);
const programById = new Map((programs.data ?? []).map((program) => [program.id, program]));
const mismatchedPrograms = (pathReferrals.data ?? []).filter((referral) => referral.program_id && programById.get(referral.program_id)?.opd_id !== referral.target_opd_id);
if (mismatchedPrograms.length > 0) blockers.push(`Program dan OPD referral tidak cocok: ${mismatchedPrograms.length}`);
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
if (assessmentsNeedsReview > 0) warnings.push(`Asesmen membutuhkan review: ${assessmentsNeedsReview}`);
if (assessmentsNeedReassessment > 0) warnings.push(`Asesmen meminta re-asesmen: ${assessmentsNeedReassessment}`);
const approvedWithoutReferral = (approvedAssessments.data ?? []).filter(
  (item) => !referralCounts.has(item.id),
).length;
if (approvedWithoutReferral > 0) {
  warnings.push(`Asesmen disetujui belum diterbitkan referral: ${approvedWithoutReferral}`);
}
const waitingReferralCount = (pathReferrals.data ?? []).filter((item) => item.status === "MENUNGGU_RUJUKAN").length;
if (waitingReferralCount > 0) warnings.push(`Referral menunggu proses pengiriman: ${waitingReferralCount}`);
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
