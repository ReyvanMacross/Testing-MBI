import { NextResponse } from "next/server";

import { requireKelurahanActor } from "@/lib/auth/require-kelurahan-actor";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { parseNikLookup } from "@/lib/kelurahan/input";
import { maskNik } from "@/lib/privacy/mask-nik";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); assertBodySize(request);
    const actor=await requireKelurahanActor(); const {nik}=parseNikLookup(await request.json());
    const {data,error}=await createAdminClient().from("warga")
      .select("id,nik,nomor_kk,nama_lengkap,kelurahan_id,kecamatan_id")
      .eq("nik",nik).eq("kelurahan_id",actor.kelurahanId).eq("kecamatan_id",actor.kecamatanId).maybeSingle();
    if(error) throw error;
    if(!data) return NextResponse.json({message:"NIK tidak ditemukan pada wilayah akun."},{status:404});
    return NextResponse.json({citizen:{id:data.id,name:data.nama_lengkap,maskedNik:maskNik(data.nik),maskedKk:maskNik(data.nomor_kk),village:actor.kelurahanNama}});
  } catch(error) { return apiErrorResponse(error,"Kelurahan citizen lookup failed","NIK tidak dapat diperiksa."); }
}
