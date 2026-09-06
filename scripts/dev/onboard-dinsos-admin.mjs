import { createClient } from "@supabase/supabase-js";

import { getSupabaseAdminEnvironment, loadProjectEnvironment } from "../lib/project-env.mjs";

await loadProjectEnvironment();
const profileId = process.env.DINSOS_ADMIN_PROFILE_ID;
const username = process.env.DINSOS_ADMIN_USERNAME;
const password = process.env.DINSOS_ADMIN_PASSWORD;
if (!profileId || !username || !password) {
  throw new Error("DINSOS_ADMIN_PROFILE_ID, DINSOS_ADMIN_USERNAME, dan DINSOS_ADMIN_PASSWORD wajib dikonfigurasi.");
}
if (username !== "admin.dinsos" || password.length < 12) {
  throw new Error("Konfigurasi akun Dinsos tidak memenuhi kebijakan onboarding.");
}

const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const admin = createClient(supabaseUrl, supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: profile, error: profileError } = await admin
  .from("user_profiles")
  .select("id,email,nama_lengkap,role,opd_id,auth_user_id,master_opd(kode_opd)")
  .eq("id", profileId)
  .single();
if (profileError || !profile) throw new Error("Profile Admin Dinsos tidak ditemukan.");
const opd = Array.isArray(profile.master_opd) ? profile.master_opd[0] : profile.master_opd;
if (profile.email !== "dinsos@bandung.go.id" || profile.role !== "INTERVENSI" || opd?.kode_opd !== "DINSOS") {
  throw new Error("Profile yang dipilih bukan Admin Dinsos yang sah.");
}

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

const { error: updateError } = await admin.from("user_profiles").update({
  auth_user_id: authUserId,
  username,
  status: "AKTIF",
}).eq("id", profile.id);
if (updateError) throw updateError;

const { error: capabilityError } = await admin.from("user_capabilities").upsert([
  {
    user_id: profile.id,
    capability: "DINSOS_DESIL_OVERRIDE",
    granted_by: profile.id,
  },
  {
    user_id: profile.id,
    capability: "DINSOS_WARGA_EDIT",
    granted_by: profile.id,
  },
  {
    user_id: profile.id,
    capability: "DINSOS_ASSESSMENT_REVIEW",
    granted_by: profile.id,
  },
  {
    user_id: profile.id,
    capability: "DINSOS_PATH_OVERRIDE",
    granted_by: profile.id,
  },
], { onConflict: "user_id,capability" });
if (capabilityError) throw capabilityError;

console.log("Admin Dinsos berhasil di-onboard dan capability Dinsos sudah diberikan.");
