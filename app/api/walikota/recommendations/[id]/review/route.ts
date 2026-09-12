import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireWalikotaActor } from "@/lib/auth/require-walikota-actor";
import { apiErrorResponse, ApiError } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseExecutiveReviewInput } from "@/lib/walikota/input";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    assertBodySize(request);
    const actor = await requireWalikotaActor();
    const { id } = await context.params;
    const input = parseExecutiveReviewInput(await request.json());
    const admin = createAdminClient();
    const result = await admin.rpc("walikota_review_recommendation", {
      p_recommendation_id: id,
      p_expected_version: input.expectedVersion,
      p_actor_id: actor.profileId,
      p_actor_opd_id: actor.opdId,
      p_action: input.action,
      p_priority_level: input.priorityLevel,
      p_leader_note: input.leaderNote,
      p_dispositions: input.dispositions,
    });
    if (result.error?.message.includes("VERSION_CONFLICT")) throw new ApiError("Rekomendasi telah diputuskan pengguna lain. Muat ulang data.", 409);
    if (result.error?.message.includes("NOT_REVIEWABLE")) throw new ApiError("Rekomendasi ini tidak lagi menunggu keputusan.", 409);
    if (result.error?.message.includes("ACTOR_REQUIRED")) throw new ApiError("Akses ditolak.", 403);
    if (result.error) throw new ApiError("Keputusan eksekutif tidak dapat disimpan.", 400);
    await writeActivityLog({
      userId: actor.profileId,
      namaPengguna: actor.namaLengkap,
      rolePengguna: actor.role,
      aktivitas: input.action === "APPROVE" ? "Menyetujui rekomendasi Bapperida" : "Menolak rekomendasi Bapperida",
      modul: "WALIKOTA",
      metadata: { recommendationId: id, priorityLevel: input.priorityLevel, dispositionCount: input.dispositions.length },
    });
    return NextResponse.json({ ok: true, ...result.data });
  } catch (error) {
    return apiErrorResponse(error, "Walikota executive review failed", "Keputusan eksekutif tidak dapat disimpan.");
  }
}
