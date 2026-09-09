import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { client, validAssessment } from "./dinsos-fixture-lib.mjs";
import { PROJECT_ROOT } from "../lib/project-env.mjs";

const stateFile = path.join(
  PROJECT_ROOT,
  "artifacts",
  "dinsos",
  "path-fixture-state.json",
);

const TARGET_CODES = {
  PEKERJA: "DISNAKER",
  WIRAUSAHA: "DISKOP",
  PENGUATAN_DASAR: "DINSOS",
};

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

export async function cleanupDinsosPathFixtures() {
  const db = await client();
  const state = await readState();
  const taggedAssessments = await db
    .from("dinsos_assessments")
    .select("id,case_id")
    .eq("is_fixture", true)
    .like("observation", "Observasi fixture Split Jalur %");
  if (taggedAssessments.error) throw taggedAssessments.error;
  const caseIds = [...new Set([
    ...(taggedAssessments.data ?? []).map((row) => row.case_id),
    ...Object.values(state ?? {}).map((row) => row?.caseId).filter(Boolean),
  ].filter(Boolean))];
  if (caseIds.length > 3) {
    throw new Error(`Fixture cleanup guard: found ${caseIds.length} exact case IDs.`);
  }

  if (caseIds.length) {
    const { data: decisions, error: decisionReadError } = await db
      .from("penentuan_jalur")
      .select("id,assessment_id")
      .in("case_id", caseIds);
    if (decisionReadError) throw decisionReadError;

    const assessmentIds = (decisions ?? [])
      .map((item) => item.assessment_id)
      .filter(Boolean);
    const decisionIds = (decisions ?? []).map((item) => item.id);

    if (decisionIds.length) {
      const { error: overrideError } = await db
        .from("dinsos_path_overrides")
        .delete()
        .in("path_decision_id", decisionIds);
      if (overrideError) throw overrideError;
    }

    const { error: referralError } = await db
      .from("referral_mbi")
      .delete()
      .in("case_id", caseIds);
    if (referralError) throw referralError;

    const { error: decisionError } = await db
      .from("penentuan_jalur")
      .delete()
      .in("case_id", caseIds);
    if (decisionError) throw decisionError;

    const { error: caseError } = await db
      .from("dinsos_cases")
      .delete()
      .in("id", caseIds);
    if (caseError) throw caseError;

    if (assessmentIds.length) {
      const { error: assessmentError } = await db
        .from("dinsos_assessments")
        .delete()
        .in("id", assessmentIds);
      if (assessmentError) throw assessmentError;
    }
  }

  await rm(stateFile, { force: true });
  return caseIds.length;
}

