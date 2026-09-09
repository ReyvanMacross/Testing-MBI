import "server-only";

import { ApiError } from "@/lib/http/api-error-response";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type DisnakerActor = {
  profileId: string;
  authUserId: string;
  namaLengkap: string;
  role: "INTERVENSI";
  opdId: string;
  opdCode: "DISNAKER";
};

export async function requireDisnakerActor(): Promise<DisnakerActor> {
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  const authUserId = data?.claims?.sub;
  if (error || !authUserId) throw new ApiError("Sesi tidak valid.", 401);

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("id,nama_lengkap,role,status,opd_id,master_opd(kode_opd)")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  const opd = Array.isArray(profile?.master_opd)
    ? profile.master_opd[0]
    : profile?.master_opd;
  if (
    profileError || !profile || profile.status !== "AKTIF" ||
    profile.role !== "INTERVENSI" || !profile.opd_id || opd?.kode_opd !== "DISNAKER"
  ) {
    throw new ApiError("Akses ditolak.", 403);
  }

  return {
    profileId: profile.id,
    authUserId,
    namaLengkap: profile.nama_lengkap,
    role: "INTERVENSI",
    opdId: profile.opd_id,
    opdCode: "DISNAKER",
  };
}
