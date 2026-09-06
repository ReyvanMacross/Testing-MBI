import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireCapability } from "@/lib/auth/require-capability";
import { requireDinsosActor } from "@/lib/auth/require-dinsos-actor";
import {
  assertAssessmentId,
  parseAssessmentReviewInput,
} from "@/lib/dinsos/assessment-registry-input";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { createAdminClient } from "@/lib/supabase/admin";

function mapReviewError(error: { message?: string } | null) {
  const message = error?.message ?? "";
  if (message.includes("CAPABILITY_REQUIRED")) {
    return new ApiError("Anda tidak memiliki kewenangan review asesmen.", 403);
  }
  if (message.includes("ASSESSMENT_NOT_FOUND")) {
    return new ApiError("Asesmen tidak ditemukan.", 404);
  }
  if (message.includes("ASSESSMENT_ALREADY_REVIEWED")) {
    return new ApiError("Asesmen sudah direview.", 409);
  }
  if (message.includes("INVALID_REVIEW")) {
    return new ApiError("Keputusan review tidak valid.", 400);
  }
  return new ApiError("Review asesmen tidak dapat disimpan.", 400);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  try {
    assertSameOrigin(request);
    assertBodySize(request);
    const actor = await requireDinsosActor();
    await requireCapability(actor.profileId, "DINSOS_ASSESSMENT_REVIEW");
    const { assessmentId: rawAssessmentId } = await params;
    const assessmentId = assertAssessmentId(rawAssessmentId);
    const input = parseAssessmentReviewInput(await request.json());
    const admin = createAdminClient();
    const { data: assessment, error: assessmentError } = await admin
      .from("dinsos_assessments")
      .select("id,assessment_code,warga_id,status")
      .eq("id", assessmentId)
      .maybeSingle();
    if (assessmentError) throw assessmentError;
    if (!assessment) throw new ApiError("Asesmen tidak ditemukan.", 404);

    const { data, error } = await admin.rpc("dinsos_review_assessment", {
      p_assessment_id: assessmentId,
      p_actor_id: actor.profileId,
      p_decision: input.decision,
      p_path: input.path,
      p_target_opd_id: input.targetOpdId,
      p_note: input.note,
    });
    if (error) throw mapReviewError(error);

    const approved = input.decision === "APPROVED";
    await writeActivityLog({
      userId: actor.profileId,
      namaPengguna: actor.namaLengkap,
      rolePengguna: actor.role,
      aktivitas: approved
        ? "Menyetujui asesmen sosial"
        : "Meminta re-asesmen sosial",
      modul: "Dinas Sosial",
      metadata: {
        assessmentId,
        assessmentCode: assessment.assessment_code,
        wargaId: assessment.warga_id,
        decision: input.decision,
        approvedPath: input.path,
      },
    });

    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    return apiErrorResponse(
      error,
      "Dinsos assessment review failed",
      "Review asesmen tidak dapat disimpan.",
    );
  }
}
