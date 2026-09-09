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

export function assertInterventionId(value: string) {
  if (!UUID.test(value)) throw new ApiError("Intervensi tidak ditemukan.", 404);
  return value;
}

export function parseStartInterventionInput(body: unknown) {
  if (!body || typeof body !== "object") throw new ApiError("Data intervensi tidak valid.", 400);
  const input = body as Record<string, unknown>;
  if (typeof input.programId !== "string" || !UUID.test(input.programId)) throw new ApiError("Program vokasi wajib dipilih.", 400);
  if (typeof input.lembagaId !== "string" || !UUID.test(input.lembagaId)) throw new ApiError("Lembaga pelaksana wajib dipilih.", 400);
  return { programId: input.programId, lembagaId: input.lembagaId, startDate: date(input.startDate, "Tanggal mulai"), instruction: text(input.instruction, "Catatan instruksi", 10, 2000) };
}

export function parseCompleteInterventionInput(body: unknown) {
  if (!body || typeof body !== "object") throw new ApiError("Data penyelesaian tidak valid.", 400);
  const input = body as Record<string, unknown>;
  if (typeof input.mitraIndustriId !== "string" || !UUID.test(input.mitraIndustriId)) throw new ApiError("Mitra industri wajib dipilih.", 400);
  return { mitraIndustriId: input.mitraIndustriId, placementDate: date(input.placementDate, "Tanggal penempatan"), evaluation: text(input.evaluation, "Catatan evaluasi", 10, 2000) };
}

export function parseProgressInput(body: unknown) {
  if (!body || typeof body !== "object") throw new ApiError("Data progress tidak valid.", 400);
  const input = body as Record<string, unknown>;
  const statusPeserta = typeof input.statusPeserta === "string" ? input.statusPeserta : "";
  const kehadiranPersen = Number(input.kehadiranPersen);
  if (!["AKTIF_PELATIHAN", "LULUS_MAGANG", "TIDAK_AKTIF"].includes(statusPeserta)) throw new ApiError("Status peserta tidak valid.", 400);
  if (!Number.isInteger(kehadiranPersen) || kehadiranPersen < 0 || kehadiranPersen > 100) throw new ApiError("Persentase kehadiran harus 0 sampai 100.", 400);
  return { statusPeserta, kehadiranPersen, evaluasiInstruktur: text(input.evaluasiInstruktur, "Evaluasi instruktur", 10, 2000) };
}

export function parseProgramInput(body: unknown) {
  if (!body || typeof body !== "object") throw new ApiError("Data program tidak valid.", 400);
  const input = body as Record<string, unknown>;
  const code = text(input.code, "Kode program", 10, 10).toUpperCase();
  if (typeof input.lembagaId !== "string" || !UUID.test(input.lembagaId)) throw new ApiError("Mitra pelaksana wajib dipilih.", 400);
  if (!/^PRG-[A-Z]{3}-[0-9]{2}$/.test(code)) throw new ApiError("Kode program harus memakai format PRG-ABC-01.", 400);
  const duration = Number(input.duration);
  const capacity = Number(input.capacity);
  const durationUnit = typeof input.durationUnit === "string" ? input.durationUnit.toUpperCase() : "";
  if (!Number.isInteger(duration) || duration < 1 || duration > 60) throw new ApiError("Durasi program tidak valid.", 400);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) throw new ApiError("Kapasitas program tidak valid.", 400);
  if (!["HARI", "MINGGU", "BULAN"].includes(durationUnit)) throw new ApiError("Satuan durasi tidak valid.", 400);
  return {
    code, name: text(input.name, "Nama program", 5, 200), category: text(input.category, "Kategori", 2, 100),
    lembagaId: input.lembagaId, duration, durationUnit,
    capacity, description: text(input.description, "Deskripsi program", 10, 3000),
  };
}
