import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseAdminEnvironment, loadProjectEnvironment, PROJECT_ROOT } from "../lib/project-env.mjs";

const PROGRAM_CODE = "DEV-PRG-KEC-01";
const SCHOOL_CODE = "DEV-SCH-KEC-01";
const FIXTURE_MARKER = "FIXTURE-KECAMATAN-MVP";
const stateFile = path.join(PROJECT_ROOT, "artifacts", "kecamatan", "fixture-state.json");

async function client() {
  await loadProjectEnvironment();
  const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
  return createClient(supabaseUrl, supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function savedState() {
  try { return JSON.parse(await readFile(stateFile, "utf8")); }
  catch (error) { if (error?.code === "ENOENT") return null; throw error; }
}

async function persist(state) {
  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(stateFile, JSON.stringify(state, null, 2));
}

function syntheticNumber(index, salt = 0) {
  const clock = Date.now().toString().slice(-10);
  return `9${clock}${String(salt).padStart(2, "0").slice(-2)}${String(index).padStart(3, "0").slice(-3)}`;
}

async function expectResult(result) {
  if (result.error) throw result.error;
  return result.data;
}

export async function cleanupKecamatanFixtures() {
  const db = await client();
  const saved = await savedState();
  const markerCitizens = await expectResult(await db.from("warga").select("id").eq("alamat_lengkap", FIXTURE_MARKER));
  const citizenIds = [...new Set([...(markerCitizens ?? []).map((row) => row.id), ...Object.values(saved?.citizens ?? {}).map((row) => row.id).filter(Boolean)])];
  if (citizenIds.length > 12) throw new Error(`Fixture cleanup guard: ${citizenIds.length} warga ditemukan.`);

  const proposalQuery = citizenIds.length
    ? await db.from("kecamatan_warga_usulan").select("id").in("warga_id", citizenIds).eq("is_fixture", true)
    : { data: [], error: null };
  const proposals = await expectResult(proposalQuery);
  const proposalIds = [...new Set([...(proposals ?? []).map((row) => row.id), ...Object.values(saved?.proposals ?? {}).map((row) => row.id).filter(Boolean)])];
  if (proposalIds.length > 10) throw new Error(`Fixture cleanup guard: ${proposalIds.length} usulan ditemukan.`);

  const detailsQuery = proposalIds.length
    ? await db.from("kecamatan_referral_details").select("referral_id").in("usulan_id", proposalIds).eq("is_fixture", true)
    : { data: [], error: null };
  const details = await expectResult(detailsQuery);
  const referralIds = [...new Set([...(details ?? []).map((row) => row.referral_id), ...Object.values(saved?.referrals ?? {}).map((row) => row.id).filter(Boolean)])];
  if (referralIds.length) await expectResult(await db.from("referral_mbi").delete().in("id", referralIds).eq("is_fixture", true));
  if (proposalIds.length) await expectResult(await db.from("kecamatan_warga_usulan").delete().in("id", proposalIds).eq("is_fixture", true));
  await expectResult(await db.from("kecamatan_helpdesk_tickets").delete().eq("is_fixture", true));
  if (citizenIds.length) {
    await expectResult(await db.from("penetapan_desil").delete().in("warga_id", citizenIds));
    await expectResult(await db.from("warga").delete().in("id", citizenIds).eq("alamat_lengkap", FIXTURE_MARKER));
  }
  const programs = await expectResult(await db.from("master_program_layanan").select("id").eq("kode_program", PROGRAM_CODE));
  if ((programs ?? []).length > 1) throw new Error("Fixture cleanup guard: kode program Kecamatan tidak unik.");
  if (programs?.length) await expectResult(await db.from("master_program_layanan").delete().eq("id", programs[0].id));
  await expectResult(await db.from("disdik_sekolah").delete().eq("kode", SCHOOL_CODE));

  const remaining = await Promise.all([
    db.from("kecamatan_warga_usulan").select("id", { count: "exact", head: true }).eq("is_fixture", true),
    db.from("kecamatan_survei").select("id", { count: "exact", head: true }).eq("is_fixture", true),
    db.from("kecamatan_documents").select("id", { count: "exact", head: true }).eq("is_fixture", true),
    db.from("kecamatan_referral_details").select("id", { count: "exact", head: true }).eq("is_fixture", true),
    db.from("kecamatan_helpdesk_tickets").select("id", { count: "exact", head: true }).eq("is_fixture", true),
  ]);
  for (const result of remaining) {
    if (result.error) throw result.error;
    if (result.count !== 0) throw new Error(`Fixture Kecamatan masih tersisa: ${result.count}.`);
  }
  await rm(stateFile, { force: true });
  return { citizens: citizenIds.length, proposals: proposalIds.length, referrals: referralIds.length, remaining: 0 };
}

export async function seedKecamatanFixtures() {
  await cleanupKecamatanFixtures();
  const db = await client();
  const state = { actor: null, district: null, villages: {}, program: null, school: null, citizens: {}, proposals: {}, surveys: {}, referrals: {} };
  try {
    const actor = await expectResult(await db.from("user_profiles").select("id,opd_id,wilayah_id").eq("username", "admin.kecamatan").single());
    const district = await expectResult(await db.from("master_wilayah").select("id,nama").eq("id", actor.wilayah_id).eq("jenis", "KECAMATAN").single());
    const villages = await expectResult(await db.from("master_wilayah").select("id,nama").eq("parent_id", district.id).eq("jenis", "KELURAHAN").eq("is_active", true).order("nama").limit(3));
    if (!villages || villages.length < 1) throw new Error("Kelurahan aktif untuk akun Kecamatan tidak tersedia.");
    const outsideDistrict = await expectResult(await db.from("master_wilayah").select("id,nama").eq("jenis", "KECAMATAN").neq("id", district.id).eq("is_active", true).limit(1).single());
    const outsideVillage = await expectResult(await db.from("master_wilayah").select("id,nama").eq("parent_id", outsideDistrict.id).eq("jenis", "KELURAHAN").eq("is_active", true).limit(1).single());
    const disdik = await expectResult(await db.from("master_opd").select("id,nama_opd").eq("kode_opd", "DISDIK").single());
    state.actor = actor; state.district = district; state.villages = Object.fromEntries(villages.map((row) => [row.nama, row]));
    await persist(state);

    const school = await expectResult(await db.from("disdik_sekolah").insert({
      kode: SCHOOL_CODE, nama: "Sekolah Pengujian Rujukan Kecamatan", jenjang: "LINTAS_JENJANG",
      kelurahan: villages[0].nama, alamat: "Lokasi pengujian internal",
    }).select("id,kode,nama").single());
    state.school = school; await persist(state);
    const program = await expectResult(await db.from("master_program_layanan").insert({
      kode_program: PROGRAM_CODE, nama_program: "Bantuan Pendidikan Rujukan Kecamatan",
      opd_id: disdik.id, jalur: "PENGUATAN_DASAR", jenis_intervensi: "Bantuan Pendidikan", is_active: true,
    }).select("id,kode_program,nama_program,opd_id").single());
    state.program = program; await persist(state);
    await expectResult(await db.from("disdik_program_details").insert({
      program_id: program.id, jenjang_target: "Lintas jenjang", jenis_bantuan: "Bantuan Pendidikan",
      sekolah_id: school.id, duration_value: 1, duration_unit: "BULAN",
      execution_date: new Date().toISOString().slice(0, 10), budget_per_student: 2500000,
      capacity: 20, description: "Program terkontrol untuk menguji rujukan lintas OPD dari Kecamatan.",
    }));

    const definitions = [
      ["waiting", "Warga Uji Kecamatan Satu", 1, district, villages[0]],
      ["assigned", "Warga Uji Kecamatan Dua", 2, district, villages[0]],
      ["approval", "Warga Uji Kecamatan Tiga", 3, district, villages[1] ?? villages[0]],
      ["approved", "Warga Uji Kecamatan Empat", 1, district, villages[1] ?? villages[0]],
      ["referred", "Warga Uji Kecamatan Lima", 2, district, villages[2] ?? villages[0]],
      ["unassigned", "Warga Uji Kecamatan Enam", 4, district, villages[0]],
      ["outside", "Warga Uji Luar Wilayah", 2, outsideDistrict, outsideVillage],
    ];
    const rows = definitions.map(([key, name, desil, districtRow, village], index) => ({
      key, desil, nik: syntheticNumber(index, 1), nomor_kk: syntheticNumber(index, 7), nama_lengkap: name,
      alamat_lengkap: FIXTURE_MARKER, kelurahan: village.nama, kecamatan: districtRow.nama,
      kecamatan_id: districtRow.id, kelurahan_id: village.id, pekerjaan: "Pekerjaan uji terkontrol",
      jumlah_anggota_kk: index + 1,
    }));
    for (const row of rows) {
      const { key, desil, ...citizenInput } = row;
      const citizen = await expectResult(await db.from("warga").insert(citizenInput).select("id,nik,nama_lengkap,kecamatan_id,kelurahan_id").single());
      state.citizens[key] = citizen; await persist(state);
      await expectResult(await db.from("penetapan_desil").insert({
        warga_id: citizen.id, desil_dtsen: desil, status_dtsen: "FIXTURE",
        tingkat_kerentanan: `DESIL_${desil}`, prioritas_intervensi: desil <= 2 ? "TINGGI" : "SEDANG",
      }));
    }

    for (const key of ["waiting", "assigned", "approval", "approved", "referred"]) {
      const citizen = state.citizens[key];
      const result = await expectResult(await db.rpc("kecamatan_create_proposal", {
        p_actor_id: actor.id, p_warga_id: citizen.id, p_kelurahan_id: citizen.kelurahan_id,
        p_rt: "4", p_rw: "8", p_initial_desil: definitions.find((item) => item[0] === key)[2],
        p_target_program_id: program.id,
        p_reason: "Kondisi warga perlu diverifikasi dan diteruskan ke program bantuan pendidikan yang sesuai.",
        p_is_fixture: true,
      }));
      state.proposals[key] = { id: result.proposalId }; await persist(state);
      await expectResult(await db.from("kecamatan_documents").insert([
        { usulan_id: result.proposalId, document_type: "KTP", label: "Identitas warga sintetis", verification_status: "VALID", is_fixture: true },
        { usulan_id: result.proposalId, document_type: "KK", label: "Kartu keluarga sintetis", verification_status: "VALID", is_fixture: true },
      ]));
    }

    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    for (const key of ["assigned", "approval", "approved", "referred"]) {
      const result = await expectResult(await db.rpc("kecamatan_assign_survey", {
        p_proposal_id: state.proposals[key].id, p_actor_id: actor.id,
        p_surveyor_name: `PSM ${district.nama}`, p_due_date: tomorrow,
        p_instruction: "Verifikasi kondisi faktual, domisili, dan kelayakan rujukan warga di lapangan.",
      }));
      state.surveys[key] = { id: result.surveyId }; await persist(state);
    }
    for (const key of ["approval", "approved", "referred"]) {
      await expectResult(await db.rpc("kecamatan_submit_survey", {
        p_survey_id: state.surveys[key].id, p_actor_id: actor.id, p_score: key === "approval" ? 72 : 84,
        p_factual_desil: key === "approval" ? 3 : 1,
        p_notes: "Hasil pemeriksaan lapangan menyatakan data domisili valid dan warga layak menerima rujukan bantuan.",
      }));
    }
    for (const key of ["approved", "referred"]) {
      await expectResult(await db.rpc("kecamatan_review_survey", {
        p_survey_id: state.surveys[key].id, p_actor_id: actor.id, p_decision: "APPROVE",
        p_target_program_id: program.id,
        p_review_note: "Hasil survei telah ditinjau Kecamatan dan disetujui untuk diteruskan ke OPD teknis.",
      }));
    }
    const referral = await expectResult(await db.rpc("kecamatan_send_referral", {
      p_proposal_id: state.proposals.referred.id, p_actor_id: actor.id, p_program_id: program.id,
      p_category: "Bantuan Pendidikan", p_instruction: "Tindak lanjuti hasil verifikasi Kecamatan melalui program bantuan pendidikan.", p_sla_hours: 48,
    }));
    state.referrals.referred = { id: referral.referralId, code: referral.referralCode }; await persist(state);
    return state;
  } catch (error) {
    try { await cleanupKecamatanFixtures(); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], "Seed Kecamatan gagal dan cleanup juga gagal."); }
    throw error;
  }
}
