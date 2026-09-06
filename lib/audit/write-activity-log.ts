import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { redactAuditMetadata } from "@/lib/audit/redact-audit-metadata";

export type ActivityStatus = "BERHASIL" | "GAGAL" | "PERINGATAN";

export type WriteActivityLogInput = {
  userId?: string | null;
  namaPengguna: string;
  rolePengguna: string;
  aktivitas: string;
  modul: string;
  status?: ActivityStatus;
  metadata?: Record<string, unknown>;
};

export async function writeActivityLog(input: WriteActivityLogInput) {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("log_aktivitas").insert({
      user_id: input.userId ?? null,
      nama_pengguna: input.namaPengguna,
      role_pengguna: input.rolePengguna,
      aktivitas: input.aktivitas,
      modul: input.modul,
      status: input.status ?? "BERHASIL",
      metadata: redactAuditMetadata(input.metadata ?? {}),
    });

    if (error) {
      console.error("Failed to write activity log:", error.message);
    }
  } catch (error) {
    console.error(
      "Failed to write activity log:",
      error instanceof Error ? error.message : error,
    );
  }
}
