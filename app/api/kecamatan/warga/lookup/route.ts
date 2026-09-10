import { NextResponse } from "next/server";

import { requireKecamatanActor } from "@/lib/auth/require-kecamatan-actor";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { parseLookupInput } from "@/lib/kecamatan/input";
import { maskNik } from "@/lib/privacy/mask-nik";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); assertBodySize(request, 8192);
    const actor = await requireKecamatanActor();
    const input = parseLookupInput(await request.json());
    const admin = createAdminClient();
    const { data, error } = await admin.from("warga")
      .select("id,nik,nomor_kk,nama_lengkap,kelurahan_id,kecamatan_id,kelurahan,kecamatan")
      .eq("nik", input.nik).maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError("NIK belum terdaftar pada master warga MBI.", 404);
    if (data.kecamatan_id !== actor.kecamatanId) throw new ApiError("Warga berada di luar wilayah penugasan Anda.", 403);
    return NextResponse.json({ ok: true, citizen: { id: data.id, name: data.nama_lengkap, maskedNik: maskNik(data.nik), maskedKk: maskNik(data.nomor_kk), kelurahanId: data.kelurahan_id, kelurahan: data.kelurahan, kecamatan: data.kecamatan } });
  } catch (error) { return apiErrorResponse(error, "Kecamatan citizen lookup failed", "Data warga tidak dapat diperiksa."); }
}
