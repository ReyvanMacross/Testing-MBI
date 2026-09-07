import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { redactAuditMetadata } from "../lib/audit/redact-audit-metadata.ts";
import {
  loadProjectEnvironment,
  PROJECT_ROOT,
} from "./lib/project-env.mjs";

await loadProjectEnvironment();

const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const adminPassword = process.env.SUPABASE_TEST_PASSWORD;
assert.ok(supabaseUrl && publishableKey && adminPassword);

const sensitiveTables = [
  "user_profiles",
  "integrasi_api",
  "log_aktivitas",
  "warga",
  "v_warga_desil_current",
  "v_warga_desil_current_resolved",
  "dinsos_cases",
  "dinsos_asesmen_sosial",
  "dinsos_case_results",
  "referral_mbi",
  "user_capabilities",
  "dinsos_assessment_types",
  "dinsos_assessments",
  "dinsos_assessment_reviews",
  "dinsos_path_overrides",
  "penentuan_jalur",
  "master_program_layanan",
  "referral_mbi_events",
];
const adminRpcs = [
  "list_managed_users",
  "list_activity_logs",
  "activity_log_filter_options",
  "list_integrations",
  "integration_summary",
  "dinsos_queue_summary",
  "list_dinsos_cases",
  "dinsos_assessment_summary",
  "list_dinsos_assessments",
  "dinsos_review_assessment",
  "dinsos_target_opd_allowed",
  "dinsos_publish_path_referral",
  "dinsos_referral_summary",
  "list_dinsos_referrals",
  "dinsos_send_referral",
  "transition_referral_status",
];
const migrationAdminRpcs = ["dinsos_warga_summary", "list_dinsos_warga"];
const rpcBodies = {
  dinsos_review_assessment: {
    p_assessment_id: "00000000-0000-4000-8000-000000000001",
    p_actor_id: "00000000-0000-4000-8000-000000000002",
    p_decision: "APPROVED",
  },
  dinsos_target_opd_allowed: {
    p_path: "PEKERJA",
    p_target_opd_id: "00000000-0000-4000-8000-000000000001",
  },
  dinsos_publish_path_referral: {
    p_case_id: "00000000-0000-4000-8000-000000000001",
    p_actor_id: "00000000-0000-4000-8000-000000000002",
    p_path: "PEKERJA",
    p_target_opd_id: "00000000-0000-4000-8000-000000000003",
  },
  dinsos_send_referral: {
    p_referral_id: "00000000-0000-4000-8000-000000000001",
    p_actor_id: "00000000-0000-4000-8000-000000000002",
    p_program_id: "00000000-0000-4000-8000-000000000003",
    p_referral_date: "2026-09-07",
  },
  transition_referral_status: {
    p_referral_id: "00000000-0000-4000-8000-000000000001",
    p_to_status: "DITERIMA",
  },
};

async function assertDenied(response, label) {
  const body = await response.text();
  assert.ok(
    response.status === 401 || response.status === 403,
    `${label} returned ${response.status} (${body.length} bytes)`,
  );
}

for (const table of sensitiveTables) {
  await assertDenied(
    await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, {
      headers: { apikey: publishableKey },
    }),
    `anon table ${table}`,
  );
}
for (const rpc of adminRpcs) {
  await assertDenied(
    await fetch(`${supabaseUrl}/rest/v1/rpc/${rpc}`, {
      method: "POST",
      headers: { apikey: publishableKey, "Content-Type": "application/json" },
      body: JSON.stringify(rpcBodies[rpc] ?? {}),
    }),
    `anon RPC ${rpc}`,
  );
}
for (const rpc of migrationAdminRpcs) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpc}`, {
    method: "POST",
    headers: { apikey: publishableKey, "Content-Type": "application/json" },
    body: "{}",
  });
  if (response.status !== 404) await assertDenied(response, `anon RPC ${rpc}`);
}

const browser = createClient(supabaseUrl, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const signIn = await browser.auth.signInWithPassword({
  email: "admin.mbi@bandung.go.id",
  password: adminPassword,
});
if (signIn.error) throw signIn.error;
const token = signIn.data.session.access_token;
const authenticatedHeaders = {
  apikey: publishableKey,
  Authorization: `Bearer ${token}`,
};

for (const table of sensitiveTables) {
  await assertDenied(
    await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, {
      headers: authenticatedHeaders,
    }),
    `authenticated table ${table}`,
  );
}
for (const rpc of adminRpcs) {
  await assertDenied(
    await fetch(`${supabaseUrl}/rest/v1/rpc/${rpc}`, {
      method: "POST",
      headers: { ...authenticatedHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(rpcBodies[rpc] ?? {}),
    }),
    `authenticated RPC ${rpc}`,
  );
}
for (const rpc of migrationAdminRpcs) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpc}`, {
    method: "POST",
    headers: { ...authenticatedHeaders, "Content-Type": "application/json" },
    body: "{}",
  });
  if (response.status !== 404) await assertDenied(response, `authenticated RPC ${rpc}`);
}
await browser.auth.signOut({ scope: "local" });

