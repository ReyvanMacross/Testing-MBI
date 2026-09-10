import "server-only";

import { mapReferralRpcError } from "@/lib/dinsos/referrals";
import { createAdminClient } from "@/lib/supabase/admin";

export type OpdReferralTransition = "DITERIMA" | "DIPROSES" | "SELESAI" | "DIBATALKAN";

export async function transitionReferralStatus(input: {
  referralId: string;
  toStatus: OpdReferralTransition;
  actorUserId?: string | null;
  actorOpdId: string;
  note?: string | null;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("transition_referral_status", {
    p_referral_id: input.referralId, p_to_status: input.toStatus,
    p_actor_user_id: input.actorUserId ?? null, p_actor_opd_id: input.actorOpdId,
    p_note: input.note ?? null,
  });
  if (error) throw mapReferralRpcError(error);
  return data;
}
