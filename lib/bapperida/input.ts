import { ApiError } from "@/lib/http/api-error-response";

export const recommendationCategories = [
  "CAPAIAN_JALUR", "SEBARAN_WILAYAH", "RE_ENTRY", "INTEGRASI_DATA", "ANGGARAN", "OUTCOME",
] as const;

export type RecommendationCategory = (typeof recommendationCategories)[number];

type RecommendationBody = {
  recommendationId?: unknown;
  expectedVersion?: unknown;
  category?: unknown;
  finding?: unknown;
  recommendation?: unknown;
  recipientOpdIds?: unknown;
  submit?: unknown;
};

function text(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) {
    throw new ApiError(`${label} tidak valid.`, 400);
  }
  return value.trim();
}

export function parseRecommendationInput(body: RecommendationBody) {
  if (typeof body.category !== "string" || !recommendationCategories.includes(body.category as RecommendationCategory)) {
    throw new ApiError("Kategori rekomendasi tidak valid.", 400);
  }
  if (!Array.isArray(body.recipientOpdIds) || body.recipientOpdIds.length === 0 || body.recipientOpdIds.some((id) => typeof id !== "string" || id.length < 30)) {
    throw new ApiError("Pilih minimal satu penerima rekomendasi.", 400);
  }
  const expectedVersion = body.expectedVersion == null ? null : Number(body.expectedVersion);
  if (expectedVersion !== null && (!Number.isInteger(expectedVersion) || expectedVersion < 1)) {
    throw new ApiError("Versi rekomendasi tidak valid.", 400);
  }
  return {
    recommendationId: typeof body.recommendationId === "string" && body.recommendationId ? body.recommendationId : null,
    expectedVersion,
    category: body.category as RecommendationCategory,
    finding: text(body.finding, "Temuan", 10, 3000),
    recommendation: text(body.recommendation, "Rekomendasi", 10, 3000),
    recipientOpdIds: [...new Set(body.recipientOpdIds as string[])],
    submit: body.submit === true,
  };
}
