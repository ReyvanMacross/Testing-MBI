import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireDiskopActor } from "@/lib/auth/require-diskop-actor";
import { assertReferralId, parseStartInterventionInput } from "@/lib/diskop/input";
import { apiErrorResponse, ApiError } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { createAdminClient } from "@/lib/supabase/admin";

function mapError(error: { message?: string } | null) {
  const message = error?.message ?? "";
  if (message.includes("INTERVENTION_ALREADY_STARTED") || message.includes("INVALID_REFERRAL_TRANSITION")) return new ApiError("Intervensi sudah diproses oleh petugas lain.", 409);
  if (message.includes("REFERRAL_NOT_FOUND")) return new ApiError("Referral tidak ditemukan.", 404);
  if (message.includes("TARGET_OPD_REQUIRED") || message.includes("DISKOP_ACTOR_REQUIRED")) return new ApiError("Akses referral ditolak.", 403);
  if (message.includes("INVALID_PROGRAM")) return new ApiError("Program tidak aktif atau tidak sesuai Diskop.", 400);
  if (message.includes("INVALID_PROGRAM_PROVIDER")) return new ApiError("Pendamping tidak sesuai program.", 400);
  if (message.includes("PROGRAM_CAPACITY_FULL")) return new ApiError("Kuota program sudah penuh.", 409);
  return new ApiError("Intervensi tidak dapat dimulai.", 400);
}

export async function POST(request: Request, { params }: { params: Promise<{ referralId: string }> }) {
  try {
    assertSameOrigin(request); assertBodySize(request);
    const actor = await requireDiskopActor();
    const referralId = assertReferralId((await params).referralId);
    const input = parseStartInterventionInput(await request.json());
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("diskop_start_intervention", {
      p_referral_id: referralId,
      p_actor_id: actor.profileId,
      p_actor_opd_id: actor.opdId,
      p_program_id: input.programId,
      p_pendamping_id: input.pendampingId,
      p_start_date: input.startDate,
      p_stimulus: input.stimulus,
      p_action_plan: input.actionPlan,
    });
    if (error) throw mapError(error);
    await writeActivityLog({ userId: actor.profileId, namaPengguna: actor.namaLengkap, rolePengguna: actor.role, aktivitas: "Memulai pendampingan wirausaha", modul: "Diskop UKM", metadata: { referralId, programId: input.programId } });
    return NextResponse.json({ ok: true, ...data });
  } catch (error) { return apiErrorResponse(error, "Diskop intervention start failed", "Pendampingan tidak dapat dimulai."); }
}
