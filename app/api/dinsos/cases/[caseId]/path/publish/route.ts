import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { hasCapability } from "@/lib/auth/require-capability";
import { requireDinsosActor } from "@/lib/auth/require-dinsos-actor";
import { getCasePathContext } from "@/lib/dinsos/path-decisions";
import {
  assertPathCaseId,
  parsePathPublishInput,
} from "@/lib/dinsos/path-publish-input";
import { validateTargetOpdForPath } from "@/lib/dinsos/path-target-policy";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { createAdminClient } from "@/lib/supabase/admin";

function mapPublishError(error: { message?: string } | null) {
  const message = error?.message ?? "";
  if (message.includes("CASE_NOT_FOUND")) {
    return new ApiError("Kasus tidak ditemukan.", 404);
  }
  if (
    message.includes("PATH_ALREADY_PUBLISHED") ||
    message.includes("duplicate key")
  ) {
    return new ApiError(
      "Referral untuk keputusan jalur ini sudah diterbitkan.",
      409,
    );
  }
  if (message.includes("APPROVED_ASSESSMENT_REQUIRED")) {
    return new ApiError(
      "Asesmen masih menunggu review supervisor.",
      409,
    );
  }
  if (message.includes("CAPABILITY_REQUIRED")) {
    return new ApiError(
      "Anda tidak memiliki kewenangan mengubah jalur.",
      403,
    );
  }
  if (message.includes("INVALID_TARGET_OPD")) {
    return new ApiError("OPD rujukan tidak sesuai jalur yang dipilih.", 400);
  }
  if (message.includes("INVALID_OVERRIDE")) {
    return new ApiError("Alasan perubahan jalur tidak valid.", 400);
  }
  if (message.includes("INVALID_PATH") || message.includes("INVALID_INSTRUCTION")) {
    return new ApiError("Data penerbitan referral tidak valid.", 400);
  }
  return new ApiError("Referral jalur tidak dapat diterbitkan.", 400);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  try {
    assertSameOrigin(request);
    assertBodySize(request);
    const actor = await requireDinsosActor();
    const { caseId: rawCaseId } = await params;
    const caseId = assertPathCaseId(rawCaseId);
    const input = parsePathPublishInput(await request.json());
    const admin = createAdminClient();

    const { data: caseRow, error: caseError } = await admin
      .from("dinsos_cases")
      .select("id,current_stage")
      .eq("id", caseId)
      .maybeSingle();
    if (caseError) throw caseError;
    if (!caseRow) throw new ApiError("Kasus tidak ditemukan.", 404);
    if (caseRow.current_stage !== "MENUNGGU_SPLIT_JALUR") {
      throw new ApiError(
        "Referral untuk keputusan jalur ini sudah diterbitkan.",
        409,
      );
    }

    const context = await getCasePathContext(caseId);
    if (!context) {
      throw new ApiError("Asesmen masih menunggu review supervisor.", 409);
    }

    const { data: targetOpd, error: targetError } = await admin
      .from("master_opd")
      .select("id,kode_opd")
      .eq("id", input.targetOpdId)
      .maybeSingle();
    if (targetError) throw targetError;
    if (
      !targetOpd ||
      !validateTargetOpdForPath(input.path, targetOpd.kode_opd)
    ) {
      throw new ApiError("OPD rujukan tidak sesuai jalur yang dipilih.", 400);
    }

    const overrideUsed = input.path !== context.approvedPath;
    if (overrideUsed) {
      if (!(await hasCapability(actor.profileId, "DINSOS_PATH_OVERRIDE"))) {
        throw new ApiError(
          "Anda tidak memiliki kewenangan mengubah jalur.",
          403,
        );
      }
      if (!input.overrideReason) {
        throw new ApiError("Alasan perubahan jalur minimal 20 karakter.", 400);
      }
    }

    const { data, error } = await admin.rpc("dinsos_publish_path_referral", {
      p_case_id: caseId,
      p_actor_id: actor.profileId,
      p_path: input.path,
      p_target_opd_id: input.targetOpdId,
      p_override_reason: overrideUsed ? input.overrideReason : null,
      p_instruction: input.referralNote,
    });
    if (error) throw mapPublishError(error);

    const result = data as Record<string, unknown>;
    await writeActivityLog({
      userId: actor.profileId,
      namaPengguna: actor.namaLengkap,
      rolePengguna: actor.role,
      aktivitas: overrideUsed
        ? "Mengubah dan menerbitkan jalur MBI"
        : "Menerbitkan referral jalur MBI",
      modul: "Dinas Sosial",
      metadata: {
        caseId,
        assessmentId: context.assessmentId,
        pathDecisionId: result.pathDecisionId,
        referralId: result.referralId,
        finalPath: input.path,
        targetOpdId: input.targetOpdId,
        overrideUsed,
      },
    });

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(
      error,
      "Dinsos path referral publish failed",
      "Referral jalur tidak dapat diterbitkan.",
    );
  }
}
