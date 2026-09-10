import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseAdminEnvironment, loadProjectEnvironment } from "../lib/project-env.mjs";

await loadProjectEnvironment();
const username = process.env.DP3A_ADMIN_USERNAME;
const password = process.env.DP3A_ADMIN_PASSWORD;
assert.equal(username, "admin.dp3a", "Username staging DP3A harus admin.dp3a.");
assert.ok(password && password.length >= 16, "Password staging DP3A minimal 16 karakter.");

const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const admin = createClient(supabaseUrl, supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: opd, error: opdError } = await admin.from("master_opd").select("id").eq("kode_opd", "DP3A").single();
if (opdError || !opd) throw opdError ?? new Error("Master OPD DP3A tidak ditemukan.");

const email = ["admin.dp3a", "staging.invalid"].join("@");
let authUserId;
for (let page = 1; page <= 10 && !authUserId; page += 1) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  authUserId = data.users.find((user) => user.email?.toLowerCase() === email)?.id;
  if (data.users.length < 1000) break;
}
if (authUserId) {
  const { error } = await admin.auth.admin.updateUserById(authUserId, { email, password, email_confirm: true });
  if (error) throw error;
} else {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("Auth user DP3A gagal dibuat.");
  authUserId = data.user.id;
}

const { data: existing, error: existingError } = await admin.from("user_profiles").select("id").eq("username", username).maybeSingle();
if (existingError) throw existingError;
const profile = { email, nama_lengkap: "Admin DP3A Kota Bandung", username, role: "INTERVENSI", opd_id: opd.id, instansi: "DP3A Kota Bandung", auth_user_id: authUserId, status: "AKTIF" };
const result = existing ? await admin.from("user_profiles").update(profile).eq("id", existing.id) : await admin.from("user_profiles").insert(profile);
if (result.error) throw result.error;
const browser = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const verification = await browser.auth.signInWithPassword({ email, password });
if (verification.error || verification.data.user?.id !== authUserId) throw verification.error ?? new Error("Verifikasi login DP3A gagal.");
await browser.auth.signOut({ scope: "local" });
console.log("Admin DP3A berhasil di-onboard.");
