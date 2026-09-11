import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseAdminEnvironment } from "../lib/project-env.mjs";

async function findAuthUserByEmail(admin, email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const existing = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (existing || data.users.length < 1000) return existing ?? null;
  }
  return null;
}

export async function onboardOpdAdmin({
  envPrefix,
  expectedUsername,
  opdCode,
  fullName,
  institution,
  preferredEmail,
}) {
  const profileId = process.env[`${envPrefix}_ADMIN_PROFILE_ID`];
  const username = process.env[`${envPrefix}_ADMIN_USERNAME`];
  const password = process.env[`${envPrefix}_ADMIN_PASSWORD`];
  assert.ok(profileId, `${envPrefix}_ADMIN_PROFILE_ID wajib dikonfigurasi.`);
  assert.equal(username, expectedUsername, `Username staging ${opdCode} harus ${expectedUsername}.`);
  assert.ok(password && password.length >= 12, `Password staging ${opdCode} minimal 12 karakter.`);

  const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
  const admin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: opd, error: opdError } = await admin.from("master_opd")
    .select("id").eq("kode_opd", opdCode).single();
  if (opdError || !opd) throw opdError ?? new Error(`Master OPD ${opdCode} tidak ditemukan.`);

  const fields = "id,email,role,opd_id,auth_user_id,master_opd(kode_opd)";
  let { data: profile, error: profileError } = await admin.from("user_profiles")
    .select(fields).eq("id", profileId).maybeSingle();
  if (profileError) throw profileError;
  if (!profile) {
    const usernameLookup = await admin.from("user_profiles")
      .select(fields).eq("username", username).maybeSingle();
    if (usernameLookup.error) throw usernameLookup.error;
    profile = usernameLookup.data;
  }
  if (profile) {
    const profileOpd = Array.isArray(profile.master_opd) ? profile.master_opd[0] : profile.master_opd;
    if (profile.role !== "INTERVENSI" || profileOpd?.kode_opd !== opdCode) {
      throw new Error(`Profil yang ditemukan bukan Admin ${opdCode} yang sah.`);
    }
  }

  const email = preferredEmail || profile?.email || [expectedUsername, "staging.invalid"].join("@");
  let authUserId = profile?.auth_user_id;
  if (authUserId) {
    const { error } = await admin.auth.admin.updateUserById(authUserId, {
      email, password, email_confirm: true,
    });
    if (error) throw error;
  } else {
    const existingAuthUser = await findAuthUserByEmail(admin, email);
    if (existingAuthUser) {
      authUserId = existingAuthUser.id;
      const { error } = await admin.auth.admin.updateUserById(authUserId, {
        password, email_confirm: true,
      });
      if (error) throw error;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (error || !data.user) throw error ?? new Error(`Auth user ${opdCode} gagal dibuat.`);
      authUserId = data.user.id;
    }
  }

  const profileValues = {
    email,
    nama_lengkap: fullName,
    username,
    role: "INTERVENSI",
    opd_id: opd.id,
    instansi: institution,
    auth_user_id: authUserId,
    status: "AKTIF",
  };
  const profileWrite = profile
    ? await admin.from("user_profiles").update(profileValues).eq("id", profile.id).select("id").single()
    : await admin.from("user_profiles").insert({ id: profileId, ...profileValues }).select("id").single();
  if (profileWrite.error || !profileWrite.data) {
    throw profileWrite.error ?? new Error(`Profil Admin ${opdCode} gagal disimpan.`);
  }

  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  assert.ok(publishableKey, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY wajib dikonfigurasi.");
  const browser = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verification = await browser.auth.signInWithPassword({ email, password });
  if (verification.error || verification.data.user?.id !== authUserId) {
    throw verification.error ?? new Error(`Verifikasi login ${opdCode} gagal.`);
  }
  await browser.auth.signOut({ scope: "local" });

  return { admin, profileId: profileWrite.data.id };
}
