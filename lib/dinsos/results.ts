import "server-only";

import type { DinsosActor } from "@/lib/auth/require-dinsos-actor";
import { ApiError } from "@/lib/http/api-error-response";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapDinsosRpcError } from "./assessment";

export async function overrideDinsosResult(caseId: string, actor: DinsosActor, newDesil: number, reason: string) {
  if (!Number.isInteger(newDesil) || newDesil < 1 || newDesil > 10 || reason.trim().length < 20 || reason.trim().length > 1000) {
    throw new ApiError("Desil atau alasan override tidak valid.", 400);
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("dinsos_override_result", { p_case_id: caseId, p_actor_id: actor.profileId, p_new_desil: newDesil, p_reason: reason.trim() });
  if (error) throw mapDinsosRpcError(error);
  return data;
}

export async function confirmDinsosResult(caseId: string, actor: DinsosActor) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("dinsos_confirm_result", { p_case_id: caseId, p_actor_id: actor.profileId });
  if (error) throw mapDinsosRpcError(error);
  return data;
}
