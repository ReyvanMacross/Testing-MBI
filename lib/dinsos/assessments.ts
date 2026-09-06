import "server-only";

import { maskNik } from "@/lib/privacy/mask-nik";
import { createAdminClient } from "@/lib/supabase/admin";

import type {
  AssessmentPath,
  AssessmentRegistryStatus,
} from "./assessment-registry-input";

export const DINSOS_ASSESSMENTS_PAGE_SIZE = 3;

export type AssessmentFilters = {
  search?: string;
  type?: string;
  path?: AssessmentPath;
  status?: AssessmentRegistryStatus;
  page?: number;
};

export type AssessmentListItem = {
  assessmentId: string;
  assessmentCode: string;
  assessmentDate: string;
  wargaId: string;
  maskedNik: string;
  namaLengkap: string;
  kelurahan: string | null;
  locationResolved: boolean;
  desil: number | null;
  assessmentTypeCode: string;
  assessmentTypeLabel: string;
  fieldRecommendation: AssessmentPath | null;
  approvedPath: AssessmentPath | null;
  status: AssessmentRegistryStatus;
  createdByName: string;
  createdByRole: string;
};

export type AssessmentDetail = AssessmentListItem & {
  observation: string | null;
  reassessmentOfId: string | null;
  submittedAt: string;
  review: null | {
    decision: "APPROVED" | "REQUEST_REASSESSMENT";
    approvedPath: AssessmentPath | null;
    targetOpd: string | null;
    targetUnit: string | null;
    note: string;
    reviewerName: string;
    reviewerRole: string;
    reviewedAt: string;
  };
};

type RawListRow = Record<string, unknown>;

function mapListRow(row: RawListRow): AssessmentListItem {
  return {
    assessmentId: String(row.assessment_id),
    assessmentCode: String(row.assessment_code),
    assessmentDate: String(row.assessment_date),
    wargaId: String(row.warga_id),
    maskedNik: maskNik(typeof row.nik === "string" ? row.nik : null),
    namaLengkap: String(row.nama_lengkap),
    kelurahan: typeof row.kelurahan === "string" ? row.kelurahan : null,
    locationResolved: Boolean(row.location_resolved),
    desil: typeof row.desil === "number" ? row.desil : null,
    assessmentTypeCode: String(row.assessment_type_code),
    assessmentTypeLabel: String(row.assessment_type_label),
    fieldRecommendation:
      typeof row.field_recommendation === "string"
        ? (row.field_recommendation as AssessmentPath)
        : null,
    approvedPath:
      typeof row.approved_path === "string"
        ? (row.approved_path as AssessmentPath)
        : null,
    status: String(row.status) as AssessmentRegistryStatus,
    createdByName: String(row.created_by_name),
    createdByRole: String(row.created_by_role),
  };
}

export async function getAssessmentSummary() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("dinsos_assessment_summary");
  if (error) throw new Error("Gagal mengambil ringkasan asesmen sosial.");
  const summary = (data ?? {}) as Record<string, unknown>;
  return {
    totalThisYear: Number(summary.totalThisYear ?? 0),
    needsReview: Number(summary.needsReview ?? 0),
    reconciledToPath: Number(summary.reconciledToPath ?? 0),
  };
}

export async function getAssessments(filters: AssessmentFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("list_dinsos_assessments", {
    p_search: filters.search || null,
    p_type: filters.type || null,
    p_path: filters.path || null,
    p_status: filters.status || null,
    p_limit: DINSOS_ASSESSMENTS_PAGE_SIZE,
    p_offset: (page - 1) * DINSOS_ASSESSMENTS_PAGE_SIZE,
  });
  if (error) throw new Error("Gagal mengambil daftar asesmen sosial.");
  const rows = (data ?? []) as RawListRow[];
  const total = Number(rows[0]?.total_count ?? 0);
  return {
    assessments: rows.map(mapListRow),
    page,
    pageSize: DINSOS_ASSESSMENTS_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / DINSOS_ASSESSMENTS_PAGE_SIZE)),
  };
}

export async function getAssessmentTypes() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("dinsos_assessment_types")
    .select("code,name,list_label,requires_recommendation")
    .eq("is_active", true)
    .order("list_label");
  if (error) throw new Error("Gagal mengambil jenis asesmen.");
  return (data ?? []).map((row) => ({
    code: row.code,
    name: row.name,
    listLabel: row.list_label,
    requiresRecommendation: row.requires_recommendation,
  }));
}

