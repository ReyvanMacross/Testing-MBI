import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseAdminEnvironment,
  loadProjectEnvironment,
} from "./lib/project-env.mjs";

const EXPECTED_DINSOS_CAPABILITIES = [
  "DINSOS_WARGA_EDIT",
  "DINSOS_ASSESSMENT_REVIEW",
  "DINSOS_DESIL_OVERRIDE",
  "DINSOS_PATH_OVERRIDE",
];
const BROWSER_DENIED_TABLES = [
  "dinsos_cases",
  "dinsos_asesmen_sosial",
  "dinsos_case_results",
  "dinsos_desil_overrides",
  "dinsos_case_events",
  "dinsos_assessment_types",
  "dinsos_assessments",
  "dinsos_assessment_reviews",
  "penentuan_jalur",
  "dinsos_path_overrides",
  "referral_mbi",
  "referral_mbi_events",
  "master_program_layanan",
  "user_capabilities",
];
const TEST_PROFILE_IDS = [
  "3b6bf014-f8c7-48c8-ae72-0cb1e70e6b5c",
  "18319332-ee6b-4b29-b226-74b234119169",
  "bc9ddc99-b7ff-4a6c-a73e-b8147ec4a4c6",
];
const SENSITIVE_METADATA_KEY =
  /^(?:nik|nomor_kk|alamat|nomor_hp|email|penyakit|disabilitas|observation|instruction|password|token|secret|authorization|cookie)$/i;
const ACTIVE_REFERRAL = new Set([
  "MENUNGGU_RUJUKAN",
  "TERKIRIM",
  "DITERIMA",
  "DIPROSES",
]);
const SENT_REFERRAL = new Set(["TERKIRIM", "DITERIMA", "DIPROSES", "SELESAI"]);

function findSensitiveMetadata(value, location = "metadata", findings = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      findSensitiveMetadata(item, `${location}[${index}]`, findings),
    );
    return findings;
  }
  if (!value || typeof value !== "object") return findings;
  for (const [key, item] of Object.entries(value)) {
    const itemLocation = `${location}.${key}`;
    if (SENSITIVE_METADATA_KEY.test(key) && item !== "[REDACTED]") {
      findings.push(itemLocation);
    }
    findSensitiveMetadata(item, itemLocation, findings);
  }
  return findings;
}

function addCountBlocker(target, label, rows) {
  if (rows.length) target.push(`${label}: ${rows.length}`);
}

