import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireDp3aActor } from "@/lib/auth/require-dp3a-actor";
import { assertReferralId, parseStartCaseInput } from "@/lib/dp3a/input";
import { apiErrorResponse, ApiError } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { createAdminClient } from "@/lib/supabase/admin";

function mapError(error: { message?: string } | null) {
  const message = error?.message ?? "";
  if (message.includes("CASE_ALREADY_STARTED") || message.includes("INVALID_REFERRAL_TRANSITION")) return new ApiError("Kasus sudah diproses oleh petugas lain.", 409);
  if (message.includes("REFERRAL_NOT_FOUND")) return new ApiError("Referral tidak ditemukan.", 404);
  if (message.includes("TARGET_OPD_REQUIRED") || message.includes("DP3A_ACTOR_REQUIRED")) return new ApiError("Akses referral ditolak.", 403);
  if (message.includes("INVALID_PROGRAM")) return new ApiError("Program tidak aktif atau tidak sesuai DP3A.", 400);
  if (message.includes("INVALID_UNIT")) return new ApiError("Unit pelaksana tidak aktif atau tidak sesuai program.", 400);
  if (message.includes("PROGRAM_CAPACITY_FULL")) return new ApiError("Kuota program sudah penuh.", 409);
  return new ApiError("Penanganan kasus tidak dapat dimulai.", 400);
}

export async function POST(request: Request, { params }: { params: Promise<{ referralId: string }> }) {
  try {
    assertSameOrigin(request); assertBodySize(request);
    const actor = await requireDp3aActor();
    const referralId = assertReferralId((await params).referralId);
    const input = parseStartCaseInput(await request.json());
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("dp3a_start_case", {
      p_referral_id: referralId,
      p_actor_id: actor.profileId,
      p_actor_opd_id: actor.opdId,
      p_program_id: input.programId,
      p_unit_id: input.unitId,
      p_start_date: input.startDate,
      p_case_type: input.caseType,
      p_support_item: input.supportItem,
      p_action_plan: input.actionPlan,
    });
    if (error) throw mapError(error);
    await writeActivityLog({ userId: actor.profileId, namaPengguna: actor.namaLengkap, rolePengguna: actor.role, aktivitas: "Memulai penanganan kasus DP3A", modul: "DP3A", metadata: { referralId, programId: input.programId } });
    return NextResponse.json({ ok: true, ...data });
  } catch (error) { return apiErrorResponse(error, "DP3A case start failed", "Penanganan kasus tidak dapat dimulai."); }
}
