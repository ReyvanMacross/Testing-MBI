import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseAdminEnvironment,
  loadProjectEnvironment,
} from "./lib/project-env.mjs";

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

async function login(identifier, password) {
  const { response, body } = await request("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
      "Sec-Fetch-Site": "same-origin",
    },
    body: JSON.stringify({ identifier, password }),
  });

  assert.equal(response.status, 200, `Login failed: ${JSON.stringify(body)}`);

  const cookies = response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");

  assert.ok(cookies, "Login response must set a session cookie.");
  return cookies;
}

function userPayload(overrides = {}) {
  return {
    namaLengkap: "API Test User",
    email: "api.test.user@bandung.go.id",
    username: "api.test.user",
    nip: "",
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
  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

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

  const adminCookie = await login("admin.mbi", adminPassword);

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

  const fieldPayload = userPayload({
    namaLengkap: "Operator Lapangan Test",
    email: "operator.lapangan.test@bandung.go.id",
    username: "operator.lapangan.test",
    nip: "199101012020011001",
    role: "Operator Lapangan",
    wilayahId: andir.id,
    password: fieldPassword,
  });
  const fieldCreated = await adminRequest(
    "/api/admin/users",
    adminCookie,
    "POST",
    fieldPayload,
  );
  assert.equal(
    fieldCreated.response.status,
    201,
    JSON.stringify(fieldCreated.body),
  );

  const duplicateUsername = await adminRequest(
    "/api/admin/users",
    adminCookie,
    "POST",
    userPayload({
      email: "duplicate.username@bandung.go.id",
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
      username: "duplicate.email",
      password: fieldPassword,
    }),
  );
  assert.equal(duplicateEmail.response.status, 409);

  const duplicateNip = await adminRequest(
    "/api/admin/users",
    adminCookie,
    "POST",
    userPayload({
      email: "duplicate.nip@bandung.go.id",
      username: "duplicate.nip",
      nip: fieldPayload.nip,
      password: fieldPassword,
    }),
  );
  assert.equal(duplicateNip.response.status, 409);

  const villagePayload = userPayload({
    namaLengkap: "Operator Kelurahan Test",
    email: "operator.kelurahan.test@bandung.go.id",
    username: "operator.kelurahan.test",
    nip: "199201012020011002",
    role: "Operator Kelurahan",
    wilayahId: dago.id,
    password: villagePassword,
  });
  const villageCreated = await adminRequest(
    "/api/admin/users",
    adminCookie,
    "POST",
    villagePayload,
  );
  assert.equal(
    villageCreated.response.status,
    201,
    JSON.stringify(villageCreated.body),
  );

  const fieldCookie = await login(fieldPayload.username, fieldPassword);
  const nonAdminAttempt = await adminRequest(
    "/api/admin/users",
    fieldCookie,
    "POST",
    userPayload({
      email: "forbidden.admin@bandung.go.id",
      username: "forbidden.admin",
      role: "Admin Diskominfo",
    }),
  );
  assert.equal(nonAdminAttempt.response.status, 403);

  const { data: actors, error: actorsError } = await supabase
    .from("user_profiles")
    .select("id, auth_user_id, username, role, wilayah_id, status")
    .in("username", ["operator.lapangan.test", "operator.kelurahan.test"]);
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
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
