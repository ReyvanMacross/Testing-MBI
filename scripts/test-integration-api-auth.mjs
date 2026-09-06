import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseAdminEnvironment,
  loadProjectEnvironment,
} from "./lib/project-env.mjs";

await loadProjectEnvironment();
const baseUrl = "http://localhost:3000";
const originHeaders = {
  Origin: process.env.APP_ORIGIN ?? baseUrl,
  "Sec-Fetch-Site": "same-origin",
};
const validPayload = {
  layanan: "Authorization Probe",
  instansi: "Fixture Development",
  opdId: null,
  endpointUrl: null,
  httpMethod: "GET",
  timeoutMs: 5000,
  expectedStatusMin: 200,
  expectedStatusMax: 299,
  credentialType: "NONE",
  credentialRef: null,
  healthcheckEnabled: false,
  isCritical: false,
  criticalOrder: null,
  notes: "Authorization-only request; must never be inserted.",
};

const unauthorized = await fetch(`${baseUrl}/api/admin/integrations`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...originHeaders },
  body: JSON.stringify(validPayload),
});
assert.equal(unauthorized.status, 401);

async function login(identifier, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...originHeaders },
    body: JSON.stringify({ identifier, password }),
  });
  assert.equal(response.status, 200);
  return response.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
}

const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const admin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const operator = await admin
  .from("user_profiles")
  .select("id")
  .eq("username", "operator.lapangan.test")
  .single();
if (operator.error) throw operator.error;
await admin.from("user_profiles").update({ status: "AKTIF" }).eq("id", operator.data.id);

let forbiddenStatus;
try {
  const operatorCookie = await login(
    "operator.lapangan.test",
    process.env.SUPABASE_TEST_FIELD_PASSWORD,
  );
  const forbidden = await fetch(`${baseUrl}/api/admin/integrations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: operatorCookie, ...originHeaders },
    body: JSON.stringify(validPayload),
  });
  forbiddenStatus = forbidden.status;
  assert.equal(forbidden.status, 403);
} finally {
  await admin.from("user_profiles").update({ status: "NONAKTIF" }).eq("id", operator.data.id);
}

const adminCookie = await login("admin.mbi", process.env.SUPABASE_TEST_PASSWORD);
const fixtureId = "77e6d60c-d253-4eab-98fa-fc89fd20bd12";
const allowed = await fetch(`${baseUrl}/api/admin/integrations/${fixtureId}`, {
  headers: { Cookie: adminCookie, ...originHeaders },
});
assert.equal(allowed.status, 200);
const manualWithoutEndpoint = await fetch(`${baseUrl}/api/admin/integrations/${fixtureId}/test`, {
  method: "POST",
  headers: { Cookie: adminCookie, ...originHeaders },
});
assert.equal(manualWithoutEndpoint.status, 400);

console.log(JSON.stringify({ unauthenticated: unauthorized.status, nonAdmin: forbiddenStatus, adminDetail: allowed.status, endpointMissing: manualWithoutEndpoint.status, operatorRestoredNonaktif: true }, null, 2));
