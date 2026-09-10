import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isManagedUserRole,
  USER_ROLE_RULES,
} from "@/lib/diskominfo/user-role-config";
import { ApiError } from "@/lib/http/api-error-response";

export class UserValidationError extends ApiError {
  constructor(message: string, status: 400 | 409 = 400) {
    super(message, status);
    this.name = "UserValidationError";
  }
}

type AssignmentRecord = {
  opd: { id: string; nama: string } | null;
  wilayah: {
    id: string;
    nama: string;
    jenis: "KECAMATAN" | "KELURAHAN";
  } | null;
  instansi: string;
  wilayahLegacy: string;
};

async function getOpd(client: SupabaseClient, opdId: string | null) {
  if (!opdId) {
    return null;
  }

  const { data, error } = await client
    .from("master_opd")
    .select("id, nama_opd")
    .eq("id", opdId)
    .maybeSingle();

  if (error || !data) {
    throw new UserValidationError("Instansi/OPD tidak valid.");
  }

  return { id: data.id, nama: data.nama_opd };
}

async function getWilayah(client: SupabaseClient, wilayahId: string | null) {
  if (!wilayahId) {
    return null;
  }

  const { data, error } = await client
    .from("master_wilayah")
    .select("id, nama, jenis, is_active")
    .eq("id", wilayahId)
    .maybeSingle();

  if (
    error ||
    !data ||
    !data.is_active ||
    (data.jenis !== "KECAMATAN" && data.jenis !== "KELURAHAN")
  ) {
    throw new UserValidationError("Wilayah penugasan tidak valid.");
  }

  return {
    id: data.id,
    nama: data.nama,
    jenis: data.jenis as "KECAMATAN" | "KELURAHAN",
  };
}

export async function validateUserAssignment(
  client: SupabaseClient,
  role: string,
  opdId: string | null,
  wilayahId: string | null,
  options?: { allowUnchangedLegacyRole?: string },
): Promise<AssignmentRecord> {
  const [opd, wilayah] = await Promise.all([
    getOpd(client, opdId),
    getWilayah(client, wilayahId),
  ]);

  if (!isManagedUserRole(role)) {
    if (role !== options?.allowUnchangedLegacyRole) {
      throw new UserValidationError("Pilih role yang didukung sistem.");
    }
  } else {
    const rule = USER_ROLE_RULES[role];

    if (rule.requiresWilayah && !wilayah) {
      throw new UserValidationError("Wilayah penugasan wajib dipilih.");
    }

    if (!rule.requiresWilayah && wilayah) {
      throw new UserValidationError(
        "Admin Diskominfo tidak menggunakan wilayah penugasan.",
      );
    }

    if (
      wilayah &&
      !(rule.allowedWilayahTypes as readonly string[]).includes(wilayah.jenis)
    ) {
      throw new UserValidationError(
        role === "Operator Lapangan" || role === "Operator Kecamatan"
          ? "Operator Lapangan harus ditugaskan ke kecamatan."
          : "Operator Kelurahan harus ditugaskan ke kelurahan.",
      );
    }
  }

  const instansi =
    opd?.nama ??
    (wilayah
      ? `${wilayah.jenis === "KECAMATAN" ? "Kecamatan" : "Kelurahan"} ${wilayah.nama}`
      : "Diskominfo Kota Bandung");

  return {
    opd,
    wilayah,
    instansi,
    wilayahLegacy: wilayah?.nama ?? "- Semua Wilayah -",
  };
}
