import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireDisdaginActor } from "@/lib/auth/require-disdagin-actor";
import { assertInterventionId, parseCompleteInterventionInput } from "@/lib/disdagin/input";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { createAdminClient } from "@/lib/supabase/admin";

function mapError(error: { message?: string } | null) {
  const message = error?.message ?? "";
  if (message.includes("INTERVENTION_ALREADY_COMPLETED") || message.includes("INVALID_REFERRAL_TRANSITION")) return new ApiError("Intervensi sudah diselesaikan oleh petugas lain.", 409);
  if (message.includes("INTERVENTION_NOT_FOUND") || message.includes("REFERRAL_NOT_FOUND")) return new ApiError("Intervensi tidak ditemukan.", 404);
  if (message.includes("TARGET_OPD_REQUIRED") || message.includes("DISDAGIN_ACTOR_REQUIRED")) return new ApiError("Akses intervensi ditolak.", 403);
  if (message.includes("NIB_ALREADY_EXISTS")) return new ApiError("NIB sudah digunakan oleh usaha lain.", 409);
  if (message.includes("COMPLETION_BEFORE_START")) return new ApiError("Tanggal selesai tidak boleh sebelum pendampingan dimulai.", 400);
  return new ApiError("Pendampingan tidak dapat diselesaikan.", 400);
}

export async function POST(request: Request, { params }: { params: Promise<{ interventionId: string }> }) {
  try {
    assertSameOrigin(request);
    assertBodySize(request);
    const actor = await requireDisdaginActor();
    const interventionId = assertInterventionId((await params).interventionId);
    const input = parseCompleteInterventionInput(await request.json());
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("disdagin_complete_intervention", {
      p_intervention_id: interventionId,
      p_actor_id: actor.profileId,
      p_actor_opd_id: actor.opdId,
      p_nib: input.nib,
      p_monthly_revenue: input.monthlyRevenue,
      p_completion_date: input.completionDate,
      p_evaluation: input.evaluation,
    });
    if (error) throw mapError(error);
    await writeActivityLog({
      userId: actor.profileId,
      namaPengguna: actor.namaLengkap,
      rolePengguna: actor.role,
      aktivitas: "Menyelesaikan fasilitasi akses pasar",
      modul: "Disdagin",
      metadata: { interventionId, outcomeId: data.outcomeId },
    });
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    return apiErrorResponse(error, "Disdagin intervention completion failed", "Pendampingan tidak dapat diselesaikan.");
  }
}
