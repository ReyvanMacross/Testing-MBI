import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseAdminEnvironment,
  loadProjectEnvironment,
  PROJECT_ROOT,
} from "../lib/project-env.mjs";

const stateFile = path.join(PROJECT_ROOT, "artifacts", "integration", "base-fixture-state.json");

async function client() {
  await loadProjectEnvironment();
  const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function readState() {
  try {
    return JSON.parse(await readFile(stateFile, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function cleanupIntegrationBaseFixtures() {
  const state = await readState();
  const citizenIds = [...new Set(state?.citizenIds ?? [])];
  if (citizenIds.length > 24) {
    throw new Error(`Fixture cleanup guard: ${citizenIds.length} warga integrasi ditemukan.`);
  }
  if (!citizenIds.length) {
    await rm(stateFile, { force: true });
    return 0;
  }

  const db = await client();
  const { data: citizens, error: lookupError } = await db.from("warga")
    .select("id,nama_lengkap")
    .in("id", citizenIds);
  if (lookupError) throw lookupError;
  if ((citizens ?? []).some((row) => !row.nama_lengkap.startsWith("Warga Integrasi Fixture "))) {
    throw new Error("Fixture cleanup guard: identitas warga tidak sesuai marker integrasi.");
  }

  const result = await db.from("warga").delete().in("id", citizenIds);
  if (result.error) throw result.error;
  await rm(stateFile, { force: true });
  return citizens?.length ?? 0;
}

export async function seedIntegrationBaseFixtures() {
  await cleanupIntegrationBaseFixtures();
  const db = await client();
  const citizens = Array.from({ length: 24 }, (_, index) => ({
    nik: ["3273", "99", String(9_000_000_000 + index)].join(""),
    nama_lengkap: `Warga Integrasi Fixture ${String(index + 1).padStart(2, "0")}`,
    kelurahan: "Sukajadi",
    kecamatan: "Sukajadi",
    pekerjaan: "Data pengujian integrasi",
  }));
  const citizenInsert = await db.from("warga").insert(citizens).select("id");
  if (citizenInsert.error) throw citizenInsert.error;
  const citizenIds = citizenInsert.data.map((row) => row.id);
  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(stateFile, JSON.stringify({ citizenIds }, null, 2));

  const desilInsert = await db.from("penetapan_desil").insert(citizenIds.map((wargaId, index) => ({
    warga_id: wargaId,
    desil_dtsen: (index % 6) + 1,
    status_dtsen: "FIXTURE_INTEGRASI",
    tingkat_kerentanan: "DATA_PENGUJIAN",
    prioritas_intervensi: "VALIDASI_MBI",
  })));
  if (desilInsert.error) {
    await cleanupIntegrationBaseFixtures();
    throw desilInsert.error;
  }
  return citizenIds.length;
}
