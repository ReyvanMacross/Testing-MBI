import { rm } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { cleanupCiptaBintarFixtures, seedCiptaBintarFixtures } from "./cipta-bintar-fixture-lib.mjs";
import { getSupabaseAdminEnvironment, loadProjectEnvironment, PROJECT_ROOT } from "../lib/project-env.mjs";

await loadProjectEnvironment();

const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const admin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const demoCodes = ["PRG-INF-01", "PRG-INF-02", "PRG-INF-03"];
const demoInstruction = "Data demo persisten CIPTA_BINTAR.";

async function closeDemoSourceCases(programIds) {
  if (!programIds.length) return;
  const referrals = await checked(await admin.from("referral_mbi")
    .select("id,case_id")
    .in("program_id", programIds)
    .eq("is_fixture", false)
    .in("instruction", ["Instruksi fixture tanpa data pribadi.", demoInstruction]));
  if (!referrals.length) return;
  const caseIds = [...new Set(referrals.map((row) => row.case_id).filter(Boolean))];
  const interventions = await checked(await admin.from("cipta_bintar_interventions")
    .select("id,beneficiary_profile_id").in("referral_id", referrals.map((row) => row.id)));
  if (interventions.length) {
    await checked(await admin.from("cipta_bintar_interventions").update({ is_fixture: false })
      .in("id", interventions.map((row) => row.id)));
    await checked(await admin.from("cipta_bintar_beneficiary_profiles").update({ is_fixture: false })
      .in("id", interventions.map((row) => row.beneficiary_profile_id)));
  }
  if (caseIds.length) {
    await checked(await admin.from("dinsos_cases").update({
      current_stage: "SELESAI",
      closed_at: new Date().toISOString(),
    }).in("id", caseIds));
  }
  await checked(await admin.from("referral_mbi").update({ instruction: demoInstruction })
    .in("id", referrals.map((row) => row.id)));
}

const existing = await admin.from("master_program_layanan")
  .select("id", { count: "exact" })
  .in("kode_program", demoCodes);
if (existing.error) throw existing.error;
if (existing.count === demoCodes.length) {
  await closeDemoSourceCases((existing.data ?? []).map((row) => row.id));
  console.log("Data demo CIPTA_BINTAR sudah tersedia; seed tidak diulang.");
  process.exit(0);
}
if ((existing.count ?? 0) > 0) {
  throw new Error("Data demo CIPTA_BINTAR hanya terpasang sebagian; periksa PRG-INF-01 sampai PRG-INF-03.");
}

function todayInBandung() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

async function checked(result) {
  if (result.error) throw result.error;
  return result.data;
}

async function rpc(name, parameters) {
  return checked(await admin.rpc(name, parameters));
}

async function start(state, referralKey, programCode, officerCode, location, objectAddress, infrastructureCategory, aidPackage, allocatedBudget) {
  const referral = state.referrals[referralKey];
  return rpc("cipta_bintar_start_intervention", {
    p_referral_id: referral.referralId,
    p_actor_id: state.actor.id,
    p_actor_opd_id: state.actor.opd_id,
    p_program_id: state.programs[programCode].id,
    p_petugas_id: state.officers[officerCode].id,
    p_alamat_objek: objectAddress,
    p_kategori_infrastruktur: infrastructureCategory,
    p_lokasi_objek: location,
    p_start_date: todayInBandung(),
    p_jenis_bantuan: aidPackage,
    p_alokasi_pagu: allocatedBudget,
    p_action_plan: "Verifikasi lapangan, pengerjaan fisik, pengawasan teknis, dan evaluasi kelayakan fasilitas.",
  });
}

const state = await seedCiptaBintarFixtures({ useExistingWarga: true });
let promoted = false;

