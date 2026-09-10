import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseAdminEnvironment,
  loadProjectEnvironment,
} from "./lib/project-env.mjs";
import {
  cleanupUserFixture,
  createUserFixture,
  uniqueUserIdentity,
} from "./dev/user-management-fixture-lib.mjs";

const BASE_URL = process.env.MBI_TEST_BASE_URL ?? "http://localhost:3000";
const ORIGIN = process.env.APP_ORIGIN ?? BASE_URL;

function readRequiredEnvironment(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is missing.`);
  }

  return value;
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function login(identifier, password, context = identifier) {
  const { response, body } = await request("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
      "Sec-Fetch-Site": "same-origin",
    },
    body: JSON.stringify({ identifier, password }),
  });

  assert.equal(
    response.status,
    200,
    `Login ${context} failed: ${JSON.stringify(body)}`,
  );

  const cookies = response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");

  assert.ok(cookies, "Login response must set a session cookie.");
  return cookies;
}

function userPayload(overrides = {}) {
  const identity = uniqueUserIdentity();
  return {
    namaLengkap: "API Test User",
    email: identity.email,
    username: identity.username,
    nip: identity.nip,
    role: "Admin Diskominfo",
    opdId: "",
    wilayahId: "",
    status: "AKTIF",
    password: "Temporary-Password-123!",
    ...overrides,
  };
}

async function adminRequest(path, cookie, method, payload) {
  return request(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      Origin: ORIGIN,
      "Sec-Fetch-Site": "same-origin",
    },
    body: JSON.stringify(payload),
  });
}

async function main() {
  await loadProjectEnvironment();
  const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
  const adminPassword = readRequiredEnvironment("SUPABASE_TEST_PASSWORD");
  const fieldPassword = readRequiredEnvironment("SUPABASE_TEST_FIELD_PASSWORD");
  const villagePassword = readRequiredEnvironment(
    "SUPABASE_TEST_VILLAGE_PASSWORD",
  );
  const dinsosPassword = readRequiredEnvironment("DINSOS_ADMIN_PASSWORD");
  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const fixtures = [];

  try {

  const { data: wilayah, error: wilayahError } = await supabase
    .from("master_wilayah")
    .select("id, nama, jenis, parent_id")
    .in("nama", ["Andir", "Dago"]);
  assert.ifError(wilayahError);

  const andir = wilayah.find(
    (item) => item.nama === "Andir" && item.jenis === "KECAMATAN",
  );
  const dago = wilayah.find(
    (item) => item.nama === "Dago" && item.jenis === "KELURAHAN",
  );
  assert.ok(andir, "Kecamatan Andir must exist.");
  assert.ok(dago, "Kelurahan Dago must exist.");

  const adminCookie = await login("admin.mbi", adminPassword, "Admin Diskominfo");

  const unauthenticated = await adminRequest(
    "/api/admin/users",
    "",
    "POST",
    userPayload(),
  );
  assert.equal(unauthenticated.response.status, 401);

  const fieldWithoutWilayah = await adminRequest(
    "/api/admin/users",
    adminCookie,
    "POST",
    userPayload({
      namaLengkap: "Invalid Field Operator",
      email: "invalid.field@bandung.go.id",
      username: "invalid.field",
      role: "Operator Lapangan",
      wilayahId: "",
      password: fieldPassword,
    }),
  );
  assert.equal(fieldWithoutWilayah.response.status, 400);

  const villageWithDistrict = await adminRequest(
    "/api/admin/users",
    adminCookie,
    "POST",
    userPayload({
      namaLengkap: "Invalid Village Operator",
      email: "invalid.village@bandung.go.id",
      username: "invalid.village",
      role: "Operator Kelurahan",
      wilayahId: andir.id,
      password: villagePassword,
    }),
  );
  assert.equal(villageWithDistrict.response.status, 400);

  const fieldFixture = await createUserFixture({
    admin: supabase,
    create: (payload) =>
      adminRequest("/api/admin/users", adminCookie, "POST", payload),
    payload: userPayload({
    namaLengkap: "Operator Lapangan Test",
    role: "Operator Lapangan",
    wilayahId: andir.id,
    password: fieldPassword,
    }),
  });
  fixtures.push(fieldFixture);
  const fieldPayload = {
    email: fieldFixture.email,
    username: fieldFixture.username,
    nip: fieldFixture.nip,
  };

  const duplicateUsername = await adminRequest(
    "/api/admin/users",
    adminCookie,
    "POST",
    userPayload({
      username: fieldPayload.username,
      password: fieldPassword,
    }),
  );
  assert.equal(duplicateUsername.response.status, 409);

  const duplicateEmail = await adminRequest(
    "/api/admin/users",
    adminCookie,
    "POST",
    userPayload({
      email: fieldPayload.email,
      password: fieldPassword,
    }),
  );
  assert.equal(duplicateEmail.response.status, 409);

  const duplicateNip = await adminRequest(
    "/api/admin/users",
    adminCookie,
    "POST",
    userPayload({
      nip: fieldPayload.nip,
      password: fieldPassword,
    }),
  );
  assert.equal(duplicateNip.response.status, 409);

  const villageFixture = await createUserFixture({
    admin: supabase,
    create: (payload) =>
      adminRequest("/api/admin/users", adminCookie, "POST", payload),
    payload: userPayload({
    namaLengkap: "Operator Kelurahan Test",
    role: "Operator Kelurahan",
    wilayahId: dago.id,
    password: villagePassword,
    }),
  });
  fixtures.push(villageFixture);

  const nonAdminCookie = await login(
    "admin.dinsos",
    dinsosPassword,
    "Admin Dinsos non-Diskominfo",
  );
  const nonAdminAttempt = await adminRequest(
    "/api/admin/users",
    nonAdminCookie,
    "POST",
    userPayload({
      role: "Admin Diskominfo",
    }),
  );
  assert.equal(nonAdminAttempt.response.status, 403);

  const { data: actors, error: actorsError } = await supabase
    .from("user_profiles")
    .select("id, auth_user_id, username, role, wilayah_id, status")
    .in("id", [fieldFixture.profileId, villageFixture.profileId]);
  assert.ifError(actorsError);
  assert.equal(actors.length, 2);
  assert.ok(
    actors.every(
      (actor) => actor.auth_user_id && actor.wilayah_id && actor.status === "AKTIF",
    ),
  );

  const { data: auditRows, error: auditError } = await supabase
    .from("log_aktivitas")
    .select("aktivitas, modul, status")
    .eq("modul", "Manajemen Akun")
    .order("created_at", { ascending: false });
  assert.ifError(auditError);
  assert.ok(
    auditRows.some((row) =>
      row.aktivitas.includes("Operator Lapangan Test"),
    ),
  );
  assert.ok(
    auditRows.some((row) =>
      row.aktivitas.includes("Operator Kelurahan Test"),
    ),
  );

  console.log("unauthenticated API: 401 PASS");
  console.log("Operator Lapangan without wilayah: 400 PASS");
  console.log("Operator Kelurahan with kecamatan: 400 PASS");
  console.log("Operator Lapangan creation: 201 PASS");
  console.log("Operator Kelurahan creation: 201 PASS");
  console.log("duplicate username/email/NIP: 409 PASS");
  console.log("non-admin API: 403 PASS");
  console.log("Supabase Auth/profile linkage: PASS");
  console.log("create audit log: PASS");
  } finally {
    const cleanupErrors = [];
    for (const fixture of fixtures.reverse()) {
      try {
        await cleanupUserFixture(supabase, fixture);
      } catch (error) {
        cleanupErrors.push(error instanceof Error ? error.message : String(error));
      }
    }

    const { count: remaining, error: remainingError } = await supabase
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .like("email", "e2e.user.%@example.invalid");
    if (remainingError) cleanupErrors.push(remainingError.message);
    if (remaining !== 0) cleanupErrors.push(`${remaining} fixture user profile(s) remain.`);
    if (cleanupErrors.length) throw new Error(cleanupErrors.join("\n"));
    console.log("fixture cleanup: 0 remaining PASS");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
