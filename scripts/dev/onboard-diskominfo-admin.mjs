import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseAdminEnvironment, loadProjectEnvironment } from "../lib/project-env.mjs";

await loadProjectEnvironment();
const username = process.env.E2E_ADMIN_IDENTIFIER ?? "admin.mbi";
const password = process.env.E2E_ADMIN_PASSWORD ?? process.env.SUPABASE_TEST_PASSWORD;
assert.equal(username, "admin.mbi", "Username staging Diskominfo harus admin.mbi.");
assert.ok(password && password.length >= 12, "Password staging Diskominfo minimal 12 karakter.");

const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const admin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const email = "admin.mbi@bandung.go.id";

const { data: opd, error: opdError } = await admin.from("master_opd")
  .select("id")
  .eq("kode_opd", "DISKOMINFO")
  .single();
if (opdError || !opd) throw opdError ?? new Error("Master OPD Diskominfo tidak ditemukan.");

let authUserId;
for (let page = 1; page <= 10 && !authUserId; page += 1) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  authUserId = data.users.find((user) => user.email?.toLowerCase() === email)?.id;
  if (data.users.length < 1000) break;
}
if (authUserId) {
  const { error } = await admin.auth.admin.updateUserById(authUserId, {
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
} else {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("Auth user Diskominfo gagal dibuat.");
  authUserId = data.user.id;
}

const { data: byUsername, error: usernameError } = await admin.from("user_profiles")
  .select("id")
  .eq("username", username)
  .maybeSingle();
if (usernameError) throw usernameError;
const { data: byEmail, error: emailError } = await admin.from("user_profiles")
  .select("id")
  .eq("email", email)
  .maybeSingle();
if (emailError) throw emailError;
if (byUsername && byEmail && byUsername.id !== byEmail.id) {
  throw new Error("Profil username dan email Admin Diskominfo mengarah ke pengguna berbeda.");
}

const profile = {
  email,
  nama_lengkap: "Admin MBI Diskominfo",
  username,
  role: "Admin Diskominfo",
  opd_id: opd.id,
  instansi: "Diskominfo Kota Bandung",
  auth_user_id: authUserId,
  status: "AKTIF",
};
const existingId = byUsername?.id ?? byEmail?.id;
const result = existingId
  ? await admin.from("user_profiles").update(profile).eq("id", existingId)
  : await admin.from("user_profiles").insert(profile);
if (result.error) throw result.error;

console.log("Admin Diskominfo staging berhasil di-onboard.");