function printSection(title, entries, empty = "PASS") {
  console.log(title);
  console.log(entries.length ? entries.map((entry) => `- ${entry}`).join("\n") : `- ${empty}`);
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

async function checked(query) {
  const result = await query;
  if (result.error) throw result.error;
  return result.data ?? [];
}

await loadProjectEnvironment();
const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const admin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const [
  cases,
  structuredAssessments,
  results,
  registryAssessments,
  reviews,
  paths,
  pathOverrides,
  referrals,
  referralEvents,
  programs,
  caseEvents,
  activityLogs,
  capabilities,
  profiles,
  opds,
  integrations,
  activeE2eAccounts,
  activeKnownTestAccounts,
  unresolvedWarga,
  legacyUsers,
  assessmentFixtures,
  caseFixtures,
  referralFixtures,
  devPrograms,
  productionPrograms,
  openCriticalAlerts,
  untestedIntegrations,
] = await Promise.all([
  checked(admin.from("dinsos_cases").select("id,warga_id,current_stage,closed_at,is_fixture")),
  checked(admin.from("dinsos_asesmen_sosial").select("id,case_id,status,registry_assessment_id,completed_at")),
  checked(admin.from("dinsos_case_results").select("id,case_id,assessment_id,status,disposition,confirmed_at")),
  checked(admin.from("dinsos_assessments").select("id,warga_id,case_id,status,reassessment_of_id,is_fixture")),
  checked(admin.from("dinsos_assessment_reviews").select("id,assessment_id,decision,approved_path,target_opd_id")),
  checked(admin.from("penentuan_jalur").select("id,warga_id,assessment_id,case_id,output_jalur,approved_path_snapshot,target_opd_id,decision_source,decision_status,finalized_by,finalized_at")),
  checked(admin.from("dinsos_path_overrides").select("id,path_decision_id,assessment_id,old_path,new_path,created_at")),
  checked(admin.from("referral_mbi").select("id,case_id,warga_id,referral_type,target_opd_id,status,sent_at,referral_date,program_id,assessment_id,path_decision_id,jalur,received_at,processing_started_at,completed_at,metadata,is_fixture")),
  checked(admin.from("referral_mbi_events").select("id,referral_id,event_type,event_at,metadata")),
  checked(admin.from("master_program_layanan").select("id,kode_program,opd_id,is_active")),
  checked(admin.from("dinsos_case_events").select("id,case_id,event_type,metadata,created_at")),
  checked(admin.from("log_aktivitas").select("id,metadata")),
  checked(admin.from("user_capabilities").select("user_id,capability")),
  checked(admin.from("user_profiles").select("id,email,auth_user_id,status,role,opd_id,username,nip")),
  checked(admin.from("master_opd").select("id,kode_opd")),
  checked(admin.from("integrasi_api").select("id,layanan,instansi,status,endpoint_url,credential_type,credential_ref,notes")),
  count(admin.from("user_profiles").select("id", { count: "exact", head: true }).like("email", "e2e.user.%@example.invalid").eq("status", "AKTIF")),
  count(admin.from("user_profiles").select("id", { count: "exact", head: true }).in("id", TEST_PROFILE_IDS).eq("status", "AKTIF")),
  count(admin.from("warga").select("id", { count: "exact", head: true }).or("kecamatan_id.is.null,kelurahan_id.is.null")),
  count(admin.from("user_profiles").select("id", { count: "exact", head: true }).is("username", null).is("nip", null)),
  count(admin.from("dinsos_assessments").select("id", { count: "exact", head: true }).eq("is_fixture", true)),
  count(admin.from("dinsos_cases").select("id", { count: "exact", head: true }).eq("is_fixture", true)),
  count(admin.from("referral_mbi").select("id", { count: "exact", head: true }).eq("is_fixture", true)),
  count(admin.from("master_program_layanan").select("id", { count: "exact", head: true }).like("kode_program", "DEV-%")),
  count(admin.from("master_program_layanan").select("id", { count: "exact", head: true }).not("kode_program", "like", "DEV-%")),
  count(admin.from("system_alerts").select("id", { count: "exact", head: true }).eq("status", "OPEN").eq("severity", "CRITICAL")),
  count(admin.from("integrasi_api").select("id", { count: "exact", head: true }).eq("status", "BELUM_DITEST")),
]);

const domainBlockers = [];
const privacyBlockers = [];
const capabilityBlockers = [];
const fixtureBlockers = [];
const configurationBlockers = [];
const securityBlockers = [];
const applicationBlockers = [];
const deploymentBlockers = [
  "Clean migration rebuild dari database kosong belum diverifikasi.",
  "Backup dan restore ke database terisolasi belum diverifikasi.",
  "Login edge rate limiting untuk POST /api/auth/login belum tersedia.",
];
const warnings = [];

const caseById = new Map(cases.map((row) => [row.id, row]));
const structuredByCase = new Map(structuredAssessments.map((row) => [row.case_id, row]));
const resultByCase = new Map(results.map((row) => [row.case_id, row]));
const assessmentById = new Map(registryAssessments.map((row) => [row.id, row]));
const reviewsByAssessment = new Map();
for (const review of reviews) {
  const list = reviewsByAssessment.get(review.assessment_id) ?? [];
  list.push(review);
  reviewsByAssessment.set(review.assessment_id, list);
}
const pathsByCase = new Map();
for (const decision of paths) {
  const list = pathsByCase.get(decision.case_id) ?? [];
  list.push(decision);
  pathsByCase.set(decision.case_id, list);
}
const overridesByPath = new Map();
for (const override of pathOverrides) {
  const list = overridesByPath.get(override.path_decision_id) ?? [];
  list.push(override);
  overridesByPath.set(override.path_decision_id, list);
}
const referralsByCase = new Map();
for (const referral of referrals) {
  const list = referralsByCase.get(referral.case_id) ?? [];
  list.push(referral);
  referralsByCase.set(referral.case_id, list);
}
const programById = new Map(programs.map((row) => [row.id, row]));
const eventsByReferral = new Map();
for (const event of referralEvents) {
  const list = eventsByReferral.get(event.referral_id) ?? [];
  list.push(event);
  eventsByReferral.set(event.referral_id, list);
}

addCountBlocker(domainBlockers, "Orphan structured assessment", structuredAssessments.filter((row) => !caseById.has(row.case_id)));
addCountBlocker(domainBlockers, "Orphan assessment registry", registryAssessments.filter((row) => row.case_id && !caseById.has(row.case_id)));
addCountBlocker(domainBlockers, "Orphan path decision", paths.filter((row) => row.case_id && !caseById.has(row.case_id)));
addCountBlocker(domainBlockers, "Orphan referral", referrals.filter((row) => !caseById.has(row.case_id)));

const invalidAssessmentReviews = registryAssessments.filter((assessment) => {
  const related = reviewsByAssessment.get(assessment.id) ?? [];
  if (assessment.status === "DISETUJUI") return related.length !== 1 || related[0].decision !== "APPROVED";
  if (assessment.status === "MINTA_REASESMEN") return related.length !== 1 || related[0].decision !== "REQUEST_REASSESSMENT";
  if (assessment.status === "PERLU_REVIEW") return related.length !== 0;
  return false;
});
addCountBlocker(domainBlockers, "Invalid assessment/review relationship", invalidAssessmentReviews);

const invalidReassessments = registryAssessments.filter((assessment) => {
  if (!assessment.reassessment_of_id) return false;
  const previous = assessmentById.get(assessment.reassessment_of_id);
  return !previous || previous.warga_id !== assessment.warga_id || previous.status !== "MINTA_REASESMEN";
});
addCountBlocker(domainBlockers, "Invalid reassessment relationship", invalidReassessments);

const nonLegacyFinalPaths = paths.filter((row) => row.decision_source !== "LEGACY" && row.decision_status === "FINAL");
addCountBlocker(
  domainBlockers,
  "Incomplete non-legacy final path",
  nonLegacyFinalPaths.filter((row) => !row.assessment_id || !row.case_id || !row.target_opd_id || !row.finalized_by || !row.finalized_at || !row.approved_path_snapshot),
);

const invalidPathAssessment = nonLegacyFinalPaths.filter((path) => {
  const assessment = assessmentById.get(path.assessment_id);
  const reviewRows = reviewsByAssessment.get(path.assessment_id) ?? [];
  const review = reviewRows.length === 1 ? reviewRows[0] : null;
  const overrides = overridesByPath.get(path.id) ?? [];
  if (!assessment || assessment.status !== "DISETUJUI" || !review) return true;
  if (review.approved_path !== path.approved_path_snapshot) return true;
  if (path.decision_source === "ASSESSMENT_REVIEW") return path.output_jalur !== review.approved_path || overrides.length !== 0;
  if (path.decision_source === "MANUAL_OVERRIDE") return overrides.length !== 1 || overrides[0].new_path !== path.output_jalur;
  return true;
});
addCountBlocker(domainBlockers, "Invalid path/assessment/override relationship", invalidPathAssessment);

const invalidCaseStages = cases.filter((caseRow) => {
  const structured = structuredByCase.get(caseRow.id);
  const result = resultByCase.get(caseRow.id);
  const registry = registryAssessments.filter((row) => row.case_id === caseRow.id);
  const caseReferrals = referralsByCase.get(caseRow.id) ?? [];
  const activeJalur = caseReferrals.filter((row) => row.referral_type === "JALUR_MBI" && ACTIVE_REFERRAL.has(row.status));
  switch (caseRow.current_stage) {
    case "MENUNGGU_ASESMEN":
      return Boolean(structured?.status === "COMPLETED" || result || (pathsByCase.get(caseRow.id) ?? []).length || caseReferrals.length);
    case "MENUNGGU_PENETAPAN_DESIL":
      return !structured || structured.status !== "COMPLETED";
    case "STABILISASI_DIBUTUHKAN":
      return !result || result.status !== "CONFIRMED" || result.disposition !== "STABILISASI_SOSIAL";
    case "MENUNGGU_STABILISASI":
      return !result || result.status !== "CONFIRMED" || result.disposition !== "STABILISASI_SOSIAL" || !caseReferrals.some((row) => row.referral_type === "PROTEKSI_STABILISASI" && ACTIVE_REFERRAL.has(row.status));
    case "MENUNGGU_SPLIT_JALUR":
      return !registry.some((row) => row.status === "DISETUJUI") || activeJalur.length !== 0;
    case "MENUNGGU_RUJUKAN":
      return !activeJalur.some((row) => row.status === "MENUNGGU_RUJUKAN");
    case "REFERRAL_TERKIRIM":
      return !caseReferrals.some((row) => SENT_REFERRAL.has(row.status));
    default:
      return false;
  }
});
addCountBlocker(domainBlockers, "Invalid case stage relationship", invalidCaseStages);

const activeReferralGroups = new Map();
for (const referral of referrals.filter((row) => ACTIVE_REFERRAL.has(row.status))) {
  const key = `${referral.case_id}:${referral.referral_type}`;
  activeReferralGroups.set(key, (activeReferralGroups.get(key) ?? 0) + 1);
}
addCountBlocker(domainBlockers, "Duplicate active referral", [...activeReferralGroups.values()].filter((value) => value > 1));

const invalidReferralPaths = referrals.filter((referral) => {
  if (referral.referral_type !== "JALUR_MBI") return false;
  const path = paths.find((row) => row.id === referral.path_decision_id);
  const caseRow = caseById.get(referral.case_id);
  return !path || path.decision_status !== "FINAL" || referral.jalur !== path.output_jalur || referral.target_opd_id !== path.target_opd_id || referral.warga_id !== caseRow?.warga_id || referral.assessment_id !== path.assessment_id;
});
addCountBlocker(domainBlockers, "Invalid referral/path relationship", invalidReferralPaths);

const invalidReferralTimestamps = referrals.filter((referral) => {
  if (referral.referral_type === "JALUR_MBI") {
    if (referral.status === "MENUNGGU_RUJUKAN" && (referral.sent_at || referral.referral_date || referral.program_id)) return true;
    if (SENT_REFERRAL.has(referral.status) && (!referral.sent_at || !referral.referral_date || !referral.program_id)) return true;
  }
  if (["DITERIMA", "DIPROSES", "SELESAI"].includes(referral.status) && !referral.received_at) return true;
  if (["DIPROSES", "SELESAI"].includes(referral.status) && !referral.processing_started_at) return true;
  if (referral.status === "SELESAI" && !referral.completed_at) return true;
  if (referral.received_at && (!referral.sent_at || referral.received_at < referral.sent_at)) return true;
  if (referral.processing_started_at && (!referral.received_at || referral.processing_started_at < referral.received_at)) return true;
  return Boolean(referral.completed_at && (!referral.processing_started_at || referral.completed_at < referral.processing_started_at));
});
addCountBlocker(domainBlockers, "Invalid referral timestamps", invalidReferralTimestamps);

const invalidPrograms = referrals.filter((referral) => {
  if (referral.referral_type !== "JALUR_MBI" || !SENT_REFERRAL.has(referral.status)) return false;
  const program = programById.get(referral.program_id);
  return !program || program.opd_id !== referral.target_opd_id;
});
addCountBlocker(domainBlockers, "Invalid referral program relationship", invalidPrograms);

const invalidEventChains = referrals.filter((referral) => {
  const events = eventsByReferral.get(referral.id) ?? [];
  const types = new Set(events.map((event) => event.event_type));
  const required = ["CREATED"];
  if (SENT_REFERRAL.has(referral.status)) required.push("SENT");
  if (["DITERIMA", "DIPROSES", "SELESAI"].includes(referral.status)) required.push("RECEIVED");
  if (["DIPROSES", "SELESAI"].includes(referral.status)) required.push("PROCESS_STARTED");
  if (referral.status === "SELESAI") required.push("COMPLETED");
  if (referral.status === "DIBATALKAN") required.push("CANCELLED");
  const duplicates = ["CREATED", "SENT", "RECEIVED", "PROCESS_STARTED", "COMPLETED", "CANCELLED"].some((type) => events.filter((event) => event.event_type === type).length > 1);
  const transitionOrder = ["CREATED", "SENT", "RECEIVED", "PROCESS_STARTED", "COMPLETED"]
    .map((type) => events.find((event) => event.event_type === type))
    .filter(Boolean);
  const cancelled = events.find((event) => event.event_type === "CANCELLED");
  if (cancelled) transitionOrder.push(cancelled);
  const backward = transitionOrder.some((event, index) =>
    index > 0 && new Date(event.event_at).getTime() < new Date(transitionOrder[index - 1].event_at).getTime());
  return required.some((type) => !types.has(type)) || duplicates || backward;
});
addCountBlocker(domainBlockers, "Invalid referral event chain", invalidEventChains);
addCountBlocker(domainBlockers, "Orphan referral event", referralEvents.filter((event) => !referrals.some((row) => row.id === event.referral_id)));

for (const [table, rows] of [
  ["log_aktivitas", activityLogs],
  ["dinsos_case_events", caseEvents],
  ["referral_mbi_events", referralEvents],
  ["referral_mbi", referrals],
]) {
  for (const row of rows) {
    const findings = findSensitiveMetadata(row.metadata);
    if (/\b\d{16}\b/u.test(JSON.stringify(row.metadata ?? {}))) findings.push("metadata.full_identifier");
    if (findings.length) privacyBlockers.push(`${table}:${row.id} (${findings.join(", ")})`);
  }
}

const opdById = new Map(opds.map((row) => [row.id, row.kode_opd]));
const profileById = new Map(profiles.map((row) => [row.id, row]));
for (const capability of capabilities.filter((row) => row.capability.startsWith("DINSOS_"))) {
  const profile = profileById.get(capability.user_id);
  if (!profile || profile.status !== "AKTIF" || profile.role !== "INTERVENSI" || opdById.get(profile.opd_id) !== "DINSOS") {
    capabilityBlockers.push(`Capability ${capability.capability} assigned outside active DINSOS actor`);
  }
}
const dinsosAdmin = profiles.find((row) => row.email === "dinsos@bandung.go.id");
if (!dinsosAdmin || !dinsosAdmin.auth_user_id || dinsosAdmin.status !== "AKTIF" || dinsosAdmin.role !== "INTERVENSI" || opdById.get(dinsosAdmin.opd_id) !== "DINSOS") {
  capabilityBlockers.push("Admin Dinsos is not active, linked, and assigned to DINSOS");
} else {
  const adminCapabilities = new Set(capabilities.filter((row) => row.user_id === dinsosAdmin.id).map((row) => row.capability));
  for (const expected of EXPECTED_DINSOS_CAPABILITIES) {
    if (!adminCapabilities.has(expected)) capabilityBlockers.push(`Admin Dinsos missing ${expected}`);
  }
}

if (caseFixtures) fixtureBlockers.push(`dinsos_cases fixture remaining: ${caseFixtures}`);
if (assessmentFixtures) fixtureBlockers.push(`dinsos_assessments fixture remaining: ${assessmentFixtures}`);
if (referralFixtures) fixtureBlockers.push(`referral_mbi fixture remaining: ${referralFixtures}`);
if (devPrograms) fixtureBlockers.push(`DEV program remaining: ${devPrograms}`);
if (activeE2eAccounts + activeKnownTestAccounts) fixtureBlockers.push(`Active test account remaining: ${activeE2eAccounts + activeKnownTestAccounts}`);

const allowedHosts = hostAllowlist();
for (const integration of integrations) {
  if (integration.endpoint_url) {
    try {
      const host = new URL(integration.endpoint_url).hostname.toLowerCase();
      if (!allowedHosts.has(host)) configurationBlockers.push(`Integration endpoint host is not allowlisted: ${integration.id}`);
    } catch {
      configurationBlockers.push(`Integration endpoint is invalid: ${integration.id}`);
    }
  }
  const validCredential = (integration.credential_type === "NONE" && !integration.credential_ref) || (integration.credential_type === "BEARER" && /^[A-Z][A-Z0-9_]{2,100}$/u.test(integration.credential_ref ?? ""));
  if (!validCredential) configurationBlockers.push(`Integration credential reference is invalid: ${integration.id}`);
}
if (process.env.DINSOS_ASSESSMENT_OPTIONS_SOURCE?.toLowerCase() === "dev") configurationBlockers.push("DINSOS_ASSESSMENT_OPTIONS_SOURCE=dev");

const readable = [];
if (!publishableKey) {
  securityBlockers.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing");
} else {
  const anonHeaders = { apikey: publishableKey };
  const browser = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const browserLogin = await browser.auth.signInWithPassword({
    email: process.env.DINSOS_ADMIN_EMAIL ?? "dinsos@bandung.go.id",
    password: process.env.DINSOS_ADMIN_PASSWORD ?? process.env.E2E_DINSOS_PASSWORD ?? "",
  });
  if (browserLogin.error || !browserLogin.data.session) securityBlockers.push("Authenticated Dinsos RLS audit login failed");
  const authenticatedHeaders = browserLogin.data.session ? { apikey: publishableKey, Authorization: `Bearer ${browserLogin.data.session.access_token}` } : null;
  for (const table of BROWSER_DENIED_TABLES) {
    for (const [actor, headers] of [["anon", anonHeaders], ["authenticated", authenticatedHeaders]]) {
      if (!headers) continue;
      const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, { headers });
      if (![401, 403].includes(response.status)) readable.push(`${actor}:${table}:${response.status}`);
    }
  }
  await browser.auth.signOut({ scope: "local" });
}
if (readable.length) securityBlockers.push(`Browser-readable Dinsos table: ${readable.join(", ")}`);

