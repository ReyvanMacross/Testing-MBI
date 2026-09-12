import { ApiError } from "@/lib/http/api-error-response";

export function mapKelurahanError(error: { code?: string; message?: string }, fallback: string) {
  const message = error.message ?? "";
  if (error.code === "42501" || /ACTOR_REQUIRED|OUTSIDE_KELURAHAN|OUTSIDE_JURISDICTION/u.test(message)) {
    return new ApiError("Akses wilayah Kelurahan ditolak.", 403);
  }
  if (error.code === "P0002" || /NOT_FOUND/u.test(message)) return new ApiError("Data tidak ditemukan.", 404);
  if (error.code === "40001" || /VERSION_CONFLICT/u.test(message)) {
    return new ApiError("Data sudah berubah. Muat ulang halaman sebelum melanjutkan.", 409);
  }
  if (error.code === "23505" || /ACTIVE_|INVALID_.*TRANSITION/u.test(message)) {
    return new ApiError("Tahap pekerjaan sudah berubah atau usulan aktif sudah ada.", 409);
  }
  if (error.code === "23514" || /INVALID_|REQUIRED/u.test(message)) {
    return new ApiError("Data yang dikirim belum lengkap atau tidak valid.", 400);
  }
  return new ApiError(fallback, 500);
}
