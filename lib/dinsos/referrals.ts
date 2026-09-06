import "server-only";

import type { DinsosActor } from "@/lib/auth/require-dinsos-actor";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapDinsosRpcError } from "./assessment";

export async function sendStabilizationReferral(caseId: string, actor: DinsosActor) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("dinsos_send_stabilization", { p_case_id: caseId, p_actor_id: actor.profileId, p_source_opd_id: actor.opdId });
  if (error) throw mapDinsosRpcError(error);
  return data;
}
