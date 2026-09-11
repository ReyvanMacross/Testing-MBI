import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireDp3aActor } from "@/lib/auth/require-dp3a-actor";
import { assertCaseId, parseProgressInput } from "@/lib/dp3a/input";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { createAdminClient } from "@/lib/supabase/admin";

function mapError(error: { message?: string } | null) {
  const message = error?.message ?? "";
  if (message.includes("CASE_ALREADY_COMPLETED")) return new ApiError("Kasus sudah selesai.", 409);
  if (message.includes("CASE_NOT_FOUND") || message.includes("REFERRAL_NOT_FOUND")) return new ApiError("Kasus tidak ditemukan.", 404);
  if (message.includes("TARGET_OPD_REQUIRED") || message.includes("DP3A_ACTOR_REQUIRED")) return new ApiError("Akses penanganan ditolak.", 403);
  if (message.includes("INVALID_PROGRESS_INPUT")) return new ApiError("Data progress tidak valid.", 400);
  if (message.includes("REALIZATION_EXCEEDS_BUDGET")) return new ApiError("Realisasi tidak boleh melebihi pagu layanan.", 400);
  if (message.includes("PROGRESS_BEFORE_START")) return new ApiError("Progress belum dapat dicatat sebelum jadwal penanganan dimulai.", 400);
  return new ApiError("Progress penanganan tidak dapat disimpan.", 400);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    assertSameOrigin(request);
    assertBodySize(request);
    const actor = await requireDp3aActor();
    const caseId = assertCaseId((await params).caseId);
    const input = parseProgressInput(await request.json());
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("dp3a_update_case_progress", {
      p_case_id: caseId,
      p_actor_id: actor.profileId,
      p_actor_opd_id: actor.opdId,
      p_progress_percent: input.progressPercent,
      p_verification_status: input.verificationStatus,
      p_realized_amount: input.realizedAmount,
      p_evaluation_note: input.evaluation,
    });
    if (error) throw mapError(error);
    await writeActivityLog({ userId: actor.profileId, namaPengguna: actor.namaLengkap, rolePengguna: actor.role, aktivitas: "Memperbarui progress penanganan DP3A", modul: "DP3A", metadata: { caseId } });
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    return apiErrorResponse(error, "DP3A case progress failed", "Progress penanganan tidak dapat disimpan.");
  }
}
