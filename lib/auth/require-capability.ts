import "server-only";

import { ApiError } from "@/lib/http/api-error-response";
import { createAdminClient } from "@/lib/supabase/admin";

export async function hasCapability(userId: string, capability: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_capabilities")
    .select("capability")
    .eq("user_id", userId)
    .eq("capability", capability)
    .maybeSingle();

  if (error) {
    throw new ApiError("Otorisasi capability tidak dapat diverifikasi.", 500);
  }

  return Boolean(data);
}

export async function requireCapability(userId: string, capability: string) {
  if (!(await hasCapability(userId, capability))) {
    throw new ApiError("Anda tidak memiliki kewenangan untuk tindakan ini.", 403);
  }
}
