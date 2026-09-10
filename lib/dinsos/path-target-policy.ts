import "server-only";

import pathTargets from "@/data/reference/dinsos-path-targets.json";
import { createAdminClient } from "@/lib/supabase/admin";

import type { DinsosPath } from "./path-values";

const POLICY = pathTargets as Record<DinsosPath, string[]>;

export function getAllowedTargetOpdCodes(path: DinsosPath) {
  return [...POLICY[path]];
}

export function validateTargetOpdForPath(path: DinsosPath, opdCode: string) {
  return POLICY[path].includes(opdCode);
}

export async function getAllowedTargetOpds(path?: DinsosPath) {
  const codes = path
    ? getAllowedTargetOpdCodes(path)
    : Array.from(new Set(Object.values(POLICY).flat()));
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("master_opd")
    .select("id,kode_opd,nama_opd")
    .in("kode_opd", codes)
    .order("nama_opd");

  if (error) {
    throw new Error("Gagal mengambil pilihan OPD tujuan.");
  }

  const rows = data ?? [];
  const found = new Set(rows.map((row) => row.kode_opd));
  const missing = codes.filter((code) => !found.has(code));
  if (missing.length > 0) {
    throw new Error(`Master OPD tujuan belum lengkap: ${missing.join(", ")}.`);
  }

  return rows.map((row) => ({
    id: row.id,
    code: row.kode_opd,
    name: row.nama_opd,
  }));
}
