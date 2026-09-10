import "server-only";

import { ApiError } from "@/lib/http/api-error-response";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type KecamatanActor = {
  profileId: string;
  authUserId: string;
  namaLengkap: string;
  role: "Operator Kecamatan";
  kecamatanId: string;
  kecamatanNama: string;
};

export async function requireKecamatanActor(): Promise<KecamatanActor> {
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  const authUserId = data?.claims?.sub;
  if (error || !authUserId) throw new ApiError("Sesi tidak valid.", 401);

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("id,nama_lengkap,role,status,wilayah_id,master_wilayah!user_profiles_wilayah_id_fkey(nama,jenis,is_active)")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  const wilayah = Array.isArray(profile?.master_wilayah)
    ? profile.master_wilayah[0]
    : profile?.master_wilayah;
  if (
    profileError || !profile || profile.status !== "AKTIF" ||
    profile.role !== "Operator Kecamatan" || !profile.wilayah_id ||
    wilayah?.jenis !== "KECAMATAN" || !wilayah.is_active
  ) {
    throw new ApiError("Akses Kecamatan ditolak.", 403);
  }
  return {
    profileId: profile.id,
    authUserId,
    namaLengkap: profile.nama_lengkap,
    role: "Operator Kecamatan",
    kecamatanId: profile.wilayah_id,
    kecamatanNama: wilayah.nama,
  };
}
