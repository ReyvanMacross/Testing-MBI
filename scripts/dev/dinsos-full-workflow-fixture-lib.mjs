import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { client } from "./dinsos-fixture-lib.mjs";
import { DEV_PROGRAMS } from "./dinsos-program-fixture-lib.mjs";
import { PROJECT_ROOT } from "../lib/project-env.mjs";

const stateFile = path.join(
  PROJECT_ROOT,
  "artifacts",
  "dinsos",
  "full-workflow-fixture-state.json",
);

async function readState() {
  try {
    return JSON.parse(await readFile(stateFile, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function selectFixtureRelations(db, caseIds) {
  if (!caseIds.length) return { assessmentIds: [], decisionIds: [], referralIds: [] };
  const [assessmentResult, decisionResult, referralResult] = await Promise.all([
    db.from("dinsos_assessments").select("id").in("case_id", caseIds),
    db.from("penentuan_jalur").select("id").in("case_id", caseIds),
    db.from("referral_mbi").select("id").in("case_id", caseIds),
  ]);
  for (const result of [assessmentResult, decisionResult, referralResult]) {
    if (result.error) throw result.error;
  }
  return {
    assessmentIds: (assessmentResult.data ?? []).map((row) => row.id),
    decisionIds: (decisionResult.data ?? []).map((row) => row.id),
    referralIds: (referralResult.data ?? []).map((row) => row.id),
  };
}

export async function cleanupDinsosFullWorkflowFixture() {
  const state = await readState();
  if (!state) return 0;
  const db = await client();
  const caseIds = [state.high?.caseId, state.low?.caseId].filter(Boolean);
  if (caseIds.length > 2) throw new Error("Fixture cleanup guard: terlalu banyak case ID.");

  const relations = await selectFixtureRelations(db, caseIds);
  if (relations.referralIds.length) {
    const result = await db.from("referral_mbi").delete().in("id", relations.referralIds);
    if (result.error) throw result.error;
  }
  if (relations.decisionIds.length) {
    const result = await db.from("penentuan_jalur").delete().in("id", relations.decisionIds);
    if (result.error) throw result.error;
  }
  if (caseIds.length) {
    const result = await db.from("dinsos_cases").delete().in("id", caseIds).eq("is_fixture", true);
    if (result.error) throw result.error;
  }
  if (relations.assessmentIds.length) {
    const result = await db
      .from("dinsos_assessments")
      .delete()
      .in("id", relations.assessmentIds)
      .eq("is_fixture", true);
    if (result.error) throw result.error;
  }
  if (state.programId) {
    const usage = await db
      .from("referral_mbi")
      .select("id", { count: "exact", head: true })
      .eq("program_id", state.programId);
    if (usage.error) throw usage.error;
    if ((usage.count ?? 0) !== 0) {
      throw new Error("Program fixture masih digunakan referral dan tidak dapat dibersihkan.");
    }
    const result = await db
      .from("master_program_layanan")
      .delete()
      .eq("id", state.programId)
      .eq("kode_program", "DEV-DISKOP-MODAL-UMKM");
    if (result.error) throw result.error;
  }
  await rm(stateFile, { force: true });
  return caseIds.length;
}

export async function seedDinsosFullWorkflowFixture() {
  await cleanupDinsosFullWorkflowFixture();
  const db = await client();
  const [actorResult, activeResult, highResult, lowResult, opdResult] = await Promise.all([
    db.from("user_profiles").select("id,opd_id").eq("email", "dinsos@bandung.go.id").single(),
    db.from("dinsos_cases").select("warga_id").is("closed_at", null).not("current_stage", "in", "(SELESAI,DIBATALKAN)"),
    db.from("v_warga_desil_current").select("warga_id,desil_dtsen").gte("desil_dtsen", 3).order("warga_id").limit(100),
    db.from("v_warga_desil_current").select("warga_id,desil_dtsen").in("desil_dtsen", [1, 2]).order("warga_id").limit(100),
    db.from("master_opd").select("id,kode_opd").in("kode_opd", ["DINSOS", "DISKOP"]),
  ]);
  for (const result of [actorResult, activeResult, highResult, lowResult, opdResult]) {
    if (result.error) throw result.error;
  }
  const actor = actorResult.data;
  if (!actor) throw new Error("Admin Dinsos belum tersedia.");
  const active = new Set((activeResult.data ?? []).map((row) => row.warga_id));
  const high = (highResult.data ?? []).find((row) => !active.has(row.warga_id));
  const low = (lowResult.data ?? []).find((row) => !active.has(row.warga_id) && row.warga_id !== high?.warga_id);
  if (!high || !low) throw new Error("Warga existing untuk fixture high/low readiness tidak tersedia.");
  const opds = new Map((opdResult.data ?? []).map((row) => [row.kode_opd, row.id]));
  if (!opds.get("DINSOS") || !opds.get("DISKOP")) throw new Error("Master OPD Dinsos/Diskop belum lengkap.");

  const programDefinition = DEV_PROGRAMS.find((item) => item.code === "DEV-DISKOP-MODAL-UMKM");
  const programResult = await db
    .from("master_program_layanan")
    .upsert({
      kode_program: programDefinition.code,
      nama_program: programDefinition.name,
      opd_id: opds.get("DISKOP"),
      jalur: programDefinition.path,
      jenis_intervensi: programDefinition.type,
      is_active: true,
    }, { onConflict: "kode_program" })
    .select("id")
    .single();
  if (programResult.error) throw programResult.error;

  const caseRows = [];
  for (const [priority, candidate] of [["TINGGI", high], ["SEDANG", low]]) {
    const result = await db.from("dinsos_cases").insert({
      warga_id: candidate.warga_id,
      current_stage: "MENUNGGU_ASESMEN",
      priority,
      assigned_to: actor.id,
      is_fixture: true,
    }).select("id,warga_id").single();
    if (result.error) throw result.error;
    caseRows.push(result.data);
  }

  const wargaResult = await db
    .from("warga")
    .select("id,nama_lengkap")
    .in("id", [high.warga_id, low.warga_id]);
  if (wargaResult.error) throw wargaResult.error;
  const names = new Map((wargaResult.data ?? []).map((row) => [row.id, row.nama_lengkap]));
  const state = {
    high: {
      caseId: caseRows[0].id,
      wargaId: high.warga_id,
      citizenName: names.get(high.warga_id),
      desil: high.desil_dtsen,
    },
    low: {
      caseId: caseRows[1].id,
      wargaId: low.warga_id,
      citizenName: names.get(low.warga_id),
      desil: low.desil_dtsen,
    },
    programId: programResult.data.id,
    targetOpdId: opds.get("DISKOP"),
  };
  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(stateFile, JSON.stringify(state, null, 2));
  return state;
}
