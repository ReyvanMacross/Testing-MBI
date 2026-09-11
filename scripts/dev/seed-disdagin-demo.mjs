import { rm } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { cleanupDisdaginFixtures, seedDisdaginFixtures } from "./disdagin-fixture-lib.mjs";
import { getSupabaseAdminEnvironment, loadProjectEnvironment, PROJECT_ROOT } from "../lib/project-env.mjs";

await loadProjectEnvironment();

const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const admin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const existing = await admin.from("master_program_layanan")
  .select("id", { count: "exact", head: true })
  .in("kode_program", ["PRG-DAG-01", "PRG-DAG-02", "PRG-DAG-03"]);
if (existing.error) throw existing.error;
if (existing.count === 3) {
  console.log("Data demo Disdagin sudah tersedia; seed tidak diulang.");
  process.exit(0);
}
if ((existing.count ?? 0) > 0) {
  throw new Error("Data demo Disdagin hanya terpasang sebagian; periksa PRG-DAG-01 sampai PRG-DAG-03.");
}

function todayInBandung() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function checked(result) {
  if (result.error) throw result.error;
  return result.data;
}

async function rpc(name, parameters) {
  return checked(await admin.rpc(name, parameters));
}

async function start(state, referralKey, programCode, mentorCode, nib, businessName, businessCategory) {
  const referral = state.referrals[referralKey];
  return rpc("disdagin_start_intervention", {
    p_referral_id: referral.referralId,
    p_actor_id: state.actor.id,
    p_actor_opd_id: state.actor.opd_id,
    p_program_id: state.programs[programCode].id,
    p_pendamping_id: state.mentors[mentorCode].id,
    p_business_name: businessName,
    p_business_category: businessCategory,
    p_nib: nib,
    p_start_date: todayInBandung(),
    p_stimulus: "Fasilitasi booth, kurasi produk, dan akses mitra retail Disdagin.",
    p_action_plan: "Kurasi produk, penempatan agenda, pemantauan transaksi, dan tindak lanjut kemitraan pasar.",
  });
}

const state = await seedDisdaginFixtures();
let promoted = false;