export async function seedDinsosPathFixtures() {
  const db = await client();
  await cleanupDinsosPathFixtures();

  const [actorResult, candidatesResult, activeResult, opdResult] =
    await Promise.all([
      db
        .from("user_profiles")
        .select("id")
        .eq("email", "dinsos@bandung.go.id")
        .single(),
      db
        .from("v_warga_desil_current")
        .select("warga_id,desil_dtsen")
        .gte("desil_dtsen", 3)
        .order("warga_id")
        .limit(100),
      db
        .from("dinsos_cases")
        .select("warga_id")
        .is("closed_at", null)
        .not("current_stage", "in", "(SELESAI,DIBATALKAN)"),
      db
        .from("master_opd")
        .select("id,kode_opd")
        .in("kode_opd", Object.values(TARGET_CODES)),
    ]);
  for (const result of [actorResult, candidatesResult, activeResult, opdResult]) {
    if (result.error) throw result.error;
  }
  if (!actorResult.data) throw new Error("Admin Dinsos belum tersedia.");

  const active = new Set((activeResult.data ?? []).map((row) => row.warga_id));
  const candidates = (candidatesResult.data ?? [])
    .filter((row) => !active.has(row.warga_id))
    .slice(0, 3);
  if (candidates.length !== 3) {
    throw new Error("Minimal tiga warga tanpa kasus aktif diperlukan.");
  }

  const opds = new Map((opdResult.data ?? []).map((opd) => [opd.kode_opd, opd.id]));
  for (const code of Object.values(TARGET_CODES)) {
    if (!opds.has(code)) throw new Error(`Master OPD ${code} tidak tersedia.`);
  }

  const definitions = [
    {
      key: "wirausaha",
      path: "WIRAUSAHA",
      targetCode: TARGET_CODES.WIRAUSAHA,
      scores: {
        readiness_score: 85,
        employability_score: 70,
        entrepreneurship_score: 90,
      },
    },
    {
      key: "pekerja",
      path: "PEKERJA",
      targetCode: TARGET_CODES.PEKERJA,
      scores: {},
    },
    {
      key: "penguatanDasar",
      path: "PENGUATAN_DASAR",
      targetCode: TARGET_CODES.PENGUATAN_DASAR,
      scores: {},
    },
  ];
  const actorId = actorResult.data.id;
  const now = new Date().toISOString();
  const assessmentDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const state = {};

  for (const [index, definition] of definitions.entries()) {
    const candidate = candidates[index];
    const { data: caseRow, error: caseError } = await db
      .from("dinsos_cases")
      .insert({
        warga_id: candidate.warga_id,
        current_stage: "MENUNGGU_SPLIT_JALUR",
        priority: index === 0 ? "TINGGI" : "SEDANG",
        assigned_to: actorId,
        is_fixture: true,
      })
      .select("id")
      .single();
    if (caseError) throw caseError;

    state[definition.key] = {
      caseId: caseRow.id,
      wargaId: candidate.warga_id,
      officialDesil: candidate.desil_dtsen,
      approvedPath: definition.path,
      targetOpdId: opds.get(definition.targetCode),
    };
    await persistState(state);

    const { data: structured, error: structuredError } = await db
      .from("dinsos_asesmen_sosial")
      .insert({
        case_id: caseRow.id,
        created_by: actorId,
        completed_by: actorId,
        completed_at: now,
        desil_dtsen_snapshot: candidate.desil_dtsen,
        ...validAssessment,
      })
      .select("id")
      .single();
    if (structuredError) throw structuredError;

    const { data: registry, error: registryError } = await db
      .from("dinsos_assessments")
      .insert({
        warga_id: candidate.warga_id,
        case_id: caseRow.id,
        assessment_type_code: "INTERVENSI_MBI",
        assessment_date: assessmentDate,
        observation: `Observasi fixture Split Jalur ${definition.path}.`,
        field_recommendation: definition.path,
        status: "DISETUJUI",
        created_by: actorId,
        is_fixture: true,
      })
      .select("id,assessment_code")
      .single();
    if (registryError) throw registryError;

    const { error: linkError } = await db
      .from("dinsos_asesmen_sosial")
      .update({ registry_assessment_id: registry.id })
      .eq("id", structured.id);
    if (linkError) throw linkError;

    const targetOpdId = opds.get(definition.targetCode);
    const { error: reviewError } = await db
      .from("dinsos_assessment_reviews")
      .insert({
        assessment_id: registry.id,
        decision: "APPROVED",
        approved_path: definition.path,
        target_opd_id: targetOpdId,
        reviewer_note: `Jalur ${definition.path} disetujui untuk fixture pengujian Split Jalur.`,
        reviewed_by: actorId,
      });
    if (reviewError) throw reviewError;

    const { error: resultError } = await db.from("dinsos_case_results").insert({
      case_id: caseRow.id,
      assessment_id: structured.id,
      status: "CONFIRMED",
      official_desil: candidate.desil_dtsen,
      operational_desil: candidate.desil_dtsen,
      disposition: "SPLIT_JALUR",
      result_source: "SYSTEM",
      confirmed_by: actorId,
      confirmed_at: now,
    });
    if (resultError) throw resultError;

    const { data: decision, error: decisionError } = await db
      .from("penentuan_jalur")
      .insert({
        warga_id: candidate.warga_id,
        assessment_id: registry.id,
        case_id: caseRow.id,
        output_jalur: definition.path,
        approved_path_snapshot: definition.path,
        target_opd_id: targetOpdId,
        route_reason: `Keputusan fixture ${definition.path}.`,
        decision_source: "ASSESSMENT_REVIEW",
        decision_status: "DRAFT",
        ...definition.scores,
      })
      .select("id")
      .single();
    if (decisionError) throw decisionError;

    state[definition.key] = {
      caseId: caseRow.id,
      wargaId: candidate.warga_id,
      officialDesil: candidate.desil_dtsen,
      structuredAssessmentId: structured.id,
      assessmentId: registry.id,
      assessmentCode: registry.assessment_code,
      pathDecisionId: decision.id,
      approvedPath: definition.path,
      targetOpdId,
    };
    await persistState(state);
  }

  await persistState(state);
  return state;
}
