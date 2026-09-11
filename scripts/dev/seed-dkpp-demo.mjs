import { rm } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { cleanupDkppFixtures, seedDkppFixtures } from "./dkpp-fixture-lib.mjs";
import { getSupabaseAdminEnvironment, loadProjectEnvironment, PROJECT_ROOT } from "../lib/project-env.mjs";

await loadProjectEnvironment();

const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const admin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const demoCodes = ["PRG-SAE-01", "PRG-SAE-02", "PRG-SAE-03"];

const existing = await admin.from("master_program_layanan")
  .select("id", { count: "exact", head: true })
  .in("kode_program", demoCodes);
if (existing.error) throw existing.error;
if (existing.count === demoCodes.length) {
  console.log("Data demo DKPP sudah tersedia; seed tidak diulang.");
  process.exit(0);
}
if ((existing.count ?? 0) > 0) {
  throw new Error("Data demo DKPP hanya terpasang sebagian; periksa PRG-SAE-01 sampai PRG-SAE-03.");
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

async function start(state, referralKey, programCode, officerCode, location, groupName, foodCategory, aidPackage) {
  const referral = state.referrals[referralKey];
  return rpc("dkpp_start_intervention", {
    p_referral_id: referral.referralId,
    p_actor_id: state.actor.id,
    p_actor_opd_id: state.actor.opd_id,
    p_program_id: state.programs[programCode].id,
    p_penyuluh_id: state.officers[officerCode].id,
    p_group_name: groupName,
    p_food_category: foodCategory,
    p_lokasi_demplot: location,
    p_start_date: todayInBandung(),
    p_jenis_bantuan: aidPackage,
    p_action_plan: "Verifikasi penerima, penyaluran bantuan, pendampingan budidaya, dan evaluasi hasil panen.",
  });
}

const state = await seedDkppFixtures();
let promoted = false;

try {
  const active = await start(
    state, "primary", "DEV-PRG-SAE-01", "DEV-PPL-01",
    "Demplot KWT Sukajadi Blok C", "KWT Buruan SAE Sukajadi", "Urban Farming",
    "Paket instalasi hidroponik dan bibit sayuran",
  );
  await rpc("dkpp_update_intervention_progress", {
    p_intervention_id: active.interventionId,
    p_actor_id: state.actor.id,
    p_actor_opd_id: state.actor.opd_id,
    p_participant_status: "AKTIF_PENDAMPINGAN",
    p_progress_percent: 65,
    p_harvest_status: "HASIL_MENCUKUPI",
    p_evaluation_note: "Instalasi hidroponik aktif dan penerima telah memasuki tahap pemeliharaan tanaman.",
  });

  const assisted = await start(
    state, "quotaA", "DEV-PRG-SAE-QUOTA", "DEV-PPL-02",
    "Pekarangan Pangan Pasteur", "Kelompok Pangan Pasteur", "Bantuan Bibit dan Ternak",
    "Paket budikdamber, benih lele, dan bibit sayur",
  );
  await rpc("dkpp_update_intervention_progress", {
    p_intervention_id: assisted.interventionId,
    p_actor_id: state.actor.id,
    p_actor_opd_id: state.actor.opd_id,
    p_participant_status: "AKTIF_PENDAMPINGAN",
    p_progress_percent: 45,
    p_harvest_status: "BELUM_PANEN",
    p_evaluation_note: "Bantuan telah disalurkan dan budidaya masuk tahap pemantauan kualitas air.",
  });

  const completed = await start(
    state, "completion", "DEV-PRG-SAE-01", "DEV-PPL-01",
    "Kebun Pangan Mandiri Coblong", "Poktan Mandiri Coblong", "Urban Farming",
    "Paket bibit, bioflok, dan media tanam",
  );
  await rpc("dkpp_complete_intervention", {
    p_intervention_id: completed.interventionId,
    p_actor_id: state.actor.id,
    p_actor_opd_id: state.actor.opd_id,
    p_harvest_value: 3500000,
    p_completion_date: todayInBandung(),
    p_evaluation: "Panen perdana memenuhi kebutuhan keluarga dan sebagian hasil telah dipasarkan melalui kelompok tani.",
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

  const urbanProgramId = state.programs["DEV-PRG-SAE-01"].id;
  const foodProgramId = state.programs["DEV-PRG-SAE-QUOTA"].id;
  const urbanOfficerId = state.officers["DEV-PPL-01"].id;
  const foodOfficerId = state.officers["DEV-PPL-02"].id;
  await checked(await admin.from("master_program_layanan").update({
    kode_program: "PRG-SAE-01",
    nama_program: "Pelatihan Urban Farming & Hidroponik Mandiri",
    jenis_intervensi: "KETAHANAN_PANGAN",
  }).eq("id", urbanProgramId));
  await checked(await admin.from("master_program_layanan").update({
    kode_program: "PRG-SAE-02",
    nama_program: "Stimulan Pekarangan Pangan & Budikdamber Lele",
    jenis_intervensi: "KETAHANAN_PANGAN",
  }).eq("id", foodProgramId));
  await checked(await admin.from("dkpp_penyuluh").update({
    kode: "PPL-SAE-01", nama: "Penyuluh Buruan SAE Sukajadi", klaster: "Urban Farming", lokasi: "Kecamatan Sukajadi",
  }).eq("id", urbanOfficerId));
  await checked(await admin.from("dkpp_penyuluh").update({
    kode: "PPL-SAE-02", nama: "Penyuluh Pangan Keluarga", klaster: "Budikdamber dan Pangan", lokasi: "Kota Bandung",
  }).eq("id", foodOfficerId));
  await checked(await admin.from("dkpp_program_details").update({
    category: "Urban Farming", penyuluh: "Penyuluh Buruan SAE Sukajadi",
    location: "Kecamatan Sukajadi", duration_value: 2, duration_unit: "BULAN",
    capacity: 50, description: "Pelatihan hidroponik dan pendampingan budidaya pangan keluarga.",
    facilitation: "Instalasi hidroponik, bibit sayur, nutrisi, dan pendampingan teknis.",
  }).eq("program_id", urbanProgramId));
  await checked(await admin.from("dkpp_program_details").update({
    category: "Bantuan Bibit & Ternak", penyuluh: "Penyuluh Pangan Keluarga",
    location: "Kota Bandung", duration_value: 3, duration_unit: "BULAN",
    capacity: 30, description: "Stimulan pekarangan pangan dan budidaya ikan dalam ember.",
    facilitation: "Paket budikdamber, benih lele, bibit sayur, dan pakan awal.",
  }).eq("program_id", foodProgramId));

  const validKeys = ["primary", "completion", "quotaA", "quotaB", "report"];
  const validReferrals = validKeys.map((key) => state.referrals[key]);
  const interventionIds = [active.interventionId, assisted.interventionId, completed.interventionId];
  const profileRows = await checked(await admin.from("dkpp_interventions")
    .select("beneficiary_profile_id").in("id", interventionIds));
  await checked(await admin.from("referral_mbi").update({ is_fixture: false })
    .in("id", validReferrals.map((row) => row.referralId)));
  await checked(await admin.from("dinsos_cases").update({ is_fixture: false })
    .in("id", validReferrals.map((row) => row.caseId)));
  await checked(await admin.from("dinsos_assessments").update({ is_fixture: false })
    .in("id", validReferrals.map((row) => row.assessmentId)));
  await checked(await admin.from("dkpp_interventions").update({ is_fixture: false }).in("id", interventionIds));
  await checked(await admin.from("dkpp_beneficiary_profiles").update({ is_fixture: false })
    .in("id", profileRows.map((row) => row.beneficiary_profile_id)));
  await checked(await admin.from("referral_mbi").update({ target_program: "Pelatihan Urban Farming & Hidroponik Mandiri" })
    .in("id", [state.referrals.primary.referralId, state.referrals.completion.referralId, state.referrals.report.referralId]));
  await checked(await admin.from("referral_mbi").update({ target_program: "Stimulan Pekarangan Pangan & Budikdamber Lele" })
    .in("id", [state.referrals.quotaA.referralId, state.referrals.quotaB.referralId]));

  await rpc("dkpp_create_program", {
    p_actor_id: state.actor.id,
    p_actor_opd_id: state.actor.opd_id,
    p_code: "PRG-SAE-03",
    p_name: "Bantuan Rumah Kompos & Organik Kota",
    p_category: "Pengolahan Limbah Pangan",
    p_penyuluh_id: urbanOfficerId,
    p_duration_value: 2,
    p_duration_unit: "BULAN",
    p_capacity: 25,
    p_description: "Bantuan sarana kompos dan pelatihan pemanfaatan limbah organik rumah tangga.",
  });

  promoted = true;
  await rm(path.join(PROJECT_ROOT, "artifacts", "dkpp", "fixture-state.json"), { force: true });
  console.log("Data demo DKPP berhasil disiapkan dari master warga bersama.");
  console.log("Rujukan DKPP dan tiga program Buruan SAE siap divalidasi.");
} catch (error) {
  if (!promoted) {
    try {
      await cleanupDkppFixtures();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Seed demo DKPP dan cleanup sama-sama gagal.");
    }
  }
  throw error;
}
