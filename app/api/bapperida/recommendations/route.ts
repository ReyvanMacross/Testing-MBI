import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireBapperidaActor } from "@/lib/auth/require-bapperida-actor";
import { parseRecommendationInput } from "@/lib/bapperida/input";
import { apiErrorResponse, ApiError } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    assertBodySize(request);
    const actor = await requireBapperidaActor();
    const input = parseRecommendationInput(await request.json());
    const admin = createAdminClient();
    const saved = await admin.rpc("bapperida_save_recommendation", {
      p_recommendation_id: input.recommendationId,
      p_expected_version: input.expectedVersion,
      p_actor_id: actor.profileId,
      p_actor_opd_id: actor.opdId,
      p_category: input.category,
      p_finding: input.finding,
      p_recommendation: input.recommendation,
      p_recipient_opd_ids: input.recipientOpdIds,
    });
    if (saved.error?.message.includes("VERSION_CONFLICT")) throw new ApiError("Rekomendasi telah diubah pengguna lain. Muat ulang data.", 409);
    if (saved.error?.message.includes("NOT_EDITABLE")) throw new ApiError("Status rekomendasi ini tidak dapat diedit.", 409);
    if (saved.error?.message.includes("ACTOR_REQUIRED")) throw new ApiError("Akses ditolak.", 403);
    if (saved.error) throw new ApiError("Rekomendasi tidak dapat disimpan.", 400);

    let result = saved.data as { recommendationId: string; status: string; version: number };
    if (input.submit) {
      const submitted = await admin.rpc("bapperida_submit_recommendation", {
        p_recommendation_id: result.recommendationId,
        p_expected_version: result.version,
        p_actor_id: actor.profileId,
        p_actor_opd_id: actor.opdId,
      });
      if (submitted.error?.message.includes("VERSION_CONFLICT")) throw new ApiError("Rekomendasi telah diubah pengguna lain. Muat ulang data.", 409);
      if (submitted.error) throw new ApiError("Rekomendasi tersimpan, tetapi belum dapat diajukan.", 400);
      result = submitted.data as typeof result;
    }
    await writeActivityLog({
      userId: actor.profileId,
      namaPengguna: actor.namaLengkap,
      rolePengguna: actor.role,
      aktivitas: input.submit ? "Mengajukan rekomendasi kebijakan" : "Menyimpan draf rekomendasi kebijakan",
      modul: "BAPPERIDA",
      metadata: { recommendationId: result.recommendationId, status: result.status },
    });
    return NextResponse.json({ ok: true, ...result }, { status: input.recommendationId ? 200 : 201 });
  } catch (error) {
    return apiErrorResponse(error, "Bapperida recommendation failed", "Rekomendasi tidak dapat disimpan.");
  }
}
