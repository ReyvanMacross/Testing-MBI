import { ApiError } from "@/lib/http/api-error-response";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function text(value: unknown, label: string, min: number, max: number) {
  const result = typeof value === "string" ? value.trim() : "";
  if (result.length < min || result.length > max) throw new ApiError(`${label} wajib diisi dengan benar.`, 400);
  return result;
}

function date(value: unknown, label: string) {
  const result = typeof value === "string" ? value : "";
  if (!DATE.test(result) || Number.isNaN(Date.parse(`${result}T00:00:00Z`))) throw new ApiError(`${label} tidak valid.`, 400);
  return result;
}

export function assertReferralId(value: string) {
  if (!UUID.test(value)) throw new ApiError("Referral tidak ditemukan.", 404);
  return value;
}

export function parseStartInterventionInput(body: unknown) {
  if (!body || typeof body !== "object") throw new ApiError("Data intervensi tidak valid.", 400);
  const input = body as Record<string, unknown>;
  if (typeof input.programId !== "string" || !UUID.test(input.programId)) throw new ApiError("Program vokasi wajib dipilih.", 400);
  return { programId: input.programId, institution: text(input.institution, "Lembaga pelaksana", 3, 200), startDate: date(input.startDate, "Tanggal mulai"), instruction: text(input.instruction, "Catatan instruksi", 10, 2000) };
}

export function parseCompleteInterventionInput(body: unknown) {
  if (!body || typeof body !== "object") throw new ApiError("Data penyelesaian tidak valid.", 400);
  const input = body as Record<string, unknown>;
  return { placementPartner: text(input.placementPartner, "Mitra penempatan", 3, 200), placementDate: date(input.placementDate, "Tanggal penempatan"), evaluation: text(input.evaluation, "Catatan evaluasi", 10, 2000) };
}

export function parseProgramInput(body: unknown) {
  if (!body || typeof body !== "object") throw new ApiError("Data program tidak valid.", 400);
  const input = body as Record<string, unknown>;
  const code = text(input.code, "Kode program", 10, 10).toUpperCase();
  if (!/^PRG-[A-Z]{3}-[0-9]{2}$/.test(code)) throw new ApiError("Kode program harus memakai format PRG-ABC-01.", 400);
  const duration = Number(input.duration);
  const capacity = Number(input.capacity);
  const durationUnit = typeof input.durationUnit === "string" ? input.durationUnit.toUpperCase() : "";
  if (!Number.isInteger(duration) || duration < 1 || duration > 60) throw new ApiError("Durasi program tidak valid.", 400);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) throw new ApiError("Kapasitas program tidak valid.", 400);
  if (!["HARI", "MINGGU", "BULAN"].includes(durationUnit)) throw new ApiError("Satuan durasi tidak valid.", 400);
  return {
    code, name: text(input.name, "Nama program", 5, 200), category: text(input.category, "Kategori", 2, 100),
    institution: text(input.institution, "Mitra pelaksana", 3, 200), duration, durationUnit,
    capacity, description: text(input.description, "Deskripsi program", 10, 3000),
  };
}
