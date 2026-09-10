import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireDinsosActor } from "@/lib/auth/require-dinsos-actor";
import { parseCreateAssessmentInput } from "@/lib/dinsos/assessment-registry-input";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    assertBodySize(request);
    const actor = await requireDinsosActor();
    const input = parseCreateAssessmentInput(await request.json());
    const admin = createAdminClient();

    const [wargaResult, typeResult] = await Promise.all([
      admin.from("warga").select("id").eq("id", input.wargaId).maybeSingle(),
      admin
        .from("dinsos_assessment_types")
        .select("code,requires_recommendation,is_active")
        .eq("code", input.assessmentTypeCode)
        .maybeSingle(),
    ]);
    if (wargaResult.error || typeResult.error) throw wargaResult.error ?? typeResult.error;
    if (!wargaResult.data) throw new ApiError("Warga tidak ditemukan.", 404);
    if (!typeResult.data?.is_active) {
      throw new ApiError("Jenis asesmen tidak valid.", 400);
    }
    if (typeResult.data.requires_recommendation && !input.recommendation) {
      throw new ApiError("Rekomendasi jalur wajib dipilih.", 400);
    }

    if (input.reassessmentOf) {
      const { data: previous, error } = await admin
        .from("dinsos_assessments")
        .select("id,warga_id,status")
        .eq("id", input.reassessmentOf)
        .maybeSingle();
      if (error) throw error;
      if (
        !previous ||
        previous.warga_id !== input.wargaId ||
        previous.status !== "MINTA_REASESMEN"
      ) {
        throw new ApiError("Re-asesmen tidak dapat dibuat dari asesmen ini.", 409);
      }
    }

    const { data: activeCase, error: caseError } = await admin
      .from("dinsos_cases")
      .select("id")
      .eq("warga_id", input.wargaId)
      .is("closed_at", null)
      .not("current_stage", "in", "(SELESAI,DIBATALKAN)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (caseError) throw caseError;

    const { data: assessment, error: insertError } = await admin
      .from("dinsos_assessments")
      .insert({
        warga_id: input.wargaId,
        case_id: activeCase?.id ?? null,
        assessment_type_code: typeResult.data.code,
        assessment_date: input.assessmentDate,
        observation: input.observation,
        field_recommendation: input.recommendation,
        status: "PERLU_REVIEW",
        reassessment_of_id: input.reassessmentOf,
        created_by: actor.profileId,
      })
      .select("id,assessment_code,status")
      .single();
    if (insertError) throw insertError;

    await writeActivityLog({
      userId: actor.profileId,
      namaPengguna: actor.namaLengkap,
      rolePengguna: actor.role,
      aktivitas: "Membuat asesmen sosial",
      modul: "Dinas Sosial",
      metadata: {
        assessmentId: assessment.id,
        assessmentCode: assessment.assessment_code,
        wargaId: input.wargaId,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        assessmentId: assessment.id,
        assessmentCode: assessment.assessment_code,
        status: assessment.status,
      },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(
      error,
      "Dinsos assessment registry create failed",
      "Asesmen tidak dapat dibuat.",
    );
  }
}
