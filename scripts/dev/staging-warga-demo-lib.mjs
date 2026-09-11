import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseAdminEnvironment, loadProjectEnvironment } from "../lib/project-env.mjs";

const DEMO_COUNT = 24;
const DEMO_NAME_PREFIX = "Warga Demo MBI ";
const DEMO_SURVEY_MARKER = "DATA_PROTOTYPE_MBI";
const DEMO_DESIL_MARKER = "PROTOTYPE_MBI";

function identifiers(index) {
  return {
    nik: ["3273", "88", String(8_000_000_000 + index)].join(""),
    familyCard: ["3273", "77", String(7_000_000_000 + index)].join(""),
  };
}

function demoNiks() {
  return Array.from({ length: DEMO_COUNT }, (_, index) => identifiers(index).nik);
}

async function client() {
  await loadProjectEnvironment();
  const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function expectResult(result) {
  const resolved = await result;
  if (resolved.error) throw resolved.error;
  return resolved.data ?? [];
}

async function territory(db) {
  const district = await expectResult(await db.from("master_wilayah")
    .select("id,nama")
    .eq("jenis", "KECAMATAN")
    .eq("nama", "Sukajadi")
    .eq("is_active", true)
    .single());
  const villages = await expectResult(await db.from("master_wilayah")
    .select("id,nama")
    .eq("jenis", "KELURAHAN")
    .eq("parent_id", district.id)
    .eq("is_active", true)
    .order("nama"));
  assert.ok(villages.length > 0, "Kelurahan aktif di Kecamatan Sukajadi tidak tersedia.");
  return { district, villages };
}

export async function seedStagingWargaDemo() {
  const db = await client();
  const { district, villages } = await territory(db);
  const citizens = Array.from({ length: DEMO_COUNT }, (_, index) => {
    const village = villages[index % villages.length];
    const { nik, familyCard } = identifiers(index);
    return {
      nik,
      nomor_kk: familyCard,
      nama_lengkap: `${DEMO_NAME_PREFIX}${String(index + 1).padStart(2, "0")}`,
      tempat_lahir: "Bandung",
      jenis_kelamin: index % 2 === 0 ? "L" : "P",
      status_perkawinan: index % 3 === 0 ? "KAWIN" : "BELUM KAWIN",
      alamat_lengkap: `Alamat Sintetis Prototype MBI ${String(index + 1).padStart(2, "0")}`,
      kelurahan: village.nama,
      kecamatan: district.nama,
      kelurahan_id: village.id,
      kecamatan_id: district.id,
      koordinat_lat: -6.89 - (index % villages.length) * 0.002,
      koordinat_lng: 107.58 + (index % villages.length) * 0.002,
      pendidikan_terakhir: ["SD", "SMP", "SMA", "DIPLOMA"][index % 4],
      pekerjaan: ["Pekerja Harian", "Pelaku Usaha Mikro", "Mengurus Rumah Tangga", "Pencari Kerja"][index % 4],
      pendapatan: (index % 4) * 750_000,
      jumlah_anggota_kk: (index % 5) + 1,
      status_rumah: index % 2 === 0 ? "SEWA" : "MILIK KELUARGA",
    };
  });
  const rows = await expectResult(await db.from("warga")
    .upsert(citizens, { onConflict: "nik" })
    .select("id,nik"));
  assert.equal(rows.length, DEMO_COUNT, "Jumlah warga prototype yang tersimpan tidak lengkap.");
  const citizenByNik = new Map(rows.map((row) => [row.nik, row.id]));
  const citizenIds = demoNiks().map((nik) => citizenByNik.get(nik));
  assert.ok(citizenIds.every(Boolean), "ID warga prototype tidak lengkap.");

  await expectResult(await db.from("penetapan_desil")
    .delete()
    .in("warga_id", citizenIds)
    .eq("status_dtsen", DEMO_DESIL_MARKER));
  await expectResult(await db.from("verifikasi_validasi")
    .delete()
    .in("warga_id", citizenIds)
    .eq("hasil_survey", DEMO_SURVEY_MARKER));

  await expectResult(await db.from("penetapan_desil").insert(citizenIds.map((wargaId, index) => {
    const desil = (index % 5) + 1;
    return {
      warga_id: wargaId,
      desil_dtsen: desil,
      status_dtsen: DEMO_DESIL_MARKER,
      status_pbi: desil <= 2,
      status_pkh: desil === 1,
      status_sembako_bpnt: desil <= 3,
      tingkat_kerentanan: `DESIL_${desil}`,
      skor_kemiskinan: 100 - desil * 12,
      prioritas_intervensi: desil <= 2 ? "TINGGI" : desil === 3 ? "SEDANG" : "RENDAH",
    };
  })));
  await expectResult(await db.from("verifikasi_validasi").insert(citizenIds.map((wargaId, index) => ({
    warga_id: wargaId,
    status_verifikasi: index < 18 ? "VERIFIED" : "PENDING",
    pelaksana_verivali: ["Tim Prototype Kecamatan Sukajadi"],
    tanggal_verifikasi: index < 18 ? new Date().toISOString().slice(0, 10) : null,
    petugas_verifikasi: index < 18 ? "Petugas Prototype MBI" : null,
    hasil_survey: DEMO_SURVEY_MARKER,
  }))));

  return auditStagingWargaDemo(db);
}

export async function auditStagingWargaDemo(existingClient) {
  const db = existingClient ?? await client();
  const citizens = await expectResult(await db.from("warga")
    .select("id,nik,nama_lengkap,kecamatan_id,kelurahan_id")
    .in("nik", demoNiks()));
  assert.equal(citizens.length, DEMO_COUNT, `Warga prototype harus berjumlah ${DEMO_COUNT}.`);
  assert.ok(citizens.every((row) => row.nama_lengkap.startsWith(DEMO_NAME_PREFIX)), "Marker nama warga prototype tidak konsisten.");
  assert.ok(citizens.every((row) => row.kecamatan_id && row.kelurahan_id), "Wilayah warga prototype belum terselesaikan.");
  const citizenIds = citizens.map((row) => row.id);
  const [desil, verification] = await Promise.all([
    expectResult(db.from("penetapan_desil")
      .select("warga_id,desil_dtsen")
      .in("warga_id", citizenIds)
      .eq("status_dtsen", DEMO_DESIL_MARKER)),
    expectResult(db.from("verifikasi_validasi")
      .select("warga_id,status_verifikasi")
      .in("warga_id", citizenIds)
      .eq("hasil_survey", DEMO_SURVEY_MARKER)),
  ]);
  assert.equal(desil.length, DEMO_COUNT, "Penetapan desil warga prototype tidak lengkap.");
  assert.equal(verification.length, DEMO_COUNT, "Status verifikasi warga prototype tidak lengkap.");
  const distribution = Object.fromEntries([1, 2, 3, 4, 5].map((value) => [value, desil.filter((row) => row.desil_dtsen === value).length]));
  assert.ok(Object.values(distribution).every((count) => count > 0), "Distribusi Desil 1-5 warga prototype tidak lengkap.");
  return {
    citizens: citizens.length,
    resolvedTerritory: citizens.filter((row) => row.kecamatan_id && row.kelurahan_id).length,
    verified: verification.filter((row) => row.status_verifikasi === "VERIFIED").length,
    pending: verification.filter((row) => row.status_verifikasi === "PENDING").length,
    desil: distribution,
  };
}

export async function cleanupStagingWargaDemo() {
  const db = await client();
  const citizens = await expectResult(await db.from("warga")
    .select("id,nama_lengkap")
    .in("nik", demoNiks()));
  assert.ok(citizens.every((row) => row.nama_lengkap.startsWith(DEMO_NAME_PREFIX)), "Cleanup ditolak karena marker warga tidak cocok.");
  const citizenIds = citizens.map((row) => row.id);
  if (!citizenIds.length) return 0;
  const dependencies = await Promise.all([
    db.from("dinsos_cases").select("id", { count: "exact", head: true }).in("warga_id", citizenIds),
    db.from("referral_mbi").select("id", { count: "exact", head: true }).in("warga_id", citizenIds),
    db.from("kecamatan_warga_usulan").select("id", { count: "exact", head: true }).in("warga_id", citizenIds),
  ]);
  for (const result of dependencies) {
    if (result.error) throw result.error;
    assert.equal(result.count, 0, "Cleanup ditolak karena warga prototype sudah digunakan workflow.");
  }
  await expectResult(await db.from("warga").delete().in("id", citizenIds));
  return citizenIds.length;
}
