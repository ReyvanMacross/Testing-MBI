import "server-only";

import { maskNik } from "@/lib/privacy/mask-nik";
import { createAdminClient } from "@/lib/supabase/admin";

import { getAllowedTargetOpds as loadAllowedTargetOpds } from "./path-target-policy";
import { getAllowedTargetOpdCodes } from "./path-target-policy";
import { DINSOS_PATHS } from "./path-values";
import type { DinsosPath } from "./path-values";

export type PathTargetOpd = {
  id: string;
  code: string;
  name: string;
};

export type PublishedPathReferral = {
  id: string;
  code: string;
  status: string;
  path: DinsosPath;
  targetOpdId: string;
  targetOpdName: string;
  instruction: string | null;
  sentAt: string;
  pathDecisionId: string;
  decisionSource: "ASSESSMENT_REVIEW" | "MANUAL_OVERRIDE" | "LEGACY";
};

export type CasePathContext = {
  caseId: string;
  currentStage: string;
  assessmentId: string;
  warga: {
    id: string;
    nama: string;
    maskedNik: string;
    location: string;
    locationResolved: boolean;
  };
  officialDesil: number | null;
  approvedPath: DinsosPath;
  reviewerNote: string;
  reviewerTargetOpdId: string;
  scores: {
    readiness: number | null;
    employability: number | null;
    entrepreneurship: number | null;
  };
  existingReferral: PublishedPathReferral | null;
};

function numericScore(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const score = typeof value === "number" ? value : Number(value);
  return Number.isFinite(score) ? score : null;
}

export async function getAllowedTargetOpds(path?: DinsosPath) {
  return loadAllowedTargetOpds(path);
}

export async function getPathTargetOptions() {
  const opds = await loadAllowedTargetOpds();
  return opds.map((opd) => ({
    ...opd,
    allowedPaths: DINSOS_PATHS.filter((path) =>
      getAllowedTargetOpdCodes(path).includes(opd.code),
    ),
  }));
}

export async function getPublishedReferral(
  assessmentId: string,
): Promise<PublishedPathReferral | null> {
  const admin = createAdminClient();
  const { data: referral, error } = await admin
    .from("referral_mbi")
    .select(
      "id,referral_code,status,jalur,target_opd_id,instruction,sent_at,path_decision_id",
    )
    .eq("assessment_id", assessmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Gagal mengambil referral jalur.");
  if (!referral || !referral.jalur || !referral.sent_at) return null;

  const [opdResult, decisionResult] = await Promise.all([
    admin
      .from("master_opd")
      .select("nama_opd")
      .eq("id", referral.target_opd_id)
      .maybeSingle(),
    admin
      .from("penentuan_jalur")
      .select("decision_source")
      .eq("id", referral.path_decision_id)
      .maybeSingle(),
  ]);
  if (opdResult.error || decisionResult.error) {
    throw new Error("Gagal mengambil detail referral jalur.");
  }

  return {
    id: referral.id,
    code: referral.referral_code,
    status: referral.status,
    path: referral.jalur as DinsosPath,
    targetOpdId: referral.target_opd_id,
    targetOpdName: opdResult.data?.nama_opd ?? "OPD tidak tersedia",
    instruction: referral.instruction,
    sentAt: referral.sent_at,
    pathDecisionId: referral.path_decision_id,
    decisionSource:
      (decisionResult.data?.decision_source as PublishedPathReferral["decisionSource"]) ??
      "ASSESSMENT_REVIEW",
  };
}

export async function getCasePathContext(
  caseId: string,
): Promise<CasePathContext | null> {
  const admin = createAdminClient();
  const { data: caseRow, error: caseError } = await admin
    .from("dinsos_cases")
    .select(
      "id,warga_id,current_stage,warga(id,nik,nama_lengkap,kelurahan,kecamatan,kelurahan_id,kecamatan_id)",
    )
    .eq("id", caseId)
    .maybeSingle();
  if (caseError) throw new Error("Gagal mengambil konteks Split Jalur.");
  if (!caseRow) return null;

  const warga = Array.isArray(caseRow.warga) ? caseRow.warga[0] : caseRow.warga;
  if (!warga) return null;

  const { data: assessment, error: assessmentError } = await admin
    .from("dinsos_assessments")
    .select("id")
    .eq("case_id", caseId)
    .eq("status", "DISETUJUI")
    .order("submitted_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (assessmentError) throw new Error("Gagal mengambil asesmen yang disetujui.");
  if (!assessment) return null;

  const [reviewResult, desilResult, decisionResult, locationResult, referral] =
    await Promise.all([
      admin
        .from("dinsos_assessment_reviews")
        .select("approved_path,target_opd_id,reviewer_note,decision")
        .eq("assessment_id", assessment.id)
        .maybeSingle(),
      admin
        .from("penetapan_desil")
        .select("desil_dtsen")
        .eq("warga_id", caseRow.warga_id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("penentuan_jalur")
        .select(
          "readiness_score,employability_score,entrepreneurship_score",
        )
        .eq("assessment_id", assessment.id)
        .maybeSingle(),
      warga.kelurahan_id
        ? admin
            .from("master_wilayah")
            .select("nama")
            .eq("id", warga.kelurahan_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      getPublishedReferral(assessment.id),
    ]);

  if (
    reviewResult.error ||
    desilResult.error ||
    decisionResult.error ||
    locationResult.error
  ) {
    throw new Error("Gagal mengambil analisis Split Jalur.");
  }

  const review = reviewResult.data;
  if (
    !review ||
    review.decision !== "APPROVED" ||
    !review.approved_path ||
    !review.target_opd_id
  ) {
    return null;
  }

  return {
    caseId,
    currentStage: caseRow.current_stage,
    assessmentId: assessment.id,
    warga: {
      id: warga.id,
      nama: warga.nama_lengkap,
      maskedNik: maskNik(warga.nik),
      location:
        locationResult.data?.nama ?? warga.kelurahan ?? warga.kecamatan ?? "—",
      locationResolved: Boolean(warga.kelurahan_id && warga.kecamatan_id),
    },
    officialDesil: numericScore(desilResult.data?.desil_dtsen),
    approvedPath: review.approved_path as DinsosPath,
    reviewerNote: review.reviewer_note,
    reviewerTargetOpdId: review.target_opd_id,
    scores: {
      readiness: numericScore(decisionResult.data?.readiness_score),
      employability: numericScore(decisionResult.data?.employability_score),
      entrepreneurship: numericScore(
        decisionResult.data?.entrepreneurship_score,
      ),
    },
    existingReferral: referral,
  };
}

export async function getAssessmentPathContext(assessmentId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("dinsos_assessments")
    .select("case_id")
    .eq("id", assessmentId)
    .maybeSingle();
  if (error) throw new Error("Gagal mengambil konteks asesmen.");
  if (!data?.case_id) return null;
  const context = await getCasePathContext(data.case_id);
  return context?.assessmentId === assessmentId ? context : null;
}
