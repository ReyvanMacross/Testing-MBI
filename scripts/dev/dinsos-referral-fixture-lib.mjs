import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { client, validAssessment } from "./dinsos-fixture-lib.mjs";
import { cleanupDinsosProgramFixtures, DEV_PROGRAMS, seedDinsosProgramFixtures } from "./dinsos-program-fixture-lib.mjs";
import { PROJECT_ROOT } from "../lib/project-env.mjs";

const stateFile = path.join(PROJECT_ROOT, "artifacts", "dinsos", "referral-fixture-state.json");
const STATUS_RANK = { MENUNGGU_RUJUKAN: 0, TERKIRIM: 1, DITERIMA: 2, DIPROSES: 3, SELESAI: 4 };

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

export async function cleanupDinsosReferralFixtures() {
  const db = await client();
  const state = await readState();
  const assessmentResult = await db
    .from("dinsos_assessments")
    .select("id,case_id")
    .eq("is_fixture", true)
    .like("observation", "Observasi fixture referral %");
  if (assessmentResult.error) throw assessmentResult.error;
  const taggedAssessments = assessmentResult.data ?? [];
  const caseIds = [...new Set([
    ...taggedAssessments.map((row) => row.case_id),
    ...Object.values(state ?? {}).map((row) => row?.caseId),
  ].filter(Boolean))];
  if (caseIds.length > 5) throw new Error(`Fixture cleanup guard: found ${caseIds.length} exact cases.`);
  const referralResult = caseIds.length
    ? await db.from("referral_mbi").select("id,case_id,assessment_id,path_decision_id").in("case_id", caseIds).eq("is_fixture", true)
    : { data: [], error: null };
  if (referralResult.error) throw referralResult.error;
  const referrals = referralResult.data ?? [];
  if (referrals.length > 5) throw new Error(`Fixture cleanup guard: found ${referrals.length} exact referrals.`);
  if (taggedAssessments.length > 5) throw new Error(`Fixture cleanup guard: found ${taggedAssessments.length} assessments.`);
  const assessmentIds = [...new Set([
    ...referrals.map((row) => row.assessment_id),
    ...taggedAssessments.map((row) => row.id),
    ...Object.values(state ?? {}).map((row) => row?.assessmentId),
  ].filter(Boolean))];
  const decisionIds = new Set(referrals.map((row) => row.path_decision_id).filter(Boolean));
  if (caseIds.length) {
    const linkedDecisions = await db.from("penentuan_jalur").select("id").in("case_id", caseIds);
    if (linkedDecisions.error) throw linkedDecisions.error;
    for (const row of linkedDecisions.data ?? []) decisionIds.add(row.id);
  }
  if (referrals?.length) {
    const deleted = await db.from("referral_mbi").delete().in("id", referrals.map((row) => row.id));
    if (deleted.error) throw deleted.error;
  }
  if (decisionIds.size) {
    const deleted = await db.from("penentuan_jalur").delete().in("id", [...decisionIds]);
    if (deleted.error) throw deleted.error;
  }
  if (caseIds.length) {
    const deleted = await db.from("dinsos_cases").delete().in("id", caseIds).eq("is_fixture", true);
    if (deleted.error) throw deleted.error;
  }
  if (assessmentIds.length) {
    const deleted = await db.from("dinsos_assessments").delete().in("id", assessmentIds).eq("is_fixture", true);
    if (deleted.error) throw deleted.error;
  }
  await cleanupDinsosProgramFixtures();
  await rm(stateFile, { force: true });
  return referrals?.length ?? 0;
}

