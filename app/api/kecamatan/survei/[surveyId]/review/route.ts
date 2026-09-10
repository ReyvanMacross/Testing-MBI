import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireKecamatanActor } from "@/lib/auth/require-kecamatan-actor";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { mapKecamatanError } from "@/lib/kecamatan/api-error";
import { assertKecamatanId, parseSurveyReviewInput } from "@/lib/kecamatan/input";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ surveyId: string }> }) {
  try {
    assertSameOrigin(request); assertBodySize(request);
    const actor = await requireKecamatanActor(); const surveyId = assertKecamatanId((await params).surveyId, "Survei");
    const input = parseSurveyReviewInput(await request.json());
    const { data, error } = await createAdminClient().rpc("kecamatan_review_survey", { p_survey_id: surveyId, p_actor_id: actor.profileId, p_decision: input.decision, p_target_program_id: input.targetProgramId, p_review_note: input.reviewNote });
    if (error) throw mapKecamatanError(error, "Review survei tidak dapat disimpan.");
    await writeActivityLog({ userId: actor.profileId, namaPengguna: actor.namaLengkap, rolePengguna: actor.role, aktivitas: input.decision === "APPROVE" ? "Menyetujui hasil survei kewilayahan" : "Meminta survei kewilayahan ulang", modul: "Kecamatan", metadata: { surveyId } });
    return NextResponse.json({ ok: true, ...data });
  } catch (error) { return apiErrorResponse(error, "Kecamatan survey review failed", "Review survei tidak dapat disimpan."); }
}
