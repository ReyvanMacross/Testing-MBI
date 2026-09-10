import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { validAssessment } from "./dinsos-fixture-lib.mjs";
import { getSupabaseAdminEnvironment, loadProjectEnvironment, PROJECT_ROOT } from "../lib/project-env.mjs";

export const DEV_DISDIK_CODES = {
  schools: ["DEV-SCH-EDU-01", "DEV-SCH-EDU-QUOTA"],
  programs: [
    "DEV-PRG-EDU-01",
    "DEV-PRG-EDU-QUOTA",
    "DEV-PRG-DINSOS-EDU-WRONG",
    "DEV-PRG-EDU-PATH-WRONG",
  ],
};

const stateFile = path.join(PROJECT_ROOT, "artifacts", "disdik", "fixture-state.json");

async function persistState(state) {
  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(stateFile, JSON.stringify(state, null, 2));
}

async function savedState() {
  try {
    return JSON.parse(await readFile(stateFile, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function client() {
  await loadProjectEnvironment();
  const { supabaseUrl, supabaseSecretKey } = getSupabaseAdminEnvironment();
  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function cleanupDisdikFixtures() {
  const db = await client();
  const saved = await savedState();
  const programResult = await db.from("master_program_layanan")
    .select("id").in("kode_program", DEV_DISDIK_CODES.programs);
  if (programResult.error) throw programResult.error;
  const programIds = [...new Set([
    ...(programResult.data ?? []).map((row) => row.id),
    ...Object.values(saved?.programs ?? {}).map((row) => row.id).filter(Boolean),
  ])];
  const referralResult = programIds.length
    ? await db.from("referral_mbi").select("id,case_id,assessment_id,path_decision_id")
      .in("program_id", programIds).eq("is_fixture", true)
    : { data: [], error: null };
  if (referralResult.error) throw referralResult.error;
  const referrals = referralResult.data ?? [];
  if (referrals.length > 12) throw new Error(`Fixture cleanup guard: ${referrals.length} referral ditemukan.`);
  const savedReferrals = Object.values(saved?.referrals ?? {});
  const referralIds = [...new Set([
    ...referrals.map((row) => row.id),
    ...savedReferrals.map((row) => row.referralId).filter(Boolean),
  ])];
  if (referralIds.length > 12) throw new Error(`Fixture cleanup guard: ${referralIds.length} exact referral ID ditemukan.`);
  const caseIds = [...new Set([...referrals.map((row) => row.case_id), ...savedReferrals.map((row) => row.caseId)].filter(Boolean))];
  const assessmentIds = [...new Set([...referrals.map((row) => row.assessment_id), ...savedReferrals.map((row) => row.assessmentId)].filter(Boolean))];
  const decisionIds = [...new Set([...referrals.map((row) => row.path_decision_id), ...savedReferrals.map((row) => row.pathDecisionId)].filter(Boolean))];

  if (referralIds.length) {
    const result = await db.from("referral_mbi").delete().in("id", referralIds).eq("is_fixture", true);
    if (result.error) throw result.error;
  }
  if (decisionIds.length) {
    const result = await db.from("penentuan_jalur").delete().in("id", decisionIds);
    if (result.error) throw result.error;
  }
  if (caseIds.length) {
    const result = await db.from("dinsos_cases").delete().in("id", caseIds).eq("is_fixture", true);
    if (result.error) throw result.error;
  }
  if (assessmentIds.length) {
    const result = await db.from("dinsos_assessments").delete().in("id", assessmentIds).eq("is_fixture", true);
    if (result.error) throw result.error;
  }
  if (programIds.length) {
    const result = await db.from("master_program_layanan").delete().in("id", programIds);
    if (result.error) throw result.error;
  }
  const schoolResult = await db.from("disdik_sekolah").delete().in("kode", DEV_DISDIK_CODES.schools);
  if (schoolResult.error) throw schoolResult.error;

  const [remainingPrograms, remainingSchools, remainingInterventions] = await Promise.all([
    db.from("master_program_layanan").select("id", { count: "exact", head: true }).in("kode_program", DEV_DISDIK_CODES.programs),
    db.from("disdik_sekolah").select("id", { count: "exact", head: true }).in("kode", DEV_DISDIK_CODES.schools),
    db.from("disdik_interventions").select("id", { count: "exact", head: true }).eq("is_fixture", true),
  ]);
  for (const result of [remainingPrograms, remainingSchools, remainingInterventions]) {
    if (result.error) throw result.error;
    if (result.count !== 0) throw new Error(`Fixture cleanup gagal; ${result.count} row masih tersisa.`);
  }
  await rm(stateFile, { force: true });
  return { referrals: referralIds.length, programs: programIds.length, remaining: { programs: 0, schools: 0, interventions: 0, realizations: 0 } };
}

export async function seedDisdikFixtures() {
  await cleanupDisdikFixtures();
  try {
    const db = await client();
    const [dinsosActorResult, disdikActorResult, opdResult, activeResult, candidateResult] = await Promise.all([
      db.from("user_profiles").select("id,opd_id").eq("email", "dinsos@bandung.go.id").single(),
      db.from("user_profiles").select("id,opd_id").eq("username", "admin.disdik").single(),
      db.from("master_opd").select("id,kode_opd").in("kode_opd", ["DINSOS", "DISDIK"]),
      db.from("dinsos_cases").select("warga_id").is("closed_at", null).not("current_stage", "in", "(SELESAI,DIBATALKAN)"),
      db.from("v_warga_desil_current").select("warga_id,desil_dtsen").gte("desil_dtsen", 1).order("warga_id").limit(100),
    ]);
    for (const result of [dinsosActorResult, disdikActorResult, opdResult, activeResult, candidateResult]) if (result.error) throw result.error;
    const dinsosActor = dinsosActorResult.data;
    const disdikActor = disdikActorResult.data;
    const opds = new Map(opdResult.data.map((row) => [row.kode_opd, row.id]));
    const activeWarga = new Set((activeResult.data ?? []).map((row) => row.warga_id));
    const candidates = (candidateResult.data ?? []).filter((row) => !activeWarga.has(row.warga_id)).slice(0, 6);
    if (candidates.length !== 6) throw new Error("Enam warga existing tanpa kasus aktif diperlukan untuk fixture Disdik.");

    const state = { schools: {}, programs: {}, referrals: {}, interventions: {}, actor: disdikActor };
    const schoolInsert = await db.from("disdik_sekolah").insert([
      { kode: "DEV-SCH-EDU-01", nama: "Sekolah Pengujian Disdik", jenjang: "LINTAS_JENJANG", kelurahan: "Lokasi internal", alamat: "Lokasi pengujian internal" },
      { kode: "DEV-SCH-EDU-QUOTA", nama: "Sekolah Kuota Pengujian Disdik", jenjang: "SMP", kelurahan: "Lokasi internal", alamat: "Lokasi pengujian internal" },
    ]).select("id,kode,nama");
    if (schoolInsert.error) throw schoolInsert.error;
    const schools = new Map(schoolInsert.data.map((row) => [row.kode, row]));
    state.schools = Object.fromEntries(schools);
    await persistState(state);

    const programDefinitions = [
      { code: "DEV-PRG-EDU-01", name: "Bantuan Pendidikan Development", opd: "DISDIK", path: "PENGUATAN_DASAR", school: "DEV-SCH-EDU-01", capacity: 20 },
      { code: "DEV-PRG-EDU-QUOTA", name: "Bantuan Kuota Development", opd: "DISDIK", path: "PENGUATAN_DASAR", school: "DEV-SCH-EDU-QUOTA", capacity: 1 },
      { code: "DEV-PRG-DINSOS-EDU-WRONG", name: "Program Salah OPD Development", opd: "DINSOS", path: "PENGUATAN_DASAR", school: null, capacity: 1 },
      { code: "DEV-PRG-EDU-PATH-WRONG", name: "Program Salah Jalur Development", opd: "DISDIK", path: "PEKERJA", school: null, capacity: 1 },
    ];
    const programs = {};
    for (const definition of programDefinitions) {
      const insert = await db.from("master_program_layanan").insert({
        kode_program: definition.code, nama_program: definition.name, opd_id: opds.get(definition.opd),
        jalur: definition.path, jenis_intervensi: "FIXTURE", is_active: true,
      }).select("id,kode_program,nama_program").single();
      if (insert.error) throw insert.error;
      programs[definition.code] = insert.data;
      state.programs = programs;
      await persistState(state);
      if (definition.school) {
        const school = schools.get(definition.school);
        const detail = await db.from("disdik_program_details").insert({
          program_id: insert.data.id, jenjang_target: "SD dan SMP", jenis_bantuan: "Bantuan pendidikan terkontrol",
          sekolah_id: school.id, duration_value: 1, duration_unit: "BULAN", execution_date: new Date().toISOString().slice(0, 10),
          budget_per_student: 2500000, capacity: definition.capacity,
          description: "Program terkontrol untuk pengujian workflow Disdik.",
        });
        if (detail.error) throw detail.error;
      }
    }

    const definitions = [
      { key: "primary", program: "DEV-PRG-EDU-01", target: "DISDIK", path: "PENGUATAN_DASAR" },
      { key: "completion", program: "DEV-PRG-EDU-01", target: "DISDIK", path: "PENGUATAN_DASAR" },
      { key: "quotaA", program: "DEV-PRG-EDU-QUOTA", target: "DISDIK", path: "PENGUATAN_DASAR" },
      { key: "quotaB", program: "DEV-PRG-EDU-QUOTA", target: "DISDIK", path: "PENGUATAN_DASAR" },
      { key: "report", program: "DEV-PRG-EDU-01", target: "DISDIK", path: "PENGUATAN_DASAR" },
      { key: "wrongTarget", program: "DEV-PRG-DINSOS-EDU-WRONG", target: "DINSOS", path: "PENGUATAN_DASAR" },
    ];
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    for (const [index, definition] of definitions.entries()) {
      const candidate = candidates[index];
      const targetOpdId = opds.get(definition.target);
      const program = programs[definition.program];
      const createdAt = new Date(Date.now() - (definitions.length - index) * 60_000).toISOString();
      const caseResult = await db.from("dinsos_cases").insert({ warga_id: candidate.warga_id, current_stage: "REFERRAL_TERKIRIM", priority: "SEDANG", assigned_to: dinsosActor.id, is_fixture: true }).select("id").single();
      if (caseResult.error) throw caseResult.error;
      state.referrals[definition.key] = { caseId: caseResult.data.id };
      await persistState(state);
      const structured = await db.from("dinsos_asesmen_sosial").insert({ case_id: caseResult.data.id, created_by: dinsosActor.id, completed_by: dinsosActor.id, completed_at: createdAt, desil_dtsen_snapshot: candidate.desil_dtsen, ...validAssessment }).select("id").single();
      if (structured.error) throw structured.error;
      const assessment = await db.from("dinsos_assessments").insert({ warga_id: candidate.warga_id, case_id: caseResult.data.id, assessment_type_code: "INTERVENSI_MBI", assessment_date: today, observation: "Observasi fixture workflow Disdik.", field_recommendation: definition.path, status: "DISETUJUI", created_by: dinsosActor.id, submitted_at: createdAt, is_fixture: true }).select("id").single();
      if (assessment.error) throw assessment.error;
      state.referrals[definition.key].assessmentId = assessment.data.id;
      await persistState(state);
      const link = await db.from("dinsos_asesmen_sosial").update({ registry_assessment_id: assessment.data.id }).eq("id", structured.data.id);
      if (link.error) throw link.error;
      const review = await db.from("dinsos_assessment_reviews").insert({ assessment_id: assessment.data.id, decision: "APPROVED", approved_path: definition.path, target_opd_id: targetOpdId, reviewer_note: "Keputusan fixture workflow Disdik.", reviewed_by: dinsosActor.id, reviewed_at: createdAt });
      if (review.error) throw review.error;
      const result = await db.from("dinsos_case_results").insert({ case_id: caseResult.data.id, assessment_id: structured.data.id, status: "CONFIRMED", official_desil: candidate.desil_dtsen, operational_desil: candidate.desil_dtsen, disposition: "SPLIT_JALUR", result_source: "SYSTEM", confirmed_by: dinsosActor.id, confirmed_at: createdAt });
      if (result.error) throw result.error;
      const pathResult = await db.from("penentuan_jalur").insert({ warga_id: candidate.warga_id, assessment_id: assessment.data.id, case_id: caseResult.data.id, output_jalur: definition.path, approved_path_snapshot: definition.path, target_opd_id: targetOpdId, route_reason: "Keputusan fixture workflow Disdik.", decision_source: "ASSESSMENT_REVIEW", decision_status: "FINAL", finalized_by: dinsosActor.id, finalized_at: createdAt }).select("id").single();
      if (pathResult.error) throw pathResult.error;
      state.referrals[definition.key].pathDecisionId = pathResult.data.id;
      await persistState(state);
      const referral = await db.from("referral_mbi").insert({ case_id: caseResult.data.id, warga_id: candidate.warga_id, referral_type: "JALUR_MBI", source_opd_id: dinsosActor.opd_id, target_opd_id: targetOpdId, target_program: program.nama_program, status: "TERKIRIM", sent_by: dinsosActor.id, sent_at: createdAt, referral_date: today, assessment_id: assessment.data.id, path_decision_id: pathResult.data.id, jalur: definition.path, program_id: program.id, instruction: "Instruksi fixture tanpa data pribadi.", is_fixture: true }).select("id,referral_code").single();
      if (referral.error) throw referral.error;
      const events = await db.from("referral_mbi_events").insert([
        { referral_id: referral.data.id, event_type: "CREATED", to_status: "MENUNGGU_RUJUKAN", title: "Referral dibuat", event_at: createdAt, actor_user_id: dinsosActor.id, actor_opd_id: dinsosActor.opd_id },
        { referral_id: referral.data.id, event_type: "SENT", from_status: "MENUNGGU_RUJUKAN", to_status: "TERKIRIM", title: "Referral dikirim", event_at: createdAt, actor_user_id: dinsosActor.id, actor_opd_id: dinsosActor.opd_id },
      ]);
      if (events.error) throw events.error;
      state.referrals[definition.key] = { referralId: referral.data.id, referralCode: referral.data.referral_code, caseId: caseResult.data.id, assessmentId: assessment.data.id, pathDecisionId: pathResult.data.id, programId: program.id, targetOpdId, path: definition.path };
      await persistState(state);
    }
    return state;
  } catch (error) {
    try {
      await cleanupDisdikFixtures();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Seed fixture Disdik gagal dan cleanup juga gagal.");
    }
    throw error;
  }
}
