import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/http/api-error-response";

export class AdminAuthorizationError extends ApiError {
  constructor(status: 401 | 403) {
    super(status === 401 ? "Sesi tidak valid." : "Akses ditolak.", status);
    this.name = "AdminAuthorizationError";
  }
}

export type AdminDiskominfoActor = {
  authUserId: string;
  profileId: string;
  namaLengkap: string;
  role: "Admin Diskominfo";
};

export async function requireAdminDiskominfo(): Promise<AdminDiskominfoActor> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const authUserId = data?.claims?.sub;

  if (error || !authUserId) {
    throw new AdminAuthorizationError(401);
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("id, nama_lengkap, role, status")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.status !== "AKTIF" ||
    profile.role !== "Admin Diskominfo"
  ) {
    throw new AdminAuthorizationError(403);
  }

  return {
    authUserId,
    profileId: profile.id,
    namaLengkap: profile.nama_lengkap,
    role: "Admin Diskominfo",
  };
}
