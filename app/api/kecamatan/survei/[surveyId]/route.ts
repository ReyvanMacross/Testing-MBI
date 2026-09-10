import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireKecamatanActor } from "@/lib/auth/require-kecamatan-actor";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { mapKecamatanError } from "@/lib/kecamatan/api-error";
import { assertKecamatanId, parseSurveyResultInput } from "@/lib/kecamatan/input";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ surveyId: string }> }) {
  try {
    assertSameOrigin(request); assertBodySize(request);
    const actor = await requireKecamatanActor(); const surveyId = assertKecamatanId((await params).surveyId, "Survei");
    const input = parseSurveyResultInput(await request.json());
    const { data, error } = await createAdminClient().rpc("kecamatan_submit_survey", { p_survey_id: surveyId, p_actor_id: actor.profileId, p_score: input.score, p_factual_desil: input.factualDesil, p_notes: input.notes });
    if (error) throw mapKecamatanError(error, "Hasil survei tidak dapat disimpan.");
    await writeActivityLog({ userId: actor.profileId, namaPengguna: actor.namaLengkap, rolePengguna: actor.role, aktivitas: "Menyimpan hasil survei kewilayahan", modul: "Kecamatan", metadata: { surveyId } });
    return NextResponse.json({ ok: true, ...data });
  } catch (error) { return apiErrorResponse(error, "Kecamatan survey submission failed", "Hasil survei tidak dapat disimpan."); }
}
