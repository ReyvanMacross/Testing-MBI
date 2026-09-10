import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireCapability } from "@/lib/auth/require-capability";
import { requireDinsosActor } from "@/lib/auth/require-dinsos-actor";
import { assertWargaId, parseWargaUpdateInput } from "@/lib/dinsos/warga-input";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ wargaId: string }> },
) {
  try {
    assertSameOrigin(request);
    assertBodySize(request);
    const actor = await requireDinsosActor();
    await requireCapability(actor.profileId, "DINSOS_WARGA_EDIT");
    const { wargaId: rawWargaId } = await params;
    const wargaId = assertWargaId(rawWargaId);
    const input = parseWargaUpdateInput(await request.json());
    const admin = createAdminClient();

    const { data: current, error: currentError } = await admin
      .from("warga")
      .select(
        "id,nama_lengkap,kelurahan_id,kecamatan_id,kelurahan,kecamatan,status_perkawinan,alamat_lengkap,pekerjaan,updated_at",
      )
      .eq("id", wargaId)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) throw new ApiError("Data warga tidak ditemukan.", 404);

    let kelurahanId = current.kelurahan_id;
    let kecamatanId = current.kecamatan_id;
    let kelurahan = current.kelurahan;
    let kecamatan = current.kecamatan;

    if (input.kelurahanId) {
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
      kelurahanId = village.id;
      kecamatanId = district.id;
      kelurahan = village.nama;
      kecamatan = district.nama;
    } else if (current.kelurahan_id) {
      throw new ApiError("Kelurahan canonical tidak boleh dikosongkan.", 400);
    }

    const changedFields: string[] = [];
    const candidates = [
      ["nama_lengkap", current.nama_lengkap, input.namaLengkap],
      ["kelurahan_id", current.kelurahan_id, kelurahanId],
      ["status_perkawinan", current.status_perkawinan, input.statusPerkawinan],
      ["alamat_lengkap", current.alamat_lengkap, input.alamatLengkap],
      ["pekerjaan", current.pekerjaan, input.pekerjaan],
    ] as const;
    for (const [field, before, after] of candidates) {
      if (before !== after) changedFields.push(field);
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await admin
      .from("warga")
      .update({
        nama_lengkap: input.namaLengkap,
        kelurahan_id: kelurahanId,
        kecamatan_id: kecamatanId,
        kelurahan,
        kecamatan,
        status_perkawinan: input.statusPerkawinan,
        alamat_lengkap: input.alamatLengkap,
        pekerjaan: input.pekerjaan,
        updated_at: now,
      })
      .eq("id", wargaId)
      .eq("updated_at", input.expectedUpdatedAt)
      .select("id,updated_at")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) {
      throw new ApiError(
        "Data warga telah berubah. Muat ulang sebelum menyimpan.",
        409,
      );
    }

    await writeActivityLog({
      userId: actor.profileId,
      namaPengguna: actor.namaLengkap,
      rolePengguna: actor.role,
      aktivitas: "Memperbarui data warga",
      modul: "Dinas Sosial",
      metadata: { wargaId, changedFields },
    });

    return NextResponse.json({ ok: true, updatedAt: updated.updated_at });
  } catch (error) {
    return apiErrorResponse(
      error,
      "Dinsos citizen update failed",
      "Data warga tidak dapat diperbarui.",
    );
  }
}
