import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireDisbudparActor } from "@/lib/auth/require-disbudpar-actor";
import { assertInterventionId, parseProgressInput } from "@/lib/disbudpar/input";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { createAdminClient } from "@/lib/supabase/admin";

function mapError(error: { message?: string } | null) {
  const message = error?.message ?? "";
  if (message.includes("INTERVENTION_ALREADY_COMPLETED")) return new ApiError("Intervensi sudah selesai.", 409);
  if (message.includes("INTERVENTION_NOT_FOUND") || message.includes("REFERRAL_NOT_FOUND")) return new ApiError("Intervensi tidak ditemukan.", 404);
  if (message.includes("TARGET_OPD_REQUIRED") || message.includes("DISBUDPAR_ACTOR_REQUIRED")) return new ApiError("Akses intervensi ditolak.", 403);
  if (message.includes("INVALID_PROGRESS_INPUT")) return new ApiError("Data progress tidak valid.", 400);
  return new ApiError("Progress intervensi tidak dapat disimpan.", 400);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ interventionId: string }> }) {
  try {
    assertSameOrigin(request);
    assertBodySize(request);
    const actor = await requireDisbudparActor();
    const interventionId = assertInterventionId((await params).interventionId);
    const input = parseProgressInput(await request.json());
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("disbudpar_update_intervention_progress", {
      p_intervention_id: interventionId,
      p_actor_id: actor.profileId,
      p_actor_opd_id: actor.opdId,
      p_participant_status: input.participantStatus,
      p_progress_percent: input.progressPercent,
      p_creative_result_status: input.creativeResultStatus,
      p_evaluation_note: input.evaluation,
    });
    if (error) throw mapError(error);
    await writeActivityLog({
      userId: actor.profileId,
      namaPengguna: actor.namaLengkap,
      rolePengguna: actor.role,
      aktivitas: "Memperbarui progress pendampingan ekraf dan seni",
      modul: "DISBUDPAR",
      metadata: { interventionId },
    });
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    return apiErrorResponse(error, "Disbudpar intervention progress failed", "Progress intervensi tidak dapat disimpan.");
  }
}
