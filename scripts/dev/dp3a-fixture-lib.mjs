import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { validAssessment } from "./dinsos-fixture-lib.mjs";
import { getSupabaseAdminEnvironment, loadProjectEnvironment, PROJECT_ROOT } from "../lib/project-env.mjs";

export const DEV_DP3A_CODES = {
  units: ["DEV-UNIT-PPA-01", "DEV-UNIT-PPA-QUOTA"],
  programs: [
    "DEV-PRG-PPA-01",
    "DEV-PRG-PPA-QUOTA",
    "DEV-PRG-DINSOS-PPA-WRONG",
    "DEV-PRG-PPA-PATH-WRONG",
  ],
};

const SOURCE_ACTOR_USERNAME = "dp3a.source.fixture";
const FIXTURE_WARGA_PATTERN = "Warga Fixture DP3A %";

const DEMO_DP3A_PROGRAM_PATTERN = "DEMO-DP3A-%";
const DEMO_DP3A_UNIT_PATTERN = "DEMO-UNIT-DP3A-%";

const stateFile = path.join(PROJECT_ROOT, "artifacts", "dp3a", "fixture-state.json");

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

export async function cleanupDP3AFixtures() {
  const db = await client();
  const saved = await savedState();
  const programResult = await db.from("master_program_layanan")
    .select("id").in("kode_program", DEV_DP3A_CODES.programs);
  if (programResult.error) throw programResult.error;
  const demoProgramResult = await db.from("master_program_layanan")
    .select("id").like("kode_program", DEMO_DP3A_PROGRAM_PATTERN);
  if (demoProgramResult.error) throw demoProgramResult.error;
  const programIds = [...new Set([
    ...(programResult.data ?? []).map((row) => row.id),
    ...(demoProgramResult.data ?? []).map((row) => row.id),
    ...Object.values(saved?.programs ?? {}).map((row) => row.id).filter(Boolean),
  ])];
  if (programIds.length > 30) throw new Error(`Fixture cleanup guard: ${programIds.length} program ditemukan.`);
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
  const unitResult = await db.from("dp3a_unit_layanan").delete().in("kode", DEV_DP3A_CODES.units);
  if (unitResult.error) throw unitResult.error;
  const demoUnitResult = await db.from("dp3a_unit_layanan").delete().like("kode", DEMO_DP3A_UNIT_PATTERN);
  if (demoUnitResult.error) throw demoUnitResult.error;
  const sourceActorResult = await db.from("user_profiles").select("id").eq("username", SOURCE_ACTOR_USERNAME);
  if (sourceActorResult.error) throw sourceActorResult.error;
  const sourceActorIds = [...new Set([
    saved?.sourceActorProfileId,
    ...(sourceActorResult.data ?? []).map((row) => row.id),
  ].filter(Boolean))];
  if (sourceActorIds.length > 1) throw new Error("Fixture cleanup guard: aktor sumber DP3A tidak unik.");
  if (sourceActorIds.length) {
    const result = await db.from("user_profiles").delete().in("id", sourceActorIds).eq("username", SOURCE_ACTOR_USERNAME);
    if (result.error) throw result.error;
  }
  const fixtureWargaResult = await db.from("warga").select("id").like("nama_lengkap", FIXTURE_WARGA_PATTERN);
  if (fixtureWargaResult.error) throw fixtureWargaResult.error;
  const fixtureWargaIds = [...new Set([
    ...(saved?.wargaIds ?? []),
    ...(fixtureWargaResult.data ?? []).map((row) => row.id),
  ])];
  if (fixtureWargaIds.length > 6) throw new Error(`Fixture cleanup guard: ${fixtureWargaIds.length} warga ditemukan.`);
  if (fixtureWargaIds.length) {
    const result = await db.from("warga").delete().in("id", fixtureWargaIds).like("nama_lengkap", FIXTURE_WARGA_PATTERN);
    if (result.error) throw result.error;
  }

  const [remainingPrograms, remainingDemoPrograms, remainingUnits, remainingDemoUnits, remainingCases] = await Promise.all([
    db.from("master_program_layanan").select("id", { count: "exact", head: true }).in("kode_program", DEV_DP3A_CODES.programs),
    db.from("master_program_layanan").select("id", { count: "exact", head: true }).like("kode_program", DEMO_DP3A_PROGRAM_PATTERN),
    db.from("dp3a_unit_layanan").select("id", { count: "exact", head: true }).in("kode", DEV_DP3A_CODES.units),
    db.from("dp3a_unit_layanan").select("id", { count: "exact", head: true }).like("kode", DEMO_DP3A_UNIT_PATTERN),
    db.from("dp3a_cases").select("id", { count: "exact", head: true }).eq("is_fixture", true),
  ]);
  for (const result of [remainingPrograms, remainingDemoPrograms, remainingUnits, remainingDemoUnits, remainingCases]) {
    if (result.error) throw result.error;
    if (result.count !== 0) throw new Error(`Fixture cleanup gagal; ${result.count} row masih tersisa.`);
  }
  await rm(stateFile, { force: true });
  return { referrals: referralIds.length, programs: programIds.length, remaining: { programs: 0, units: 0, cases: 0, realizations: 0 } };
}

