import { ApiError } from "@/lib/http/api-error-response";

export function mapKecamatanError(error: { message?: string } | null, fallback: string) {
  const message = error?.message ?? "";
  if (message.includes("NOT_FOUND")) return new ApiError("Data Kecamatan tidak ditemukan.", 404);
  if (message.includes("ACTOR_REQUIRED") || message.includes("OUTSIDE_JURISDICTION")) return new ApiError("Data berada di luar wilayah penugasan Anda.", 403);
  if (message.includes("ACTIVE_PROPOSAL_EXISTS")) return new ApiError("Warga masih memiliki usulan aktif.", 409);
  if (message.includes("INVALID_PROPOSAL_TRANSITION") || message.includes("INVALID_SURVEY_TRANSITION")) return new ApiError("Tahap workflow sudah berubah. Muat ulang halaman.", 409);
  if (message.includes("APPROVED_SURVEY_REQUIRED")) return new ApiError("Hasil survei harus disetujui sebelum dirujuk.", 409);
  if (message.includes("PROGRAM_MISMATCH")) return new ApiError("Program tujuan tidak sama dengan hasil persetujuan.", 409);
  if (message.includes("INVALID_")) return new ApiError("Data yang dikirim belum lengkap atau tidak valid.", 400);
  return new ApiError(fallback, 400);
}
