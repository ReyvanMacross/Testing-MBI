import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireKecamatanActor } from "@/lib/auth/require-kecamatan-actor";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { mapKecamatanError } from "@/lib/kecamatan/api-error";
import { assertKecamatanId, parseSurveyAssignmentInput } from "@/lib/kecamatan/input";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ proposalId: string }> }) {
  try {
    assertSameOrigin(request); assertBodySize(request);
    const actor = await requireKecamatanActor(); const proposalId = assertKecamatanId((await params).proposalId, "Usulan");
    const input = parseSurveyAssignmentInput(await request.json());
    const { data, error } = await createAdminClient().rpc("kecamatan_assign_survey", { p_proposal_id: proposalId, p_actor_id: actor.profileId, p_surveyor_name: input.surveyorName, p_due_date: input.dueDate, p_instruction: input.instruction });
    if (error) throw mapKecamatanError(error, "Penugasan survei tidak dapat disimpan.");
    await writeActivityLog({ userId: actor.profileId, namaPengguna: actor.namaLengkap, rolePengguna: actor.role, aktivitas: "Menugaskan survei lapangan kewilayahan", modul: "Kecamatan", metadata: { proposalId, surveyId: data.surveyId } });
    return NextResponse.json({ ok: true, ...data }, { status: 201 });
  } catch (error) { return apiErrorResponse(error, "Kecamatan survey assignment failed", "Penugasan survei tidak dapat disimpan."); }
}
