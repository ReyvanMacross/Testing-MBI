import { client } from "./dinsos-fixture-lib.mjs";

export const DEV_PROGRAMS = [
  { code: "DEV-DINSOS-SEMBAKO-JKN", name: "DEV Paket Sembako & JKN", opd: "DINSOS", path: "PENGUATAN_DASAR", type: "FIXTURE" },
  { code: "DEV-DISKOP-MODAL-UMKM", name: "DEV Pendampingan Modal UMKM", opd: "DISKOP", path: "WIRAUSAHA", type: "FIXTURE" },
  { code: "DEV-DISNAKER-VOKASI", name: "DEV Pelatihan Vokasi & Magang", opd: "DISNAKER", path: "PEKERJA", type: "FIXTURE" },
];

export async function seedDinsosProgramFixtures() {
  const db = await client();
  const { data: opds, error } = await db.from("master_opd").select("id,kode_opd").in("kode_opd", DEV_PROGRAMS.map((item) => item.opd));
  if (error) throw error;
  const map = new Map((opds ?? []).map((opd) => [opd.kode_opd, opd.id]));
  if (map.size !== 3) throw new Error("Master OPD fixture program belum lengkap.");
  const rows = DEV_PROGRAMS.map((item) => ({ kode_program: item.code, nama_program: item.name, opd_id: map.get(item.opd), jalur: item.path, jenis_intervensi: item.type, is_active: true }));
  const { data, error: upsertError } = await db.from("master_program_layanan").upsert(rows, { onConflict: "kode_program" }).select("id,kode_program,nama_program,opd_id,jalur");
  if (upsertError) throw upsertError;
  return Object.fromEntries((data ?? []).map((program) => [program.kode_program, program]));
}

export async function cleanupDinsosProgramFixtures() {
  const db = await client();
  const codes = DEV_PROGRAMS.map((item) => item.code);
  const { data, error } = await db.from("master_program_layanan").select("id,kode_program").in("kode_program", codes);
  if (error) throw error;
  if ((data ?? []).length > codes.length) throw new Error("Fixture cleanup guard program gagal.");
  if (data?.length) {
    const { count, error: refError } = await db.from("referral_mbi").select("id", { count: "exact", head: true }).in("program_id", data.map((item) => item.id));
    if (refError) throw refError;
    if ((count ?? 0) > 0) throw new Error("Program fixture masih digunakan referral.");
    const deleted = await db.from("master_program_layanan").delete().in("kode_program", codes);
    if (deleted.error) throw deleted.error;
  }
  return data?.length ?? 0;
}
