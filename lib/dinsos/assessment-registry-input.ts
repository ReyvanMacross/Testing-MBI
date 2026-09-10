import { ApiError } from "@/lib/http/api-error-response";

import {
  DINSOS_PATHS,
  type DinsosPath,
} from "./path-values";

export const ASSESSMENT_PATHS = DINSOS_PATHS;
export type AssessmentPath = DinsosPath;

export const ASSESSMENT_STATUSES = [
  "DRAFT",
  "PERLU_REVIEW",
  "DISETUJUI",
  "MINTA_REASESMEN",
  "DIBATALKAN",
] as const;
export type AssessmentRegistryStatus = (typeof ASSESSMENT_STATUSES)[number];

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("Data asesmen tidak valid.", 400);
  }
  return value as Record<string, unknown>;
}

function assertOnlyKeys(source: Record<string, unknown>, allowed: string[]) {
  const invalid = Object.keys(source).find((key) => !allowed.includes(key));
  if (invalid) throw new ApiError("Data asesmen tidak valid.", 400);
}

function requiredString(value: unknown, minimum: number, maximum: number) {
  if (typeof value !== "string") {
    throw new ApiError("Data asesmen tidak valid.", 400);
  }
  const result = value.trim();
  if (result.length < minimum || result.length > maximum) {
    throw new ApiError("Data asesmen tidak valid.", 400);
  }
  return result;
}

function optionalUuid(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new ApiError("Referensi re-asesmen tidak valid.", 400);
  }
  return value;
}

function todayInJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function assessmentDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError("Tanggal asesmen tidak valid.", 400);
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day ||
    value > todayInJakarta()
  ) {
    throw new ApiError("Tanggal asesmen tidak boleh di masa depan.", 400);
  }
  return value;
}

export function assertAssessmentId(value: string) {
  if (!UUID.test(value)) throw new ApiError("Asesmen tidak ditemukan.", 404);
  return value;
}

export function parseCreateAssessmentInput(body: unknown) {
  const source = assertObject(body);
  assertOnlyKeys(source, [
    "wargaId",
    "assessmentTypeCode",
    "assessmentDate",
    "observation",
    "recommendation",
    "reassessmentOf",
  ]);

  const wargaId = requiredString(source.wargaId, 36, 36);
  if (!UUID.test(wargaId)) throw new ApiError("Warga tidak ditemukan.", 404);
  const typeCode = requiredString(source.assessmentTypeCode, 2, 100);
  const observation = requiredString(source.observation, 20, 5000);
  const recommendation =
    source.recommendation == null || source.recommendation === ""
      ? null
      : requiredString(source.recommendation, 2, 100);
  if (
    recommendation &&
    !ASSESSMENT_PATHS.includes(recommendation as AssessmentPath)
  ) {
    throw new ApiError("Rekomendasi jalur tidak valid.", 400);
  }

  return {
    wargaId,
    assessmentTypeCode: typeCode,
    assessmentDate: assessmentDate(source.assessmentDate),
    observation,
    recommendation: recommendation as AssessmentPath | null,
    reassessmentOf: optionalUuid(source.reassessmentOf),
  };
}

export function parseAssessmentReviewInput(body: unknown) {
  const source = assertObject(body);
  assertOnlyKeys(source, ["decision", "path", "targetOpdId", "note"]);
  const decision = requiredString(source.decision, 2, 50);
  const noteMinimum = decision === "REQUEST_REASSESSMENT" ? 20 : 10;
  const note = requiredString(source.note, noteMinimum, 2000);

  if (decision === "APPROVED") {
    const path = requiredString(source.path, 2, 100);
    const targetOpdId = requiredString(source.targetOpdId, 36, 36);
    if (
      !ASSESSMENT_PATHS.includes(path as AssessmentPath) ||
      !UUID.test(targetOpdId)
    ) {
      throw new ApiError("Keputusan review tidak valid.", 400);
    }
    return {
      decision: "APPROVED" as const,
      path: path as AssessmentPath,
      targetOpdId,
      note,
    };
  }

  if (decision !== "REQUEST_REASSESSMENT") {
    throw new ApiError("Keputusan review tidak valid.", 400);
  }
  if (source.path != null || source.targetOpdId != null) {
    throw new ApiError("Keputusan review tidak valid.", 400);
  }
  return {
    decision: "REQUEST_REASSESSMENT" as const,
    path: null,
    targetOpdId: null,
    note,
  };
}
