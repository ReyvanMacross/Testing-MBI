import "server-only";

import { ApiError } from "@/lib/http/api-error-response";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type KelurahanActor = {
  profileId: string;
  authUserId: string;
  namaLengkap: string;
  role: "Operator Kelurahan";
  kelurahanId: string;
  kelurahanNama: string;
  kecamatanId: string;
  kecamatanNama: string;
};

export async function requireKelurahanActor(): Promise<KelurahanActor> {
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  const authUserId = data?.claims?.sub;
  if (error || !authUserId) throw new ApiError("Sesi tidak valid.", 401);

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("id,nama_lengkap,role,status,wilayah_id,master_wilayah!user_profiles_wilayah_id_fkey(id,nama,jenis,parent_id,is_active)")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  const village = Array.isArray(profile?.master_wilayah)
    ? profile.master_wilayah[0]
    : profile?.master_wilayah;
  if (
    profileError || !profile || profile.status !== "AKTIF" ||
    profile.role !== "Operator Kelurahan" || !profile.wilayah_id ||
    village?.jenis !== "KELURAHAN" || !village.is_active || !village.parent_id
  ) throw new ApiError("Akses Kelurahan ditolak.", 403);

  const { data: district, error: districtError } = await admin
    .from("master_wilayah")
    .select("id,nama,jenis,is_active")
    .eq("id", village.parent_id)
    .maybeSingle();
  if (districtError || !district || district.jenis !== "KECAMATAN" || !district.is_active) {
    throw new ApiError("Wilayah Kecamatan akun tidak valid.", 403);
  }
  return {
    profileId: profile.id,
    authUserId,
    namaLengkap: profile.nama_lengkap,
    role: "Operator Kelurahan",
    kelurahanId: profile.wilayah_id,
    kelurahanNama: village.nama,
    kecamatanId: district.id,
    kecamatanNama: district.nama,
  };
}