const invalidLogin = JSON.stringify({ identifier: "invalid", password: "invalid" });
const noOrigin = await fetch(`${appOrigin}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: invalidLogin,
});
assert.equal(noOrigin.status, 403);

const wrongOrigin = await fetch(`${appOrigin}/api/auth/login`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: "https://invalid.example",
    "Sec-Fetch-Site": "cross-site",
  },
  body: invalidLogin,
});
assert.equal(wrongOrigin.status, 403);

const oversized = await fetch(`${appOrigin}/api/auth/login`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: appOrigin,
    "Sec-Fetch-Site": "same-origin",
  },
  body: JSON.stringify({ identifier: "a".repeat(9000), password: "x" }),
});
assert.equal(oversized.status, 413);

const unauthenticatedAdmin = await fetch(`${appOrigin}/api/admin/integrations`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: appOrigin,
    "Sec-Fetch-Site": "same-origin",
  },
  body: "{}",
});
assert.equal(unauthenticatedAdmin.status, 401);

const crossOriginAdmin = await fetch(`${appOrigin}/api/admin/integrations`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: "https://invalid.example",
    "Sec-Fetch-Site": "cross-site",
  },
  body: "{}",
});
assert.equal(crossOriginAdmin.status, 403);

const oversizedAdmin = await fetch(`${appOrigin}/api/admin/integrations`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: appOrigin,
    "Sec-Fetch-Site": "same-origin",
  },
  body: JSON.stringify({ notes: "a".repeat(33_000) }),
});
assert.equal(oversizedAdmin.status, 413);

const pageResponse = await fetch(`${appOrigin}/login`);
for (const [header, expected] of [
  ["x-content-type-options", "nosniff"],
  ["x-frame-options", "DENY"],
  ["referrer-policy", "no-referrer"],
]) {
  assert.equal(pageResponse.headers.get(header), expected);
}
assert.match(pageResponse.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);

const protectedResponse = await fetch(`${appOrigin}/diskominfo`, {
  redirect: "manual",
});
assert.match(protectedResponse.headers.get("cache-control") ?? "", /no-store/);

const redacted = redactAuditMetadata({
  accessToken: "sensitive",
  nested: { password: "sensitive", safe: "retained" },
  values: [{ api_key: "sensitive" }],
});
assert.deepEqual(redacted, {
  accessToken: "[REDACTED]",
  nested: { password: "[REDACTED]", safe: "retained" },
  values: [{ api_key: "[REDACTED]" }],
});

const activityWriterSource = await readFile(
  path.join(PROJECT_ROOT, "lib", "audit", "write-activity-log.ts"),
  "utf8",
);
const wargaRegistryMigration = await readFile(
  path.join(
    PROJECT_ROOT,
    "supabase",
    "migrations",
    "202609060009_dinsos_warga_registry.sql",
  ),
  "utf8",
);
for (const rpc of migrationAdminRpcs) {
  assert.match(wargaRegistryMigration, new RegExp(`revoke all on function public\\.${rpc}`));
  assert.match(wargaRegistryMigration, new RegExp(`grant execute on function public\\.${rpc}`));
}
assert.match(
  activityWriterSource,
  /metadata:\s*redactAuditMetadata\(input\.metadata \?\? \{\}\)/,
  "The centralized audit writer must apply metadata redaction.",
);

const mutationRoutes = [
  "app/api/auth/login/route.ts",
  "app/api/auth/logout/route.ts",
  "app/api/admin/users/route.ts",
  "app/api/admin/users/[id]/route.ts",
  "app/api/admin/integrations/route.ts",
  "app/api/admin/integrations/[id]/route.ts",
  "app/api/admin/integrations/[id]/test/route.ts",
  "app/api/dinsos/cases/[caseId]/assessment/draft/route.ts",
  "app/api/dinsos/cases/[caseId]/assessment/complete/route.ts",
  "app/api/dinsos/cases/[caseId]/result/override/route.ts",
  "app/api/dinsos/cases/[caseId]/result/confirm/route.ts",
  "app/api/dinsos/cases/[caseId]/stabilization/send/route.ts",
  "app/api/dinsos/warga/[wargaId]/route.ts",
  "app/api/dinsos/assessments/route.ts",
  "app/api/dinsos/assessments/[assessmentId]/review/route.ts",
  "app/api/dinsos/cases/[caseId]/path/publish/route.ts",
  "app/api/dinsos/referrals/[referralId]/send/route.ts",
];
for (const route of mutationRoutes) {
  const source = await readFile(path.join(PROJECT_ROOT, route), "utf8");
  assert.match(source, /assertSameOrigin\(request\)|assertSameOrigin\(_request\)/);
  if (!route.includes("/logout/")) {
    assert.match(source, /assertBodySize\(request|assertBodySize\(_request/);
  }
}

console.log(JSON.stringify({
  directAnonTables: "DENIED",
  directAuthenticatedTables: "DENIED",
  adminRpcs: "SERVICE_ROLE_ONLY",
  sameOrigin: "PASS",
  payloadLimit: "PASS",
  securityHeaders: "PASS",
  cacheControl: "PASS",
  auditRedaction: "PASS",
}, null, 2));
