import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { client } from "./dinsos-fixture-lib.mjs";
import { PROJECT_ROOT } from "../lib/project-env.mjs";

const stateFile = path.join(
  PROJECT_ROOT,
  "artifacts",
  "dinsos",
  "assessment-fixture-state.json",
);

async function readState() {
  try {
    return JSON.parse(await readFile(stateFile, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function persistState(state) {
  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(stateFile, JSON.stringify(state, null, 2));
}

export async function cleanupDinsosAssessmentFixtures() {
  const db = await client();
  const state = await readState();
  const { data: tagged, error } = await db
    .from("dinsos_assessments")
    .select("id")
    .eq("is_fixture", true)
    .like("observation", "Observasi fixture lokal untuk %");
  if (error) throw error;
  const assessmentIds = [...new Set([
    ...(tagged ?? []).map((row) => row.id),
    ...Object.values(state ?? {}).map((row) => row?.id).filter(Boolean),
  ])];
  if (assessmentIds.length > 4) {
    throw new Error(`Fixture cleanup guard: found ${assessmentIds.length} exact assessments.`);
  }
  if (assessmentIds.length) {
    const { error: deleteError } = await db
      .from("dinsos_assessments")
      .delete()
      .in("id", assessmentIds)
      .eq("is_fixture", true);
    if (deleteError) throw deleteError;
  }
  await rm(stateFile, { force: true });
  return assessmentIds.length;
}

export async function seedDinsosAssessmentFixtures() {
  const db = await client();
  await cleanupDinsosAssessmentFixtures();
  const [{ data: actor, error: actorError }, { data: warga, error: wargaError }, { data: targetOpd, error: opdError }] =
    await Promise.all([
      db.from("user_profiles").select("id").eq("email", "dinsos@bandung.go.id").single(),
      db.from("warga").select("id").order("id").limit(4),
      db.from("master_opd").select("id,kode_opd").in("kode_opd", ["DINSOS", "DISKOP", "DISNAKER"]),
    ]);
  if (actorError || wargaError || opdError || !actor || (targetOpd ?? []).length < 3 || (warga ?? []).length < 4) {
    throw actorError ?? wargaError ?? opdError ?? new Error("Fixture assessment prerequisites are missing.");
  }

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const definitions = [
    { key: "approvedWirausaha", wargaId: warga[0].id, type: "INTERVENSI_MBI", recommendation: "WIRAUSAHA", status: "DISETUJUI", decision: "APPROVED", approvedPath: "WIRAUSAHA" },
    { key: "approvedPekerja", wargaId: warga[1].id, type: "INTERVENSI_MBI", recommendation: "PEKERJA", status: "DISETUJUI", decision: "APPROVED", approvedPath: "PEKERJA" },
    { key: "needsReview", wargaId: warga[2].id, type: "KEBUTUHAN_DASAR", recommendation: null, status: "PERLU_REVIEW", decision: null, approvedPath: null },
    { key: "needsReassessment", wargaId: warga[3].id, type: "INTERVENSI_MBI", recommendation: "PENGUATAN_DASAR", status: "MINTA_REASESMEN", decision: "REQUEST_REASSESSMENT", approvedPath: null },
  ];
  const state = {};
  const targetByPath = new Map([
    ["WIRAUSAHA", targetOpd.find((item) => item.kode_opd === "DISKOP")?.id],
    ["PEKERJA", targetOpd.find((item) => item.kode_opd === "DISNAKER")?.id],
  ]);
  for (const definition of definitions) {
    const { data: assessment, error } = await db
      .from("dinsos_assessments")
      .insert({
        warga_id: definition.wargaId,
        assessment_type_code: definition.type,
        assessment_date: today,
        observation: `Observasi fixture lokal untuk ${definition.key} yang memenuhi batas validasi.`,
        field_recommendation: definition.recommendation,
        status: definition.status,
        created_by: actor.id,
        is_fixture: true,
      })
      .select("id,assessment_code,warga_id")
      .single();
    if (error) throw error;
    state[definition.key] = assessment;
    await persistState(state);
    if (definition.decision) {
      const { error: reviewError } = await db.from("dinsos_assessment_reviews").insert({
        assessment_id: assessment.id,
        decision: definition.decision,
        approved_path: definition.approvedPath,
        target_opd_id: definition.decision === "APPROVED" ? targetByPath.get(definition.approvedPath) : null,
        reviewer_note:
          definition.decision === "APPROVED"
            ? "Keputusan fixture telah diverifikasi untuk pengujian antarmuka."
            : "Mohon lakukan pengumpulan data ulang sebelum asesmen disetujui.",
        reviewed_by: actor.id,
      });
      if (reviewError) throw reviewError;
    }
  }
  await persistState(state);
  return state;
}
