import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireDinsosActor } from "@/lib/auth/require-dinsos-actor";
import { assertReferralId, parseReferralSendInput } from "@/lib/dinsos/referral-input";
import { getReferralById, mapReferralRpcError } from "@/lib/dinsos/referrals";
import { ApiError, apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ referralId: string }> }) {
  try {
    assertSameOrigin(request);
    assertBodySize(request);
    const actor = await requireDinsosActor();
    const { referralId: rawId } = await params;
    const referralId = assertReferralId(rawId);
    const input = parseReferralSendInput(await request.json());
    const referral = await getReferralById(referralId);
    if (!referral) throw new ApiError("Referral tidak ditemukan.", 404);
    if (referral.status !== "MENUNGGU_RUJUKAN") throw new ApiError("Referral sudah pernah dikirim.", 409);

    const admin = createAdminClient();
    const { data: program, error: programError } = await admin
      .from("master_program_layanan")
      .select("id,opd_id,jalur,is_active")
      .eq("id", input.programId)
      .maybeSingle();
    if (programError) throw programError;
    if (!program || !program.is_active) throw new ApiError("Program intervensi tidak aktif atau tidak ditemukan.", 400);
    if (program.opd_id !== referral.targetOpdId) throw new ApiError("Program tidak sesuai OPD tujuan.", 400);
    if (program.jalur && program.jalur !== referral.jalur) throw new ApiError("Program tidak sesuai jalur referral.", 400);

    const { data, error } = await admin.rpc("dinsos_send_referral", {
      p_referral_id: referralId,
      p_actor_id: actor.profileId,
      p_program_id: input.programId,
      p_referral_date: input.referralDate,
      p_instruction: input.instruction,
    });
    if (error) throw mapReferralRpcError(error);

    await writeActivityLog({
      userId: actor.profileId,
      namaPengguna: actor.namaLengkap,
      rolePengguna: actor.role,
      aktivitas: "Mengirim referral ke OPD",
      modul: "Dinas Sosial",
      metadata: {
        referralId,
        programId: input.programId,
        targetOpdId: referral.targetOpdId,
        jalur: referral.jalur,
      },
    });
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    return apiErrorResponse(error, "Dinsos referral send failed", "Referral tidak dapat dikirim.");
  }
}
