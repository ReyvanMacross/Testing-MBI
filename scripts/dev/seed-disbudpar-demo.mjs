import { rm } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { cleanupDisbudparFixtures, seedDisbudparFixtures } from "./disbudpar-fixture-lib.mjs";
import { getSupabaseAdminEnvironment, loadProjectEnvironment, PROJECT_ROOT } from "../lib/project-env.mjs";

await loadProjectEnvironment();

const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const admin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const demoCodes = ["PRG-BUD-01", "PRG-BUD-02", "PRG-BUD-03"];

const existing = await admin.from("master_program_layanan")
  .select("id", { count: "exact", head: true })
  .in("kode_program", demoCodes);
if (existing.error) throw existing.error;
if (existing.count === demoCodes.length) {
  console.log("Data demo DISBUDPAR sudah tersedia; seed tidak diulang.");
  process.exit(0);
}
if ((existing.count ?? 0) > 0) {
  throw new Error("Data demo DISBUDPAR hanya terpasang sebagian; periksa PRG-BUD-01 sampai PRG-BUD-03.");
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

async function start(state, referralKey, programCode, officerCode, location, groupName, creativeSubsector, aidPackage) {
  const referral = state.referrals[referralKey];
  return rpc("disbudpar_start_intervention", {
    p_referral_id: referral.referralId,
    p_actor_id: state.actor.id,
    p_actor_opd_id: state.actor.opd_id,
    p_program_id: state.programs[programCode].id,
    p_pendamping_id: state.officers[officerCode].id,
    p_group_name: groupName,
    p_subsektor_ekraf: creativeSubsector,
    p_lokasi_sanggar: location,
    p_start_date: todayInBandung(),
    p_jenis_bantuan: aidPackage,
    p_action_plan: "Verifikasi penerima, penyaluran fasilitas seni, pendampingan produksi, dan evaluasi hasil pembinaan.",
  });
}

const state = await seedDisbudparFixtures();
let promoted = false;

try {
  const active = await start(
    state, "primary", "DEV-PRG-BUD-01", "DEV-PDB-01",
    "Galeri Kriya Sukajadi", "Sanggar Kriya Bambu Sukajadi", "Kriya, Seni Rupa, & Pertunjukan",
    "Set alat ukir, bahan kriya, dan fasilitasi ruang pamer",
  );
  await rpc("disbudpar_update_intervention_progress", {
    p_intervention_id: active.interventionId,
    p_actor_id: state.actor.id,
    p_actor_opd_id: state.actor.opd_id,
    p_participant_status: "AKTIF_PENDAMPINGAN",
    p_progress_percent: 65,
    p_creative_result_status: "AKTIF_TERBATAS",
    p_evaluation_note: "Produksi kriya aktif dan penerima telah memasuki tahap persiapan pameran komunitas.",
  });

  const assisted = await start(
    state, "quotaA", "DEV-PRG-BUD-QUOTA", "DEV-PDB-02",
    "Studio Tari Pasteur", "Sanggar Tari Pasteur", "Seni Musik & Seni Tari",
    "Set perangkat audio, kostum tari, dan pendampingan produksi",
  );
  await rpc("disbudpar_update_intervention_progress", {
    p_intervention_id: assisted.interventionId,
    p_actor_id: state.actor.id,
    p_actor_opd_id: state.actor.opd_id,
    p_participant_status: "AKTIF_PENDAMPINGAN",
    p_progress_percent: 45,
    p_creative_result_status: "BELUM_AKTIF",
    p_evaluation_note: "Peralatan telah disalurkan dan sanggar memasuki tahap latihan serta kurasi pertunjukan.",
  });

  const completed = await start(
    state, "completion", "DEV-PRG-BUD-01", "DEV-PDB-01",
    "Sanggar Wayang Coblong", "Komunitas Seni Coblong", "Seni Musik & Seni Tari",
    "Set alat musik tradisional, panggung, dan pendampingan pertunjukan",
  );
  await rpc("disbudpar_complete_intervention", {
    p_intervention_id: completed.interventionId,
    p_actor_id: state.actor.id,
    p_actor_opd_id: state.actor.opd_id,
    p_achievement_value: 3500000,
    p_completion_date: todayInBandung(),
    p_evaluation: "Pementasan perdana berhasil dan kelompok telah menerima pesanan pertunjukan rutin.",
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

  const urbanProgramId = state.programs["DEV-PRG-BUD-01"].id;
  const creativeProgramId = state.programs["DEV-PRG-BUD-QUOTA"].id;
  const urbanOfficerId = state.officers["DEV-PDB-01"].id;
  const creativeOfficerId = state.officers["DEV-PDB-02"].id;
  await checked(await admin.from("master_program_layanan").update({
    kode_program: "PRG-BUD-01",
    nama_program: "Pendampingan Sanggar & Galeri Kriya MBI",
    jenis_intervensi: "PEMBINAAN_EKRAF_SENI",
  }).eq("id", urbanProgramId));
  await checked(await admin.from("master_program_layanan").update({
    kode_program: "PRG-BUD-02",
    nama_program: "Fasilitasi Alat Musik Tradisional & Sanggar Tari",
    jenis_intervensi: "PEMBINAAN_EKRAF_SENI",
  }).eq("id", creativeProgramId));
  await checked(await admin.from("disbudpar_pendamping").update({
    kode: "PDB-BUD-01", nama: "Pendamping Ekraf Sukajadi", klaster: "Kriya dan Seni Pertunjukan", lokasi: "Kecamatan Sukajadi",
  }).eq("id", urbanOfficerId));
  await checked(await admin.from("disbudpar_pendamping").update({
    kode: "PDB-BUD-02", nama: "Pendamping Sanggar Kota", klaster: "Musik dan Seni Tari", lokasi: "Kota Bandung",
  }).eq("id", creativeOfficerId));
  await checked(await admin.from("disbudpar_program_details").update({
    category: "Kriya, Seni Rupa, & Pertunjukan", pendamping: "Pendamping Ekraf Sukajadi",
    location: "Kecamatan Sukajadi", duration_value: 2, duration_unit: "BULAN",
    capacity: 40, description: "Pendampingan produksi kriya, kurasi karya, dan pengelolaan galeri komunitas.",
    facilitation: "Set alat ukir, bahan kriya, modul produksi, dan fasilitasi ruang pamer.",
  }).eq("program_id", urbanProgramId));
  await checked(await admin.from("disbudpar_program_details").update({
    category: "Seni Musik & Seni Tari", pendamping: "Pendamping Sanggar Kota",
    location: "Kota Bandung", duration_value: 3, duration_unit: "BULAN",
    capacity: 50, description: "Fasilitasi alat musik tradisional dan pembinaan produksi pertunjukan sanggar tari.",
    facilitation: "Set alat musik gamelan, instrumen tradisional, kostum, dan panggung tari.",
  }).eq("program_id", creativeProgramId));

  const validKeys = ["primary", "completion", "quotaA", "quotaB", "report"];
  const validReferrals = validKeys.map((key) => state.referrals[key]);
  const interventionIds = [active.interventionId, assisted.interventionId, completed.interventionId];
  const profileRows = await checked(await admin.from("disbudpar_interventions")
    .select("beneficiary_profile_id").in("id", interventionIds));
  await checked(await admin.from("referral_mbi").update({ is_fixture: false })
    .in("id", validReferrals.map((row) => row.referralId)));
  await checked(await admin.from("dinsos_cases").update({ is_fixture: false })
    .in("id", validReferrals.map((row) => row.caseId)));
  await checked(await admin.from("dinsos_assessments").update({ is_fixture: false })
    .in("id", validReferrals.map((row) => row.assessmentId)));
  await checked(await admin.from("disbudpar_interventions").update({ is_fixture: false }).in("id", interventionIds));
  await checked(await admin.from("disbudpar_beneficiary_profiles").update({ is_fixture: false })
    .in("id", profileRows.map((row) => row.beneficiary_profile_id)));
  await checked(await admin.from("referral_mbi").update({ target_program: "Pendampingan Sanggar & Galeri Kriya MBI" })
    .in("id", [state.referrals.primary.referralId, state.referrals.completion.referralId, state.referrals.report.referralId]));
  await checked(await admin.from("referral_mbi").update({ target_program: "Fasilitasi Alat Musik Tradisional & Sanggar Tari" })
    .in("id", [state.referrals.quotaA.referralId, state.referrals.quotaB.referralId]));

  await rpc("disbudpar_create_program", {
    p_actor_id: state.actor.id,
    p_actor_opd_id: state.actor.opd_id,
    p_code: "PRG-BUD-03",
    p_name: "Pelatihan Inkubasi Kuliner Lokal & Branding Ekraf",
    p_category: "Kuliner & Desain Grafis",
    p_pendamping_id: urbanOfficerId,
    p_duration_value: 2,
    p_duration_unit: "BULAN",
    p_capacity: 60,
    p_description: "Pelatihan pengembangan produk kuliner lokal, kemasan, identitas merek, dan pemasaran digital.",
  });

  promoted = true;
  await rm(path.join(PROJECT_ROOT, "artifacts", "disbudpar", "fixture-state.json"), { force: true });
  console.log("Data demo DISBUDPAR berhasil disiapkan dari master warga bersama.");
  console.log("Rujukan DISBUDPAR dan tiga program Ekraf & Sanggar Seni siap divalidasi.");
} catch (error) {
  if (!promoted) {
    try {
      await cleanupDisbudparFixtures();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Seed demo DISBUDPAR dan cleanup sama-sama gagal.");
    }
  }
  throw error;
}