if (!process.env.APP_ORIGIN || process.env.APP_ORIGIN.includes("localhost")) deploymentBlockers.push("APP_ORIGIN belum memakai domain HTTPS production yang exact.");
if (productionPrograms === 0) {
  warnings.push("Master program production = 0");
  deploymentBlockers.push("PRODUCTION MASTER PROGRAM = 0");
}
if (unresolvedWarga) warnings.push(`${unresolvedWarga} warga unresolved`);
if (legacyUsers) warnings.push(`${legacyUsers} legacy users tanpa identifier`);
warnings.push("Numeric readiness scoring policy belum disetujui");
if (openCriticalAlerts) warnings.push(`${openCriticalAlerts} open critical system alert`);
if (integrations.every((row) => !row.endpoint_url)) warnings.push("Official integration endpoints absent");
if (untestedIntegrations) warnings.push(`${untestedIntegrations} integrasi belum dites`);

applicationBlockers.push(...domainBlockers, ...privacyBlockers, ...capabilityBlockers, ...fixtureBlockers, ...configurationBlockers, ...securityBlockers);

printSection("DINSOS DOMAIN INTEGRITY", domainBlockers);
printSection("DINSOS PRIVACY", privacyBlockers);
printSection("DINSOS CAPABILITIES", capabilityBlockers);
printSection("DINSOS FIXTURES", fixtureBlockers);
printSection("DINSOS CONFIGURATION", configurationBlockers);
printSection("SECURITY BLOCKERS", securityBlockers, "0");
printSection("APPLICATION BLOCKERS", applicationBlockers, "0");
printSection("WARNINGS", warnings, "NONE");
printSection("DEPLOYMENT BLOCKERS", deploymentBlockers, "0");
console.log("READINESS COUNTS");
console.log(`- APPLICATION BLOCKERS: ${applicationBlockers.length}`);
console.log(`- DINSOS DOMAIN BLOCKERS: ${domainBlockers.length}`);
console.log(`- SECURITY BLOCKERS: ${securityBlockers.length}`);
console.log(`- PRIVACY BLOCKERS: ${privacyBlockers.length}`);
console.log(`- FIXTURE BLOCKERS: ${fixtureBlockers.length}`);

if (applicationBlockers.length) process.exitCode = 1;
