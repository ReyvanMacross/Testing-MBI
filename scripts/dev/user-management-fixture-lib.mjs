import crypto from "node:crypto";

export function randomNip() {
  const bytes = crypto.randomBytes(18);

  return Array.from(bytes, (byte) => String(byte % 10)).join("");
}

export function uniqueUserIdentity() {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

  return {
    suffix,
    email: `e2e.user.${suffix}@example.invalid`,
    username: `e2e.user.${suffix}`,
    nip: randomNip(),
  };
}

export async function createUserFixture({ admin, create, payload }) {
  const identity = uniqueUserIdentity();
  const result = await create({ ...payload, ...identity });

  if (result.response.status !== 201 || !result.body?.user?.id) {
    throw new Error(
      `Fixture user creation failed (${result.response.status}): ${JSON.stringify(result.body)}`,
    );
  }

  const profileId = result.body.user.id;
  const { data: profile, error } = await admin
    .from("user_profiles")
    .select("id,auth_user_id,email")
    .eq("id", profileId)
    .eq("email", identity.email)
    .single();

  if (error || !profile?.auth_user_id) {
    throw error ?? new Error("Fixture profile is not linked to Supabase Auth.");
  }

  return {
    profileId: profile.id,
    authUserId: profile.auth_user_id,
    email: profile.email,
    username: identity.username,
    nip: identity.nip,
    result,
  };
}

export async function cleanupUserFixture(admin, fixture) {
  const { data: removedProfiles, error: profileError } = await admin
    .from("user_profiles")
    .delete()
    .eq("id", fixture.profileId)
    .eq("auth_user_id", fixture.authUserId)
    .eq("email", fixture.email)
    .select("id");

  if (profileError || removedProfiles?.length !== 1) {
    await admin
      .from("user_profiles")
      .update({ status: "NONAKTIF" })
      .eq("id", fixture.profileId)
      .eq("auth_user_id", fixture.authUserId);
    throw new Error(
      `Fixture profile ${fixture.profileId} could not be deleted and was marked NONAKTIF: ${profileError?.message ?? "exact profile not found"}`,
    );
  }

  const { error: authError } = await admin.auth.admin.deleteUser(
    fixture.authUserId,
  );
  if (authError) {
    throw new Error(
      `Fixture auth user ${fixture.authUserId} could not be deleted: ${authError.message}`,
    );
  }

  const { count, error: residueError } = await admin
    .from("user_profiles")
    .select("id", { count: "exact", head: true })
    .eq("id", fixture.profileId)
    .eq("email", fixture.email);
  if (residueError || count !== 0) {
    throw new Error(
      `Fixture cleanup verification failed for ${fixture.profileId}: ${residueError?.message ?? `${count} profile(s) remain`}`,
    );
  }
}