try {
  const active = await start(
    state, "primary", "DEV-PRG-INF-01", "DEV-PINF-01",
    "Lokasi objek sintetis Sukajadi", "Rumah Swadaya Sukajadi", "Rehabilitasi Rutilahu",
    "Perbaikan atap, dinding, lantai, dan sanitasi keluarga", 25000000,
  );
  await rpc("cipta_bintar_update_intervention_progress", {
    p_intervention_id: active.interventionId,
    p_actor_id: state.actor.id,
    p_actor_opd_id: state.actor.opd_id,
    p_participant_status: "DALAM_PENGERJAAN",
    p_progress_percent: 65,
    p_feasibility_status: "PROGRES_FISIK",
    p_evaluation_note: "Pemasangan rangka atap dan pasangan dinding telah mencapai tahap pengerjaan fisik.",
  });

  const assisted = await start(
    state, "quotaA", "DEV-PRG-INF-QUOTA", "DEV-PINF-02",
    "Jamika, Bojongloa Kaler", "MCK Komunal Pasteur", "Sanitasi Komunal & MCK",
    "Pembangunan unit MCK, septic tank komunal, dan saluran limbah", 15000000,
  );
  await rpc("cipta_bintar_update_intervention_progress", {
    p_intervention_id: assisted.interventionId,
    p_actor_id: state.actor.id,
    p_actor_opd_id: state.actor.opd_id,
    p_participant_status: "DALAM_PENGERJAAN",
    p_progress_percent: 45,
    p_feasibility_status: "BELUM_DIVERIFIKASI",
    p_evaluation_note: "Pekerjaan fondasi, septic tank, dan saluran pembuangan sedang berlangsung.",
  });

  const completed = await start(
    state, "completion", "DEV-PRG-INF-01", "DEV-PINF-01",
    "Sekeloa, Coblong", "Sambungan Rumah Air Bersih", "Sambungan Air Bersih",
    "Pemasangan pipa SPAM, sambungan rumah, dan meteran air", 8500000,
  );
  await rpc("cipta_bintar_complete_intervention", {
    p_intervention_id: completed.interventionId,
    p_actor_id: state.actor.id,
    p_actor_opd_id: state.actor.opd_id,
    p_realization_value: 8500000,
    p_completion_date: todayInBandung(),
    p_evaluation: "Uji aliran air bersih berhasil dan sambungan rumah telah diserahterimakan.",
  });

  const wrong = state.referrals.wrongTarget;
  await checked(await admin.from("referral_mbi").delete().eq("id", wrong.referralId).eq("is_fixture", true));
  await checked(await admin.from("penentuan_jalur").delete().eq("id", wrong.pathDecisionId));
  await checked(await admin.from("dinsos_cases").delete().eq("id", wrong.caseId).eq("is_fixture", true));
  await checked(await admin.from("dinsos_assessments").delete().eq("id", wrong.assessmentId).eq("is_fixture", true));
  await checked(await admin.from("master_program_layanan").delete().in("id", [
    state.programs["DEV-PRG-DINSOS-WRONG"].id,
    state.programs["DEV-PRG-PATH-WRONG"].id,
  ]));

  const rutilahuProgramId = state.programs["DEV-PRG-INF-01"].id;
  const sanitationProgramId = state.programs["DEV-PRG-INF-QUOTA"].id;
  const rutilahuOfficerId = state.officers["DEV-PINF-01"].id;
  const sanitationOfficerId = state.officers["DEV-PINF-02"].id;
  await checked(await admin.from("master_program_layanan").update({
    kode_program: "PRG-INF-01",
    nama_program: "Rehabilitasi Rutilahu & Rumah Swadaya MBI",
    jenis_intervensi: "INFRASTRUKTUR_PERMUKIMAN",
  }).eq("id", rutilahuProgramId));
  await checked(await admin.from("master_program_layanan").update({
    kode_program: "PRG-INF-02",
    nama_program: "Pembangunan Sanitasi Komunal & MCK Sehat",
    jenis_intervensi: "INFRASTRUKTUR_PERMUKIMAN",
  }).eq("id", sanitationProgramId));
  await checked(await admin.from("cipta_bintar_petugas").update({
    kode: "PINF-01", nama: "Petugas Rehabilitasi Sukajadi", wilayah_tugas: "Rutilahu dan Rumah Swadaya", lokasi: "Kecamatan Sukajadi",
  }).eq("id", rutilahuOfficerId));
  await checked(await admin.from("cipta_bintar_petugas").update({
    kode: "PINF-02", nama: "Petugas Sanitasi Kota", wilayah_tugas: "Sanitasi dan Air Bersih", lokasi: "Kota Bandung",
  }).eq("id", sanitationOfficerId));
  await checked(await admin.from("cipta_bintar_program_details").update({
    category: "Perbaikan Rutilahu (Atap & Dinding)", petugas: "Petugas Rehabilitasi Sukajadi",
    location: "Kecamatan Sukajadi", duration_value: 2, duration_unit: "BULAN",
    start_date: "2026-09-15", budget_per_unit: 25000000,
    capacity: 40, description: "Rehabilitasi rumah tidak layak huni melalui perbaikan atap, dinding, lantai, dan sanitasi.",
    facilitation: "Material atap, dinding, lantai, dan fasilitas sanitasi keluarga.",
  }).eq("program_id", rutilahuProgramId));
  await checked(await admin.from("cipta_bintar_program_details").update({
    category: "Sanitasi & Pengolahan Limbah", petugas: "Petugas Sanitasi Kota",
    location: "Kota Bandung", duration_value: 3, duration_unit: "BULAN",
    start_date: "2026-10-01", budget_per_unit: 15000000,
    capacity: 50, description: "Pembangunan sanitasi komunal, MCK sehat, septic tank, dan saluran pengolahan limbah.",
    facilitation: "Unit MCK, septic tank komunal, pipa pembuangan, dan saluran limbah.",
  }).eq("program_id", sanitationProgramId));

  const validKeys = ["primary", "completion", "quotaA", "quotaB", "report"];
  const validReferrals = validKeys.map((key) => state.referrals[key]);
  const interventionIds = [active.interventionId, assisted.interventionId, completed.interventionId];
  const profileRows = await checked(await admin.from("cipta_bintar_interventions")
    .select("beneficiary_profile_id").in("id", interventionIds));
  await checked(await admin.from("referral_mbi").update({ is_fixture: false })
    .in("id", validReferrals.map((row) => row.referralId)));
  await checked(await admin.from("dinsos_cases").update({ is_fixture: false })
    .in("id", validReferrals.map((row) => row.caseId)));
  await checked(await admin.from("dinsos_assessments").update({ is_fixture: false })
    .in("id", validReferrals.map((row) => row.assessmentId)));
  await checked(await admin.from("cipta_bintar_interventions").update({ is_fixture: false }).in("id", interventionIds));
  await checked(await admin.from("cipta_bintar_beneficiary_profiles").update({ is_fixture: false })
    .in("id", profileRows.map((row) => row.beneficiary_profile_id)));
  await checked(await admin.from("referral_mbi").update({ target_program: "Rehabilitasi Rutilahu & Rumah Swadaya MBI" })
    .in("id", [state.referrals.primary.referralId, state.referrals.completion.referralId, state.referrals.report.referralId]));
  await checked(await admin.from("referral_mbi").update({ target_program: "Pembangunan Sanitasi Komunal & MCK Sehat" })
    .in("id", [state.referrals.quotaA.referralId, state.referrals.quotaB.referralId]));

  await rpc("cipta_bintar_create_program", {
    p_actor_id: state.actor.id,
    p_actor_opd_id: state.actor.opd_id,
    p_code: "PRG-INF-03",
    p_name: "Pemasangan Sambungan Air Bersih (SPAM) MBI",
    p_category: "Sambungan Rumah (SR) Air Bersih",
    p_petugas_id: sanitationOfficerId,
    p_start_date: "2026-11-10",
    p_duration_value: 2,
    p_duration_unit: "BULAN",
    p_capacity: 60,
    p_budget_per_unit: 8500000,
    p_description: "Pemasangan jaringan pipa distribusi, sambungan rumah, meteran, dan uji aliran air bersih.",
  });

  const demoPrograms = await checked(await admin.from("master_program_layanan")
    .select("id").in("kode_program", demoCodes));
  await closeDemoSourceCases(demoPrograms.map((row) => row.id));

  promoted = true;
  await rm(path.join(PROJECT_ROOT, "artifacts", "cipta-bintar", "fixture-state.json"), { force: true });
  console.log("Data demo CIPTA_BINTAR berhasil disiapkan dari master warga bersama.");
  console.log("Rujukan CIPTA_BINTAR dan tiga program infrastruktur siap divalidasi.");
} catch (error) {
  if (!promoted) {
    try {
      await cleanupCiptaBintarFixtures();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Seed demo CIPTA_BINTAR dan cleanup sama-sama gagal.");
    }
  }
  throw error;
}