try {
  const active = await start(
    state, "primary", "DEV-PRG-DAG-01", "DEV-PLUT-01",
    "9000000009301", "Galeri Produk Kreatif", "Confectionery & Fashion",
  );
  await rpc("disdagin_update_intervention_progress", {
    p_intervention_id: active.interventionId,
    p_actor_id: state.actor.id,
    p_actor_opd_id: state.actor.opd_id,
    p_participant_status: "AKTIF_PENDAMPINGAN",
    p_progress_percent: 75,
    p_legal_status: "PROSES_NIB_HALAL",
    p_evaluation_note: "Produk telah lolos kurasi dan stand pameran sedang disiapkan bersama mitra penyelenggara.",
  });

  const facilitated = await start(
    state, "quotaA", "DEV-PRG-DAG-QUOTA", "DEV-PLUT-02",
    "9000000009302", "Dapur Olahan Bandung", "Olahan Kuliner",
  );
  await rpc("disdagin_update_intervention_progress", {
    p_intervention_id: facilitated.interventionId,
    p_actor_id: state.actor.id,
    p_actor_opd_id: state.actor.opd_id,
    p_participant_status: "AKTIF_PENDAMPINGAN",
    p_progress_percent: 55,
    p_legal_status: "PROSES_NIB_HALAL",
    p_evaluation_note: "Kurasi kemasan selesai dan peserta telah masuk jadwal fasilitasi display retail.",
  });

  const completed = await start(
    state, "completion", "DEV-PRG-DAG-01", "DEV-PLUT-01",
    "9000000009303", "Sentra Elektronik Mandiri", "Servis Elektronik",
  );
  await rpc("disdagin_complete_intervention", {
    p_intervention_id: completed.interventionId,
    p_actor_id: state.actor.id,
    p_actor_opd_id: state.actor.opd_id,
    p_nib: "9000000009303",
    p_monthly_revenue: 5200000,
    p_completion_date: todayInBandung(),
    p_evaluation: "Kemitraan retail berjalan, transaksi perdana terverifikasi, dan usaha siap memasarkan produk secara mandiri.",
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

  const primaryProgramId = state.programs["DEV-PRG-DAG-01"].id;
  const displayProgramId = state.programs["DEV-PRG-DAG-QUOTA"].id;
  const primaryMentorId = state.mentors["DEV-PLUT-01"].id;
  const displayMentorId = state.mentors["DEV-PLUT-02"].id;
  await checked(await admin.from("master_program_layanan").update({
    kode_program: "PRG-DAG-01",
    nama_program: "Bandung Fashion & Craft Expo 2026",
    jenis_intervensi: "PAMERAN_DAGANG",
  }).eq("id", primaryProgramId));
  await checked(await admin.from("master_program_layanan").update({
    kode_program: "PRG-DAG-02",
    nama_program: "Fasilitasi Display Retail Store",
    jenis_intervensi: "KEMITRAAN_RETAIL",
  }).eq("id", displayProgramId));
  await checked(await admin.from("disdagin_pendamping").update({
    kode: "DAG-MITRA-01", nama: "Disdagin & Dekranasda", klaster: "Fashion & Kerajinan",
    lokasi: "Kota Bandung",
  }).eq("id", primaryMentorId));
  await checked(await admin.from("disdagin_pendamping").update({
    kode: "DAG-MITRA-02", nama: "Asosiasi Pengusaha Retail", klaster: "Retail & Kuliner",
    lokasi: "Kota Bandung",
  }).eq("id", displayMentorId));
  await checked(await admin.from("disdagin_program_details").update({
    category: "Pameran Dagang & Stand Display", consultant: "Disdagin & Dekranasda",
    location: "Hall Pameran Kota Bandung", duration_value: 3, duration_unit: "HARI",
    capacity: 20, description: "Agenda kurasi produk dan pameran dagang UMKM MBI.",
    facilitation: "Booth pameran, kurasi produk, display retail, dan temu bisnis.",
  }).eq("program_id", primaryProgramId));
  await checked(await admin.from("disdagin_program_details").update({
    category: "Display Retail", consultant: "Asosiasi Pengusaha Retail",
    location: "Supermarket dan minimarket mitra", duration_value: 4, duration_unit: "BULAN",
    capacity: 15, description: "Fasilitasi display produk dan pemantauan pemasaran retail.",
    facilitation: "Display shelf retail, kurasi kemasan, dan monitoring penjualan.",
  }).eq("program_id", displayProgramId));

  const validKeys = ["primary", "completion", "quotaA", "quotaB", "report"];
  const validReferrals = validKeys.map((key) => state.referrals[key]);
  await checked(await admin.from("referral_mbi").update({ is_fixture: false })
    .in("id", validReferrals.map((row) => row.referralId)));
  await checked(await admin.from("dinsos_cases").update({ is_fixture: false })
    .in("id", validReferrals.map((row) => row.caseId)));
  await checked(await admin.from("dinsos_assessments").update({ is_fixture: false })
    .in("id", validReferrals.map((row) => row.assessmentId)));
  await checked(await admin.from("disdagin_interventions").update({ is_fixture: false })
    .in("id", [active.interventionId, facilitated.interventionId, completed.interventionId]));
  await checked(await admin.from("disdagin_business_profiles").update({ is_fixture: false })
    .in("nib", ["9000000009301", "9000000009302", "9000000009303"]));
  await checked(await admin.from("referral_mbi").update({ target_program: "Bandung Fashion & Craft Expo 2026" })
    .in("id", [state.referrals.primary.referralId, state.referrals.completion.referralId, state.referrals.report.referralId]));
  await checked(await admin.from("referral_mbi").update({ target_program: "Fasilitasi Display Retail Store" })
    .in("id", [state.referrals.quotaA.referralId, state.referrals.quotaB.referralId]));

  await rpc("disdagin_create_program", {
    p_actor_id: state.actor.id,
    p_actor_opd_id: state.actor.opd_id,
    p_code: "PRG-DAG-03",
    p_name: "Temu Bisnis Eksportir Lokal",
    p_category: "Temu Bisnis & Ekspor",
    p_pendamping_id: primaryMentorId,
    p_duration_value: 1,
    p_duration_unit: "HARI",
    p_capacity: 10,
    p_description: "Agenda temu bisnis UMKM MBI dengan buyer, Kadin, dan jejaring ekspor lokal.",
  });

  promoted = true;
  await rm(path.join(PROJECT_ROOT, "artifacts", "disdagin", "fixture-state.json"), { force: true });
  console.log("Data demo Disdagin berhasil disiapkan dari master warga bersama.");
  console.log("Rujukan: 2 baru, 2 dalam fasilitasi, 1 selesai; agenda aktif: 3.");
} catch (error) {
  if (!promoted) {
    try {
      await cleanupDisdaginFixtures();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Seed demo Disdagin dan cleanup sama-sama gagal.");
    }
  }
  throw error;
}
