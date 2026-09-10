import { createClient } from "@supabase/supabase-js";

import { getSupabaseAdminEnvironment, loadProjectEnvironment } from "../lib/project-env.mjs";

await loadProjectEnvironment();
const profileId = process.env.DISKOP_ADMIN_PROFILE_ID;
const username = process.env.DISKOP_ADMIN_USERNAME;
const password = process.env.DISKOP_ADMIN_PASSWORD;
if (!profileId || !username || !password) throw new Error("DISKOP_ADMIN_PROFILE_ID, DISKOP_ADMIN_USERNAME, dan DISKOP_ADMIN_PASSWORD wajib dikonfigurasi.");
if (username !== "admin.diskop" || password.length < 12) throw new Error("Konfigurasi akun Diskop tidak memenuhi kebijakan onboarding.");

const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const admin = createClient(supabaseUrl, supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: profile, error: profileError } = await admin.from("user_profiles")
  .select("id,email,nama_lengkap,role,opd_id,auth_user_id,master_opd(kode_opd)").eq("id", profileId).single();
if (profileError || !profile) throw new Error("Profile Admin Diskop tidak ditemukan.");
const opd = Array.isArray(profile.master_opd) ? profile.master_opd[0] : profile.master_opd;
if (!profile.email || profile.role !== "INTERVENSI" || opd?.kode_opd !== "DISKOP") throw new Error("Profile yang dipilih bukan pengguna Diskop yang sah.");

let authUserId = profile.auth_user_id;
if (authUserId) {
  const { error } = await admin.auth.admin.updateUserById(authUserId, { email: profile.email, password, email_confirm: true });
  if (error) throw error;
} else {
  let existing = null;
  for (let page = 1; page <= 10 && !existing; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    existing = data.users.find((user) => user.email?.toLowerCase() === profile.email.toLowerCase()) ?? null;
    if (data.users.length < 1000) break;
  }
  if (existing) {
    authUserId = existing.id;
    const { error } = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    if (error) throw error;
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email: profile.email, password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error("Auth user gagal dibuat.");
    authUserId = data.user.id;
  }
}

const { error: updateError } = await admin.from("user_profiles").update({ auth_user_id: authUserId, username, status: "AKTIF" }).eq("id", profile.id);
if (updateError) throw updateError;
console.log("Admin Diskop berhasil di-onboard.");
