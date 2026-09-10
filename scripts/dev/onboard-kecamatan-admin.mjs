import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseAdminEnvironment, loadProjectEnvironment } from "../lib/project-env.mjs";

await loadProjectEnvironment();
const username = process.env.KECAMATAN_ADMIN_USERNAME;
const password = process.env.KECAMATAN_ADMIN_PASSWORD;
assert.equal(username, "admin.kecamatan", "Username staging Kecamatan harus admin.kecamatan.");
assert.ok(password && password.length >= 16, "Password staging Kecamatan minimal 16 karakter.");

const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const admin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: district, error: districtError } = await admin.from("master_wilayah")
  .select("id,nama,jenis,is_active")
  .eq("jenis", "KECAMATAN")
  .ilike("nama", "Sukajadi")
  .eq("is_active", true)
  .single();
if (districtError || !district) throw districtError ?? new Error("Kecamatan Sukajadi tidak ditemukan.");

const email = ["admin.kecamatan.sukajadi", "staging.invalid"].join("@");
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
  if (error || !data.user) throw error ?? new Error("Auth user Kecamatan gagal dibuat.");
  authUserId = data.user.id;
}

const { data: existing, error: existingError } = await admin.from("user_profiles")
  .select("id")
  .eq("username", username)
  .maybeSingle();
if (existingError) throw existingError;
if (existing) {
  const { error } = await admin.from("user_profiles").update({
    email,
    nama_lengkap: "Admin Kecamatan Sukajadi",
    role: "Operator Kecamatan",
    wilayah_id: district.id,
    wilayah: `Kecamatan ${district.nama}`,
    instansi: "Kecamatan Sukajadi",
    auth_user_id: authUserId,
    status: "AKTIF",
  }).eq("id", existing.id);
  if (error) throw error;
} else {
  const { error } = await admin.from("user_profiles").insert({
    email,
    nama_lengkap: "Admin Kecamatan Sukajadi",
    username,
    role: "Operator Kecamatan",
    wilayah_id: district.id,
    wilayah: `Kecamatan ${district.nama}`,
    instansi: "Kecamatan Sukajadi",
    auth_user_id: authUserId,
    status: "AKTIF",
  });
  if (error) throw error;
}

console.log("Admin Kecamatan Sukajadi berhasil di-onboard.");
