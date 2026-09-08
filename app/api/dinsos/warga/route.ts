import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireCapability } from "@/lib/auth/require-capability";
import { requireDinsosActor } from "@/lib/auth/require-dinsos-actor";
import { parseWargaCreateInput } from "@/lib/dinsos/warga-input";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    assertBodySize(request);
    const actor = await requireDinsosActor();
    await requireCapability(actor.profileId, "DINSOS_WARGA_EDIT");
    const input = parseWargaCreateInput(await request.json());
    const admin = createAdminClient();

    const { data: duplicate, error: duplicateError } = await admin
      .from("warga")
      .select("id")
      .eq("nik", input.nik)
      .maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate) throw new ApiError("NIK sudah terdaftar pada Data Warga.", 409);

    const { data: village, error: villageError } = await admin
      .from("master_wilayah")
      .select("id,nama,jenis,parent_id,is_active")
      .eq("id", input.kelurahanId)
      .maybeSingle();
    if (
      villageError ||
      !village ||
      village.jenis !== "KELURAHAN" ||
      !village.is_active ||
      !village.parent_id
    ) {
      throw new ApiError("Kelurahan tidak valid.", 400);
    }

    const { data: district, error: districtError } = await admin
      .from("master_wilayah")
      .select("id,nama,jenis,is_active")
      .eq("id", village.parent_id)
      .maybeSingle();
    if (
      districtError ||
      !district ||
      district.jenis !== "KECAMATAN" ||
      !district.is_active
    ) {
      throw new ApiError("Kecamatan induk tidak valid.", 400);
    }

    const { data: created, error: createError } = await admin
      .from("warga")
      .insert({
        nik: input.nik,
        nomor_kk: input.nomorKk,
        nama_lengkap: input.namaLengkap,
        tempat_lahir: input.tempatLahir,
        tanggal_lahir: input.tanggalLahir,
        jenis_kelamin: input.jenisKelamin,
        status_perkawinan: input.statusPerkawinan,
        nomor_hp: input.nomorHp,
        email: input.email,
        alamat_lengkap: input.alamatLengkap,
        kelurahan_id: village.id,
        kecamatan_id: district.id,
        kelurahan: village.nama,
        kecamatan: district.nama,
        pendidikan_terakhir: input.pendidikanTerakhir,
        pekerjaan: input.pekerjaan,
        jumlah_anggota_kk: input.jumlahAnggotaKk,
        status_rumah: input.statusRumah,
      })
      .select("id")
      .single();
    if (createError) {
      if (createError.code === "23505") {
        throw new ApiError("NIK sudah terdaftar pada Data Warga.", 409);
      }
      throw createError;
    }

    await writeActivityLog({
      userId: actor.profileId,
      namaPengguna: actor.namaLengkap,
      rolePengguna: actor.role,
      aktivitas: "Mendaftarkan warga baru",
      modul: "Dinas Sosial",
      metadata: { wargaId: created.id, source: "DINSOS_PORTAL" },
    });

    return NextResponse.json({ ok: true, wargaId: created.id }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(
      error,
      "Dinsos citizen registration failed",
      "Warga baru tidak dapat didaftarkan.",
    );
  }
}
