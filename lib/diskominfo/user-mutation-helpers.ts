import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { UserValidationError } from "@/lib/diskominfo/validate-user-assignment";

type IdentityValues = {
  email: string;
  username: string | null;
  nip: string | null;
  excludeId?: string;
};

async function identityExists(
  client: SupabaseClient,
  column: "email" | "username" | "nip",
  value: string,
  excludeId?: string,
) {
  let query = client
    .from("user_profiles")
    .select("id", { count: "exact", head: true })
    .eq(column, value);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`Gagal memeriksa ${column}.`);
  }

  return (count ?? 0) > 0;
}

export async function assertUniqueUserIdentity(
  client: SupabaseClient,
  values: IdentityValues,
) {
  const [emailExists, usernameExists, nipExists] = await Promise.all([
    identityExists(client, "email", values.email, values.excludeId),
    values.username
      ? identityExists(client, "username", values.username, values.excludeId)
      : false,
    values.nip
      ? identityExists(client, "nip", values.nip, values.excludeId)
      : false,
  ]);

  if (emailExists) {
    throw new UserValidationError("Email sudah digunakan.", 409);
  }

  if (usernameExists) {
    throw new UserValidationError("Username sudah digunakan.", 409);
  }

  if (nipExists) {
    throw new UserValidationError("NIP sudah digunakan.", 409);
  }
}