export async function getAssessmentFilterOptions() {
  const admin = createAdminClient();
  const [types, opdResult] = await Promise.all([
    getAssessmentTypes(),
    admin.from("master_opd").select("id,kode_opd,nama_opd").order("nama_opd"),
  ]);
  if (opdResult.error) throw new Error("Gagal mengambil pilihan OPD.");
  return {
    types,
    opds: (opdResult.data ?? []).map((row) => ({
      id: row.id,
      code: row.kode_opd,
      name: row.nama_opd,
    })),
  };
}

export async function getAssessmentById(
  assessmentId: string,
): Promise<AssessmentDetail | null> {
  const admin = createAdminClient();
  const { data: assessment, error } = await admin
    .from("dinsos_assessments")
    .select(
      "id,assessment_code,assessment_date,warga_id,assessment_type_code,observation,field_recommendation,status,reassessment_of_id,created_by,submitted_at",
    )
    .eq("id", assessmentId)
    .maybeSingle();
  if (error) throw new Error("Gagal mengambil detail asesmen.");
  if (!assessment) return null;

  const [wargaResult, typeResult, creatorResult, desilResult, reviewResult] =
    await Promise.all([
      admin
        .from("warga")
        .select("id,nik,nama_lengkap,kelurahan,kelurahan_id,kecamatan_id")
        .eq("id", assessment.warga_id)
        .single(),
      admin
        .from("dinsos_assessment_types")
        .select("list_label")
        .eq("code", assessment.assessment_type_code)
        .single(),
      admin
        .from("user_profiles")
        .select("nama_lengkap,role")
        .eq("id", assessment.created_by)
        .single(),
      admin
        .from("penetapan_desil")
        .select("desil_dtsen")
        .eq("warga_id", assessment.warga_id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("dinsos_assessment_reviews")
        .select(
          "decision,approved_path,target_opd_id,target_unit,reviewer_note,reviewed_by,reviewed_at",
        )
        .eq("assessment_id", assessment.id)
        .maybeSingle(),
    ]);
  if (
    wargaResult.error ||
    typeResult.error ||
    creatorResult.error ||
    desilResult.error ||
    reviewResult.error
  ) {
    throw new Error("Gagal mengambil detail asesmen.");
  }

  const [kelurahanResult, reviewerResult, targetOpdResult] = await Promise.all([
    wargaResult.data.kelurahan_id
      ? admin
          .from("master_wilayah")
          .select("nama")
          .eq("id", wargaResult.data.kelurahan_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    reviewResult.data?.reviewed_by
      ? admin
          .from("user_profiles")
          .select("nama_lengkap,role")
          .eq("id", reviewResult.data.reviewed_by)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    reviewResult.data?.target_opd_id
      ? admin
          .from("master_opd")
          .select("nama_opd")
          .eq("id", reviewResult.data.target_opd_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (kelurahanResult.error || reviewerResult.error || targetOpdResult.error) {
    throw new Error("Gagal mengambil detail asesmen.");
  }

  const row = mapListRow({
    assessment_id: assessment.id,
    assessment_code: assessment.assessment_code,
    assessment_date: assessment.assessment_date,
    warga_id: wargaResult.data.id,
    nik: wargaResult.data.nik,
    nama_lengkap: wargaResult.data.nama_lengkap,
    kelurahan: kelurahanResult.data?.nama ?? wargaResult.data.kelurahan,
    location_resolved: Boolean(
      wargaResult.data.kelurahan_id && wargaResult.data.kecamatan_id,
    ),
    desil: desilResult.data?.desil_dtsen ?? null,
    assessment_type_code: assessment.assessment_type_code,
    assessment_type_label: typeResult.data.list_label,
    field_recommendation: assessment.field_recommendation,
    approved_path: reviewResult.data?.approved_path ?? null,
    status: assessment.status,
    created_by_name: creatorResult.data.nama_lengkap,
    created_by_role: creatorResult.data.role,
  });

  return {
    ...row,
    observation: assessment.observation,
    reassessmentOfId: assessment.reassessment_of_id,
    submittedAt: assessment.submitted_at,
    review: reviewResult.data
      ? {
          decision: reviewResult.data.decision,
          approvedPath: reviewResult.data.approved_path,
          targetOpd: targetOpdResult.data?.nama_opd ?? null,
          targetUnit: reviewResult.data.target_unit,
          note: reviewResult.data.reviewer_note,
          reviewerName: reviewerResult.data?.nama_lengkap ?? "—",
          reviewerRole: reviewerResult.data?.role ?? "—",
          reviewedAt: reviewResult.data.reviewed_at,
        }
      : null,
  } as AssessmentDetail;
}
