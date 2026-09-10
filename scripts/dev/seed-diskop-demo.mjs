import { createClient } from "@supabase/supabase-js";

import {
  cleanupDiskopFixtures,
  seedDiskopFixtures,
} from "./diskop-fixture-lib.mjs";
import {
  getSupabaseAdminEnvironment,
  loadProjectEnvironment,
} from "../lib/project-env.mjs";

await loadProjectEnvironment();

const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
const admin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function todayInBandung() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function rpc(name, parameters) {
  const result = await admin.rpc(name, parameters);
  if (result.error) throw result.error;
  return result.data;
}

async function markInterventionAsFixture(interventionId) {
  const result = await admin
    .from("diskop_interventions")
    .update({ is_fixture: true })
    .eq("id", interventionId);
  if (result.error) throw result.error;
}

async function startIntervention(state, referralKey, programCode, mentorCode) {
  const referral = state.referrals[referralKey];
  const result = await rpc("diskop_start_intervention", {
    p_referral_id: referral.referralId,
    p_actor_id: state.actor.id,
    p_actor_opd_id: state.actor.opd_id,
    p_program_id: state.programs[programCode].id,
    p_pendamping_id: state.mentors[mentorCode].id,
    p_start_date: todayInBandung(),
    p_stimulus: "Fasilitasi legalitas dan pengembangan usaha untuk data demo.",
    p_action_plan: "Pendampingan terukur untuk legalitas, pemasaran, dan pengelolaan usaha.",
  });
  await markInterventionAsFixture(result.interventionId);
  return result.interventionId;
}

const state = await seedDiskopFixtures();

try {
  const activeInterventionId = await startIntervention(
    state,
    "primary",
    "DEV-PRG-WIR-01",
    "DEV-PLUT-01",
  );
  await rpc("diskop_update_intervention_progress", {
    p_intervention_id: activeInterventionId,
    p_actor_id: state.actor.id,
    p_actor_opd_id: state.actor.opd_id,
    p_participant_status: "AKTIF_PENDAMPINGAN",
    p_progress_percent: 75,
    p_legal_status: "PROSES_NIB_HALAL",
    p_evaluation_note: "Peserta demo aktif mengikuti pendampingan dan sedang memproses legalitas usaha.",
  });

  await startIntervention(
    state,
    "quotaA",
    "DEV-PRG-WIR-QUOTA",
    "DEV-PLUT-02",
  );

  const completedInterventionId = await startIntervention(
    state,
    "completion",
    "DEV-PRG-WIR-01",
    "DEV-PLUT-01",
  );
  await rpc("diskop_complete_intervention", {
    p_intervention_id: completedInterventionId,
    p_actor_id: state.actor.id,
    p_actor_opd_id: state.actor.opd_id,
    p_nib: "9000000009001",
    p_monthly_revenue: 4500000,
    p_completion_date: todayInBandung(),
    p_evaluation: "Peserta demo telah menyelesaikan pendampingan dan menjalankan usaha secara mandiri.",
  });

  const validReferralIds = ["primary", "completion", "quotaA", "quotaB", "report"]
    .map((key) => state.referrals[key].referralId);
  const programIds = [
    state.programs["DEV-PRG-WIR-01"].id,
    state.programs["DEV-PRG-WIR-QUOTA"].id,
  ];
  const [referrals, interventions, outcomes, programs, programDetails] = await Promise.all([
    admin.from("referral_mbi").select("status").in("id", validReferralIds),
    admin.from("diskop_interventions").select("program_id,participant_status").in("referral_id", validReferralIds),
    admin.from("diskop_kemandirian_usaha").select("id").eq("intervention_id", completedInterventionId),
    admin.from("master_program_layanan").select("id,is_active").in("id", programIds),
    admin.from("diskop_program_details").select("program_id,capacity").in("program_id", programIds),
  ]);
  for (const result of [referrals, interventions, outcomes, programs, programDetails]) {
    if (result.error) throw result.error;
  }

  const statuses = referrals.data ?? [];
  const interventionRows = interventions.data ?? [];
  const detailsByProgram = new Map(
    (programDetails.data ?? []).map((row) => [row.program_id, Number(row.capacity)]),
  );
  const filledByProgram = new Map();
  for (const row of interventionRows) {
    if (row.participant_status === "TIDAK_AKTIF") continue;
    filledByProgram.set(row.program_id, (filledByProgram.get(row.program_id) ?? 0) + 1);
  }
  const activeProgramCount = (programs.data ?? []).filter((program) =>
    program.is_active &&
    (filledByProgram.get(program.id) ?? 0) < (detailsByProgram.get(program.id) ?? 0)
  ).length;
  const totalCapacity = [...detailsByProgram.values()].reduce((sum, capacity) => sum + capacity, 0);
  console.log("Data demo Diskop UKM berhasil disiapkan.");
  console.log(`Rujukan baru: ${statuses.filter((row) => row.status === "TERKIRIM").length}`);
  console.log(`Warga dalam pendampingan: ${statuses.filter((row) => row.status === "DIPROSES").length}`);
  console.log(`Usaha mandiri/selesai: ${statuses.filter((row) => row.status === "SELESAI").length}`);
  console.log(`Program aktif: ${activeProgramCount}`);
  console.log(`Total kuota usaha: ${totalCapacity}`);
  console.log(`Peserta MBI terdaftar: ${interventionRows.length}`);
  console.log(`Laporan usaha tersedia: ${(outcomes.data ?? []).length}`);
} catch (error) {
  console.error("Pembuatan data demo Diskop UKM gagal.");
  try {
    await cleanupDiskopFixtures();
  } catch (cleanupError) {
    throw new AggregateError(
      [error, cleanupError],
      "Pembuatan data demo Diskop UKM gagal dan pembersihan ulang juga gagal.",
    );
  }
  throw error;
}
