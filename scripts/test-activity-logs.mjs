import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseAdminEnvironment,
  loadProjectEnvironment,
} from "./lib/project-env.mjs";

const BASE_URL = process.env.MBI_TEST_BASE_URL ?? "http://localhost:3000";
const ORIGIN = process.env.APP_ORIGIN ?? BASE_URL;

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing.`);
  return value;
}

async function login(identifier, password) {
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
  assert.equal(response.status, 200, `Login failed: ${JSON.stringify(body)}`);
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
  assert.ok(cookie, "Login must return session cookies.");
  return cookie;
}

async function exportLogs(cookie, query = "") {
  return fetch(`${BASE_URL}/api/admin/activity-logs/export${query}`, {
    headers: cookie ? { Cookie: cookie } : undefined,
  });
}

async function rpc(db, values) {
  const { data, error } = await db.rpc("list_activity_logs", {
    p_search: null,
    p_module: null,
    p_user_id: null,
    p_system_only: false,
    p_date: null,
    p_limit: 20,
    p_offset: 0,
    ...values,
  });
  assert.ifError(error);
  return data;
}

async function main() {
  await loadProjectEnvironment();
  const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
  const adminPassword = requiredEnvironment("SUPABASE_TEST_PASSWORD");
  const fieldPassword = requiredEnvironment("SUPABASE_TEST_FIELD_PASSWORD");
  const db = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: operatorProfile, error: operatorProfileError } = await db
    .from("user_profiles")
    .select("id")
    .eq("username", "operator.lapangan.test")
    .single();
  assert.ifError(operatorProfileError);
  await db
    .from("user_profiles")
    .update({ status: "AKTIF" })
    .eq("id", operatorProfile.id);

  try {

  const unauthenticated = await exportLogs("");
  assert.equal(unauthenticated.status, 401);

  const fieldCookie = await login("operator.lapangan.test", fieldPassword);
  const forbidden = await exportLogs(fieldCookie);
  assert.equal(forbidden.status, 403);

  const adminCookie = await login("admin.mbi", adminPassword);
  const { data: adminProfile, error: adminError } = await db
    .from("user_profiles")
    .select("id")
    .eq("username", "admin.mbi")
    .single();
  assert.ifError(adminError);

  const csvResponse = await exportLogs(adminCookie);
  assert.equal(csvResponse.status, 200);
  assert.match(csvResponse.headers.get("content-type") ?? "", /^text\/csv/);
  assert.match(
    csvResponse.headers.get("content-disposition") ?? "",
    /attachment; filename="log-aktivitas-\d{4}-\d{2}-\d{2}\.csv"/,
  );
  const csvBytes = new Uint8Array(await csvResponse.arrayBuffer());
  assert.deepEqual(
    [...csvBytes.slice(0, 3)],
    [0xef, 0xbb, 0xbf],
    "CSV must include a UTF-8 BOM.",
  );
  const csv = new TextDecoder().decode(csvBytes);
  assert.ok(csv.includes('"Nama Pengguna"'));

  const injectionActivity = "=1+1 CSV injection test";
  const { data: injectionLog, error: injectionError } = await db
    .from("log_aktivitas")
    .insert({
      user_id: adminProfile.id,
      nama_pengguna: "=Formula Actor",
      role_pengguna: "+Formula Role",
      aktivitas: injectionActivity,
      modul: "@Formula Module",
      status: "BERHASIL",
      metadata: { testOnly: true },
    })
    .select("id")
    .single();
  assert.ifError(injectionError);

  try {
    const injectionExport = await exportLogs(
      adminCookie,
      `?q=${encodeURIComponent(injectionActivity)}`,
    );
    assert.equal(injectionExport.status, 200);
    const injectionCsv = await injectionExport.text();
    assert.ok(injectionCsv.includes('"\'=1+1 CSV injection test"'));
    assert.ok(injectionCsv.includes('"\'=Formula Actor"'));
    assert.ok(injectionCsv.includes('"\'+Formula Role"'));
    assert.ok(injectionCsv.includes('"\'@Formula Module"'));
  } finally {
    await db.from("log_aktivitas").delete().eq("id", injectionLog.id);
  }

  const moduleExport = await exportLogs(
    adminCookie,
    `?module=${encodeURIComponent("Manajemen Akun")}`,
  );
  assert.equal(moduleExport.status, 200);
  const moduleCsv = await moduleExport.text();
  const moduleRows = moduleCsv.replace(/^\uFEFF/, "").split("\r\n").slice(1);
  assert.ok(moduleRows.length > 0);
  assert.ok(moduleRows.every((row) => row.includes('"Manajemen Akun"')));

  const { data: target, error: targetError } = await db
    .from("user_profiles")
    .select(
      "id, email, nama_lengkap, username, nip, role, opd_id, wilayah_id, status",
    )
    .eq("username", "operator.lapangan.test")
    .single();
  assert.ifError(targetError);

  const originalName = target.nama_lengkap;
  const updatedName = `${originalName} Audit`;
  const basePayload = {
    email: target.email,
    username: target.username ?? "",
    nip: target.nip ?? "",
    role: target.role,
    opdId: target.opd_id ?? "",
    wilayahId: target.wilayah_id ?? "",
    status: target.status,
  };
  const updateResponse = await fetch(`${BASE_URL}/api/admin/users/${target.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      Origin: ORIGIN,
      "Sec-Fetch-Site": "same-origin",
    },
    body: JSON.stringify({ ...basePayload, namaLengkap: updatedName }),
  });
  assert.equal(updateResponse.status, 200);
  const restoreResponse = await fetch(`${BASE_URL}/api/admin/users/${target.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      Origin: ORIGIN,
      "Sec-Fetch-Site": "same-origin",
    },
    body: JSON.stringify({ ...basePayload, namaLengkap: originalName }),
  });
  assert.equal(restoreResponse.status, 200);

  const logoutResponse = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: {
      Cookie: adminCookie,
      Origin: ORIGIN,
      "Sec-Fetch-Site": "same-origin",
    },
  });
  assert.equal(logoutResponse.status, 200);

  for (let index = 0; index < 3; index += 1) {
    const cookie = await login("admin.mbi", adminPassword);
    const response = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: ORIGIN,
        "Sec-Fetch-Site": "same-origin",
      },
    });
    assert.equal(response.status, 200);
  }

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const searchRows = await rpc(db, { p_search: "akun" });
  const moduleRowsRpc = await rpc(db, { p_module: "Manajemen Akun" });
  const actorRows = await rpc(db, { p_user_id: adminProfile.id });
  const systemRows = await rpc(db, { p_system_only: true });
  const dateRows = await rpc(db, { p_date: today });
  const firstPage = await rpc(db, { p_limit: 20, p_offset: 0 });
  const secondPage = await rpc(db, { p_limit: 20, p_offset: 20 });

  assert.ok(searchRows.length > 0);
  assert.ok(moduleRowsRpc.every((row) => row.modul === "Manajemen Akun"));
  assert.ok(actorRows.every((row) => row.user_id === adminProfile.id));
  assert.ok(systemRows.length > 0 && systemRows.every((row) => row.user_id === null));
  assert.ok(dateRows.length > 0);
  assert.equal(firstPage.length, 20);
  assert.ok(secondPage.length > 0);

  const { data: auditRows, error: auditError } = await db
    .from("log_aktivitas")
    .select("aktivitas, modul, metadata")
    .eq("user_id", adminProfile.id)
    .order("created_at", { ascending: false });
  assert.ifError(auditError);
  assert.ok(auditRows.some((row) => row.aktivitas === "Login berhasil"));
  assert.ok(
    auditRows.some((row) => row.aktivitas === "Logout dari platform MBI"),
  );
  assert.ok(
    auditRows.some(
      (row) =>
        row.modul === "Manajemen Akun" &&
        Array.isArray(row.metadata?.changedFields),
    ),
  );
  assert.ok(
    auditRows.some((row) => row.aktivitas === "Mengekspor log aktivitas"),
  );

  console.log("unauthenticated export: 401 PASS");
  console.log("non-admin export: 403 PASS");
  console.log("admin CSV + BOM: 200 PASS");
  console.log("CSV formula injection protection: PASS");
  console.log("filtered module export: PASS");
  console.log("search/date/module/actor/system filters: PASS");
  console.log("pagination 20 rows + second page: PASS");
  console.log("login/logout/export/user-management audit: PASS");
  } finally {
    await db
      .from("user_profiles")
      .update({ status: "NONAKTIF" })
      .eq("id", operatorProfile.id);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
