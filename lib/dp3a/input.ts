import { ApiError } from "@/lib/http/api-error-response";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
function text(value: unknown, label: string, min: number, max: number) { const result = typeof value === "string" ? value.trim() : ""; if (result.length < min || result.length > max) throw new ApiError(`${label} wajib diisi dengan benar.`, 400); return result; }
function date(value: unknown, label: string) { const result = typeof value === "string" ? value : ""; if (!DATE.test(result) || Number.isNaN(Date.parse(`${result}T00:00:00Z`))) throw new ApiError(`${label} tidak valid.`, 400); return result; }
function uuid(value: unknown, message: string) { if (typeof value !== "string" || !UUID.test(value)) throw new ApiError(message, 400); return value; }
function money(value: unknown, label: string) { const result = Number(value); if (!Number.isSafeInteger(result) || result < 0 || result > 1_000_000_000_000) throw new ApiError(`${label} tidak valid.`, 400); return result; }
export function assertReferralId(value: string) { if (!UUID.test(value)) throw new ApiError("Rujukan tidak ditemukan.", 404); return value; }
export function assertCaseId(value: string) { if (!UUID.test(value)) throw new ApiError("Kasus tidak ditemukan.", 404); return value; }

export function parseStartCaseInput(body: unknown) {
  if (!body || typeof body !== "object") throw new ApiError("Data penanganan tidak valid.", 400);
  const input = body as Record<string, unknown>;
  return { programId: uuid(input.programId, "Program layanan wajib dipilih."), unitId: uuid(input.unitId, "Unit pelaksana wajib dipilih."), startDate: date(input.startDate, "Jadwal pendampingan"), caseType: text(input.caseType, "Jenis kasus", 2, 100), supportItem: text(input.supportItem, "Jenis layanan", 3, 500), actionPlan: text(input.actionPlan, "Rencana penanganan", 10, 2000) };
}
export function parseProgressInput(body: unknown) {
  if (!body || typeof body !== "object") throw new ApiError("Data progress tidak valid.", 400);
  const input = body as Record<string, unknown>; const progressPercent = Number(input.progressPercent); const verificationStatus = typeof input.verificationStatus === "string" ? input.verificationStatus : "";
  if (!Number.isInteger(progressPercent) || progressPercent < 1 || progressPercent > 99) throw new ApiError("Progress aktif harus 1 sampai 99 persen.", 400);
  if (!["MENUNGGU", "LULUS", "DITOLAK"].includes(verificationStatus)) throw new ApiError("Status verifikasi kasus tidak valid.", 400);
  return { progressPercent, verificationStatus, realizedAmount: money(input.realizedAmount, "Realisasi layanan"), evaluation: text(input.evaluation, "Catatan progress", 10, 2000) };
}
export function parseCompleteCaseInput(body: unknown) {
  if (!body || typeof body !== "object") throw new ApiError("Data penyelesaian tidak valid.", 400);
  const input = body as Record<string, unknown>;
  return { realizedAmount: money(input.realizedAmount, "Realisasi layanan"), completionDate: date(input.completionDate, "Tanggal penutupan kasus"), supportItem: text(input.supportItem, "Layanan atau bantuan", 3, 500), evaluation: text(input.evaluation, "Evaluasi akhir", 10, 2000) };
}
export function parseProgramInput(body: unknown) {
  if (!body || typeof body !== "object") throw new ApiError("Data program tidak valid.", 400);
  const input = body as Record<string, unknown>; const code = text(input.code, "Kode program", 10, 10).toUpperCase(); const duration = Number(input.duration); const capacity = Number(input.capacity); const durationUnit = typeof input.durationUnit === "string" ? input.durationUnit.toUpperCase() : "";
  if (!/^PRG-PPA-[0-9]{2}$/.test(code)) throw new ApiError("Kode program harus memakai format PRG-PPA-01.", 400);
  if (!Number.isInteger(duration) || duration < 1 || duration > 60) throw new ApiError("Durasi program tidak valid.", 400);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) throw new ApiError("Kuota program tidak valid.", 400);
  if (!["HARI", "MINGGU", "BULAN"].includes(durationUnit)) throw new ApiError("Satuan durasi tidak valid.", 400);
  return { code, name: text(input.name, "Nama program", 5, 200), category: text(input.category, "Kategori target", 2, 100), serviceType: text(input.serviceType, "Jenis layanan", 3, 200), unitId: uuid(input.unitId, "Unit pelaksana wajib dipilih."), duration, durationUnit, executionDate: date(input.executionDate, "Tanggal pelaksanaan"), budgetPerBeneficiary: money(input.budgetPerBeneficiary, "Pagu per warga"), capacity, description: text(input.description, "Deskripsi dan kriteria", 10, 3000) };
}
