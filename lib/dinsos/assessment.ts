import "server-only";

import type { DinsosActor } from "@/lib/auth/require-dinsos-actor";
import { ApiError } from "@/lib/http/api-error-response";
import { createAdminClient } from "@/lib/supabase/admin";

export async function saveAssessment(caseId: string, actor: DinsosActor, values: Record<string, unknown>) {
  const admin = createAdminClient();
  const { data: caseRow } = await admin.from("dinsos_cases").select("id,warga_id,current_stage").eq("id", caseId).maybeSingle();
  if (!caseRow) throw new ApiError("Kasus tidak ditemukan.", 404);
  if (caseRow.current_stage !== "MENUNGGU_ASESMEN") throw new ApiError("Asesmen yang sudah selesai tidak dapat diubah.", 409);
  const { data: official } = await admin.from("penetapan_desil").select("desil_dtsen,status_pbi,status_pkh,status_sembako_bpnt").eq("warga_id", caseRow.warga_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const payload = {
    case_id: caseId, created_by: actor.profileId, status: "DRAFT",
    desil_dtsen_snapshot: official?.desil_dtsen ?? null, pbi_snapshot: official?.status_pbi ?? null,
    pkh_snapshot: official?.status_pkh ?? null, bpnt_snapshot: official?.status_sembako_bpnt ?? null,
    ...values,
  };
  const existing = await admin
    .from("dinsos_asesmen_sosial")
    .select("id,status")
    .eq("case_id", caseId)
    .maybeSingle();
  if (existing.error) throw new ApiError("Asesmen tidak dapat disimpan.", 400);
  if (existing.data?.status !== undefined) {
    if (existing.data.status !== "DRAFT") {
      throw new ApiError("Asesmen yang sudah selesai tidak dapat diubah.", 409);
    }
    const updated = await admin
      .from("dinsos_asesmen_sosial")
      .update(payload)
      .eq("id", existing.data.id)
      .eq("status", "DRAFT")
      .select("id")
      .maybeSingle();
    if (updated.error) throw new ApiError("Asesmen tidak dapat disimpan.", 400);
    if (!updated.data) throw new ApiError("Asesmen yang sudah selesai tidak dapat diubah.", 409);
    return updated.data;
  }
  const inserted = await admin
    .from("dinsos_asesmen_sosial")
    .insert(payload)
    .select("id")
    .single();
  if (inserted.error?.code === "23505") {
    throw new ApiError("Asesmen sedang diproses oleh permintaan lain.", 409);
  }
  if (inserted.error) throw new ApiError("Asesmen tidak dapat disimpan.", 400);
  return inserted.data;
}

export function mapDinsosRpcError(error: { message?: string; code?: string } | null) {
  const message = error?.message ?? "";
  if (message.includes("CASE_NOT_FOUND")) return new ApiError("Kasus tidak ditemukan.", 404);
  if (message.includes("CAPABILITY_REQUIRED")) return new ApiError("Anda tidak memiliki otoritas override desil.", 403);
  if (message.includes("ASSESSMENT_INCOMPLETE")) return new ApiError("Asesmen belum lengkap.", 400);
  if (message.includes("OFFICIAL_DESIL_MISSING")) return new ApiError("Hasil Desil belum tersedia.", 409);
  if (message.includes("REFERRAL_ALREADY_SENT")) return new ApiError("Referral sudah pernah dikirim.", 409);
  if (message.includes("CASE_ALREADY_PROCESSED")) return new ApiError("Kasus sudah diproses.", 409);
  return new ApiError("Proses kasus tidak dapat diselesaikan.", 400);
}