export async function seedDinsosReferralFixtures() {
  const db = await client();
  await cleanupDinsosReferralFixtures();
  const programs = await seedDinsosProgramFixtures();
  const [actorResult, candidatesResult, activeResult, opdResult] = await Promise.all([
    db.from("user_profiles").select("id,opd_id").eq("email", "dinsos@bandung.go.id").single(),
    db.from("v_warga_desil_current").select("warga_id,desil_dtsen").gte("desil_dtsen", 3).order("warga_id").limit(100),
    db.from("dinsos_cases").select("warga_id").is("closed_at", null).not("current_stage", "in", "(SELESAI,DIBATALKAN)"),
    db.from("master_opd").select("id,kode_opd").in("kode_opd", ["DINSOS", "DISKOP", "DISNAKER"]),
  ]);
  for (const result of [actorResult, candidatesResult, activeResult, opdResult]) if (result.error) throw result.error;
  const active = new Set((activeResult.data ?? []).map((row) => row.warga_id));
  const candidates = (candidatesResult.data ?? []).filter((row) => !active.has(row.warga_id)).slice(0, 5);
  if (candidates.length !== 5) throw new Error("Minimal lima warga tanpa kasus aktif diperlukan.");
  const opds = new Map((opdResult.data ?? []).map((row) => [row.kode_opd, row.id]));
  const definitions = [
    { key: "waiting", status: "MENUNGGU_RUJUKAN", path: "PENGUATAN_DASAR", opd: "DINSOS", program: null },
    { key: "sent", status: "TERKIRIM", path: "WIRAUSAHA", opd: "DISKOP", program: DEV_PROGRAMS[1].code },
    { key: "received", status: "DITERIMA", path: "WIRAUSAHA", opd: "DISKOP", program: DEV_PROGRAMS[1].code },
    { key: "processing", status: "DIPROSES", path: "WIRAUSAHA", opd: "DISKOP", program: DEV_PROGRAMS[1].code },
    { key: "completed", status: "SELESAI", path: "WIRAUSAHA", opd: "DISKOP", program: DEV_PROGRAMS[1].code },
  ];
  const actor = actorResult.data;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const state = {};
  for (const [index, definition] of definitions.entries()) {
    const candidate = candidates[index];
    const base = Date.now() - (10 - index) * 60_000;
    const submittedAt = new Date(base).toISOString();
    const finalizedAt = new Date(base + 10_000).toISOString();
    const sentAt = STATUS_RANK[definition.status] >= 1 ? new Date(base + 20_000).toISOString() : null;
    const receivedAt = STATUS_RANK[definition.status] >= 2 ? new Date(base + 30_000).toISOString() : null;
    const processingAt = STATUS_RANK[definition.status] >= 3 ? new Date(base + 40_000).toISOString() : null;
    const completedAt = STATUS_RANK[definition.status] >= 4 ? new Date(base + 60_000).toISOString() : null;
    const targetOpdId = opds.get(definition.opd);
    const program = definition.program ? programs[definition.program] : null;
    const caseResult = await db.from("dinsos_cases").insert({ warga_id: candidate.warga_id, current_stage: definition.status === "MENUNGGU_RUJUKAN" ? "MENUNGGU_RUJUKAN" : "REFERRAL_TERKIRIM", priority: index === 0 ? "TINGGI" : "SEDANG", assigned_to: actor.id, is_fixture: true }).select("id").single();
    if (caseResult.error) throw caseResult.error;
    state[definition.key] = { caseId: caseResult.data.id };
    await persistState(state);
    const structured = await db.from("dinsos_asesmen_sosial").insert({ case_id: caseResult.data.id, created_by: actor.id, completed_by: actor.id, completed_at: submittedAt, desil_dtsen_snapshot: candidate.desil_dtsen, ...validAssessment }).select("id").single();
    if (structured.error) throw structured.error;
    const assessment = await db.from("dinsos_assessments").insert({ warga_id: candidate.warga_id, case_id: caseResult.data.id, assessment_type_code: "INTERVENSI_MBI", assessment_date: today, observation: `Observasi fixture referral ${definition.status}.`, field_recommendation: definition.path, status: "DISETUJUI", created_by: actor.id, submitted_at: submittedAt, is_fixture: true }).select("id,assessment_code").single();
    if (assessment.error) throw assessment.error;
    const linked = await db.from("dinsos_asesmen_sosial").update({ registry_assessment_id: assessment.data.id }).eq("id", structured.data.id);
    if (linked.error) throw linked.error;
    const review = await db.from("dinsos_assessment_reviews").insert({ assessment_id: assessment.data.id, decision: "APPROVED", approved_path: definition.path, target_opd_id: targetOpdId, reviewer_note: `Keputusan reviewer fixture ${definition.path}.`, reviewed_by: actor.id, reviewed_at: finalizedAt });
    if (review.error) throw review.error;
    const result = await db.from("dinsos_case_results").insert({ case_id: caseResult.data.id, assessment_id: structured.data.id, status: "CONFIRMED", official_desil: candidate.desil_dtsen, operational_desil: candidate.desil_dtsen, disposition: "SPLIT_JALUR", result_source: "SYSTEM", confirmed_by: actor.id, confirmed_at: submittedAt });
    if (result.error) throw result.error;
    const decision = await db.from("penentuan_jalur").insert({ warga_id: candidate.warga_id, assessment_id: assessment.data.id, case_id: caseResult.data.id, output_jalur: definition.path, approved_path_snapshot: definition.path, target_opd_id: targetOpdId, route_reason: `Keputusan fixture ${definition.path}.`, decision_source: "ASSESSMENT_REVIEW", decision_status: "FINAL", finalized_by: actor.id, finalized_at: finalizedAt }).select("id").single();
    if (decision.error) throw decision.error;
    const referral = await db.from("referral_mbi").insert({ case_id: caseResult.data.id, warga_id: candidate.warga_id, referral_type: "JALUR_MBI", source_opd_id: actor.opd_id, target_opd_id: targetOpdId, status: definition.status, sent_by: sentAt ? actor.id : null, sent_at: sentAt, assessment_id: assessment.data.id, path_decision_id: decision.data.id, jalur: definition.path, program_id: program?.id ?? null, referral_date: sentAt ? today : null, received_at: receivedAt, processing_started_at: processingAt, completed_at: completedAt, is_fixture: true }).select("id,referral_code").single();
    if (referral.error) throw referral.error;
    const events = [{ referral_id: referral.data.id, event_type: "CREATED", from_status: null, to_status: "MENUNGGU_RUJUKAN", title: "Referral jalur MBI dibuat", event_at: finalizedAt, actor_user_id: actor.id, actor_opd_id: actor.opd_id }];
    if (sentAt) events.push({ referral_id: referral.data.id, event_type: "SENT", from_status: "MENUNGGU_RUJUKAN", to_status: "TERKIRIM", title: "Rujukan dikirim ke OPD", event_at: sentAt, actor_user_id: actor.id, actor_opd_id: actor.opd_id });
    if (receivedAt) events.push({ referral_id: referral.data.id, event_type: "RECEIVED", from_status: "TERKIRIM", to_status: "DITERIMA", title: "Rujukan diterima OPD", event_at: receivedAt, actor_user_id: null, actor_opd_id: targetOpdId });
    if (processingAt) events.push({ referral_id: referral.data.id, event_type: "PROCESS_STARTED", from_status: "DITERIMA", to_status: "DIPROSES", title: "Proses intervensi dimulai", event_at: processingAt, actor_user_id: null, actor_opd_id: targetOpdId });
    if (definition.key === "processing") events.push({ referral_id: referral.data.id, event_type: "PROGRAM_PLANNED", from_status: "DIPROSES", to_status: "DIPROSES", title: program.nama_program, event_at: new Date(base + 50_000).toISOString(), target_date: today, actor_user_id: null, actor_opd_id: targetOpdId });
    if (completedAt) events.push({ referral_id: referral.data.id, event_type: "COMPLETED", from_status: "DIPROSES", to_status: "SELESAI", title: "Intervensi selesai", event_at: completedAt, actor_user_id: null, actor_opd_id: targetOpdId });
    const eventInsert = await db.from("referral_mbi_events").insert(events);
    if (eventInsert.error) throw eventInsert.error;
    state[definition.key] = { caseId: caseResult.data.id, wargaId: candidate.warga_id, assessmentId: assessment.data.id, pathDecisionId: decision.data.id, referralId: referral.data.id, referralCode: referral.data.referral_code, targetOpdId, programId: program?.id ?? null, path: definition.path, status: definition.status };
    await persistState(state);
  }
  await persistState(state);
  return state;
}