export async function seedDP3AFixtures() {
  await cleanupDP3AFixtures();
  try {
    const db = await client();
    const [dinsosActorResult, dp3aActorResult, opdResult] = await Promise.all([
      db.from("user_profiles").select("id,opd_id").eq("email", "dinsos@bandung.go.id").maybeSingle(),
      db.from("user_profiles").select("id,opd_id").eq("username", "admin.dp3a").single(),
      db.from("master_opd").select("id,kode_opd").in("kode_opd", ["DINSOS", "DP3A"]),
    ]);
    for (const result of [dinsosActorResult, dp3aActorResult, opdResult]) if (result.error) throw result.error;
    let dinsosActor = dinsosActorResult.data;
    const dp3aActor = dp3aActorResult.data;
    const opds = new Map(opdResult.data.map((row) => [row.kode_opd, row.id]));

    const state = { units: {}, programs: {}, referrals: {}, cases: {}, actor: dp3aActor, wargaIds: [] };
    if (!dinsosActor) {
      const sourceActor = await db.from("user_profiles").insert({
        email: ["dp3a.source.fixture", "staging.invalid"].join("@"),
        nama_lengkap: "Aktor Sumber Fixture DP3A",
        username: SOURCE_ACTOR_USERNAME,
        role: "INTERVENSI",
        opd_id: opds.get("DINSOS"),
        instansi: "Fixture pengujian DP3A",
        status: "AKTIF",
      }).select("id,opd_id").single();
      if (sourceActor.error) throw sourceActor.error;
      dinsosActor = sourceActor.data;
      state.sourceActorProfileId = dinsosActor.id;
      await persistState(state);
    }
    const wargaInsert = await db.from("warga").insert(Array.from({ length: 6 }, (_, index) => ({
      nik: ["3273", "90", String(index + 1).padStart(10, "0")].join(""),
      nama_lengkap: `Warga Fixture DP3A ${index + 1}`,
      kelurahan: index % 2 === 0 ? "Sukajadi" : "Pasteur",
      kecamatan: "Sukajadi",
    }))).select("id");
    if (wargaInsert.error) throw wargaInsert.error;
    state.wargaIds = wargaInsert.data.map((row) => row.id);
    await persistState(state);
    const desilInsert = await db.from("penetapan_desil").insert(state.wargaIds.map((wargaId, index) => ({
      warga_id: wargaId,
      desil_dtsen: (index % 2) + 1,
      status_dtsen: "TERDAFTAR",
      tingkat_kerentanan: "TINGGI",
      prioritas_intervensi: "PRIORITAS",
    })));
    if (desilInsert.error) throw desilInsert.error;
    const candidates = state.wargaIds.map((wargaId, index) => ({ warga_id: wargaId, desil_dtsen: (index % 2) + 1 }));
    const unitInsert = await db.from("dp3a_unit_layanan").insert([
      { kode: "DEV-UNIT-PPA-01", nama: "UPTD PPA Pengujian DP3A", kategori: "TERPADU", kelurahan: "Lokasi internal", alamat: "Lokasi pengujian internal" },
      { kode: "DEV-UNIT-PPA-QUOTA", nama: "Unit Kuota Pengujian DP3A", kategori: "HUKUM", kelurahan: "Lokasi internal", alamat: "Lokasi pengujian internal" },
    ]).select("id,kode,nama");
    if (unitInsert.error) throw unitInsert.error;
    const units = new Map(unitInsert.data.map((row) => [row.kode, row]));
    state.units = Object.fromEntries(units);
    await persistState(state);

    const programDefinitions = [
      { code: "DEV-PRG-PPA-01", name: "Pendampingan Terpadu Development", opd: "DP3A", path: "PENGUATAN_DASAR", unit: "DEV-UNIT-PPA-01", capacity: 20 },
      { code: "DEV-PRG-PPA-QUOTA", name: "Pendampingan Kuota Development", opd: "DP3A", path: "PENGUATAN_DASAR", unit: "DEV-UNIT-PPA-QUOTA", capacity: 1 },
      { code: "DEV-PRG-DINSOS-PPA-WRONG", name: "Program Salah OPD Development", opd: "DINSOS", path: "PENGUATAN_DASAR", unit: null, capacity: 1 },
      { code: "DEV-PRG-PPA-PATH-WRONG", name: "Program Salah Jalur Development", opd: "DP3A", path: "PEKERJA", unit: null, capacity: 1 },
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
      if (definition.unit) {
        const unit = units.get(definition.unit);
        const detail = await db.from("dp3a_program_details").insert({
          program_id: insert.data.id, kategori_target: "Perlindungan Terpadu", jenis_layanan: "Pendampingan hukum dan psikososial terkontrol",
          unit_id: unit.id, duration_value: 1, duration_unit: "BULAN", execution_date: new Date().toISOString().slice(0, 10),
          budget_per_beneficiary: 2500000, capacity: definition.capacity,
          description: "Program terkontrol untuk pengujian workflow DP3A.",
        });
        if (detail.error) throw detail.error;
      }
    }

    const definitions = [
      { key: "primary", program: "DEV-PRG-PPA-01", target: "DP3A", path: "PENGUATAN_DASAR" },
      { key: "completion", program: "DEV-PRG-PPA-01", target: "DP3A", path: "PENGUATAN_DASAR" },
      { key: "quotaA", program: "DEV-PRG-PPA-QUOTA", target: "DP3A", path: "PENGUATAN_DASAR" },
      { key: "quotaB", program: "DEV-PRG-PPA-QUOTA", target: "DP3A", path: "PENGUATAN_DASAR" },
      { key: "report", program: "DEV-PRG-PPA-01", target: "DP3A", path: "PENGUATAN_DASAR" },
      { key: "wrongTarget", program: "DEV-PRG-DINSOS-PPA-WRONG", target: "DINSOS", path: "PENGUATAN_DASAR" },
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
      const assessment = await db.from("dinsos_assessments").insert({ warga_id: candidate.warga_id, case_id: caseResult.data.id, assessment_type_code: "INTERVENSI_MBI", assessment_date: today, observation: "Observasi fixture workflow DP3A.", field_recommendation: definition.path, status: "DISETUJUI", created_by: dinsosActor.id, submitted_at: createdAt, is_fixture: true }).select("id").single();
      if (assessment.error) throw assessment.error;
      state.referrals[definition.key].assessmentId = assessment.data.id;
      await persistState(state);
      const link = await db.from("dinsos_asesmen_sosial").update({ registry_assessment_id: assessment.data.id }).eq("id", structured.data.id);
      if (link.error) throw link.error;
      const review = await db.from("dinsos_assessment_reviews").insert({ assessment_id: assessment.data.id, decision: "APPROVED", approved_path: definition.path, target_opd_id: targetOpdId, reviewer_note: "Keputusan fixture workflow DP3A.", reviewed_by: dinsosActor.id, reviewed_at: createdAt });
      if (review.error) throw review.error;
      const result = await db.from("dinsos_case_results").insert({ case_id: caseResult.data.id, assessment_id: structured.data.id, status: "CONFIRMED", official_desil: candidate.desil_dtsen, operational_desil: candidate.desil_dtsen, disposition: "SPLIT_JALUR", result_source: "SYSTEM", confirmed_by: dinsosActor.id, confirmed_at: createdAt });
      if (result.error) throw result.error;
      const pathResult = await db.from("penentuan_jalur").insert({ warga_id: candidate.warga_id, assessment_id: assessment.data.id, case_id: caseResult.data.id, output_jalur: definition.path, approved_path_snapshot: definition.path, target_opd_id: targetOpdId, route_reason: "Keputusan fixture workflow DP3A.", decision_source: "ASSESSMENT_REVIEW", decision_status: "FINAL", finalized_by: dinsosActor.id, finalized_at: createdAt }).select("id").single();
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
      await cleanupDP3AFixtures();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Seed fixture DP3A gagal dan cleanup juga gagal.");
    }
    throw error;
  }
}
