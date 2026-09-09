import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireDisnakerActor } from "@/lib/auth/require-disnaker-actor";
import { assertReferralId, parseCompleteInterventionInput } from "@/lib/disnaker/input";
import { apiErrorResponse, ApiError } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { createAdminClient } from "@/lib/supabase/admin";

function mapError(error: { message?: string } | null) {
  const message = error?.message ?? "";
  if (message.includes("INTERVENTION_ALREADY_COMPLETED") || message.includes("INVALID_REFERRAL_TRANSITION")) return new ApiError("Intervensi sudah diselesaikan oleh petugas lain.", 409);
  if (message.includes("REFERRAL_NOT_FOUND")) return new ApiError("Referral tidak ditemukan.", 404);
  if (message.includes("TARGET_OPD_REQUIRED") || message.includes("DISNAKER_ACTOR_REQUIRED")) return new ApiError("Akses referral ditolak.", 403);
  return new ApiError("Intervensi tidak dapat diselesaikan.", 400);
}

export async function POST(request: Request, { params }: { params: Promise<{ referralId: string }> }) {
  try {
    assertSameOrigin(request); assertBodySize(request);
    const actor = await requireDisnakerActor();
    const referralId = assertReferralId((await params).referralId);
    const input = parseCompleteInterventionInput(await request.json());
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("disnaker_complete_intervention", { p_referral_id: referralId, p_actor_id: actor.profileId, p_actor_opd_id: actor.opdId, p_placement_partner: input.placementPartner, p_placement_date: input.placementDate, p_evaluation: input.evaluation });
    if (error) throw mapError(error);
    await writeActivityLog({ userId: actor.profileId, namaPengguna: actor.namaLengkap, rolePengguna: actor.role, aktivitas: "Menyelesaikan intervensi vokasi", modul: "Disnaker", metadata: { referralId } });
    return NextResponse.json({ ok: true, ...data });
  } catch (error) { return apiErrorResponse(error, "Disnaker intervention completion failed", "Intervensi tidak dapat diselesaikan."); }
}
