import { ApiError } from "@/lib/http/api-error-response";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const NIB = /^\d{13}$/;

function text(value: unknown, label: string, min: number, max: number) {
  const result = typeof value === "string" ? value.trim() : "";
  if (result.length < min || result.length > max) {
    throw new ApiError(`${label} wajib diisi dengan benar.`, 400);
  }
  return result;
}

function date(value: unknown, label: string) {
  const result = typeof value === "string" ? value : "";
  if (!DATE.test(result) || Number.isNaN(Date.parse(`${result}T00:00:00Z`))) {
    throw new ApiError(`${label} tidak valid.`, 400);
  }
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
  if (!body || typeof body !== "object") throw new ApiError("Data pendampingan tidak valid.", 400);
  const input = body as Record<string, unknown>;
  if (typeof input.programId !== "string" || !UUID.test(input.programId)) {
    throw new ApiError("Program pendampingan wajib dipilih.", 400);
  }
  if (typeof input.pendampingId !== "string" || !UUID.test(input.pendampingId)) {
    throw new ApiError("Konsultan atau pendamping wajib dipilih.", 400);
  }
  return {
    programId: input.programId,
    pendampingId: input.pendampingId,
    startDate: date(input.startDate, "Tanggal mulai pendampingan"),
    stimulus: text(input.stimulus, "Fasilitasi stimulan", 3, 500),
    actionPlan: text(input.actionPlan, "Rencana aksi pendampingan", 10, 2000),
  };
}

export function parseProgressInput(body: unknown) {
  if (!body || typeof body !== "object") throw new ApiError("Data progress tidak valid.", 400);
  const input = body as Record<string, unknown>;
  const participantStatus = typeof input.participantStatus === "string" ? input.participantStatus : "";
  const legalStatus = typeof input.legalStatus === "string" ? input.legalStatus : "";
  const progressPercent = Number(input.progressPercent);
  if (participantStatus !== "AKTIF_PENDAMPINGAN") {
    throw new ApiError("Gunakan penyelesaian pendampingan untuk status mandiri.", 400);
  }
  if (!Number.isInteger(progressPercent) || progressPercent < 0 || progressPercent > 99) {
    throw new ApiError("Progress aktif harus 0 sampai 99 persen.", 400);
  }
  if (!["BELUM", "PROSES_NIB_HALAL", "LEGAL"].includes(legalStatus)) {
    throw new ApiError("Status legalitas tidak valid.", 400);
  }
  return {
    participantStatus,
    progressPercent,
    legalStatus,
    evaluation: text(input.evaluation, "Evaluasi pendamping", 10, 2000),
  };
}

export function parseCompleteInterventionInput(body: unknown) {
  if (!body || typeof body !== "object") throw new ApiError("Data penyelesaian tidak valid.", 400);
  const input = body as Record<string, unknown>;
  const nib = typeof input.nib === "string" ? input.nib.replace(/\D/g, "") : "";
  const monthlyRevenue = Number(input.monthlyRevenue);
  if (!NIB.test(nib)) throw new ApiError("NIB harus tepat 13 digit.", 400);
  if (!Number.isSafeInteger(monthlyRevenue) || monthlyRevenue < 0 || monthlyRevenue > 1_000_000_000_000) {
    throw new ApiError("Omzet bulanan tidak valid.", 400);
  }
  return {
    nib,
    monthlyRevenue,
    completionDate: date(input.completionDate, "Tanggal selesai pendampingan"),
    evaluation: text(input.evaluation, "Evaluasi pendamping", 10, 2000),
  };
}

export function parseProgramInput(body: unknown) {
  if (!body || typeof body !== "object") throw new ApiError("Data program tidak valid.", 400);
  const input = body as Record<string, unknown>;
  const code = text(input.code, "Kode program", 10, 10).toUpperCase();
  if (!/^PRG-[A-Z]{3}-[0-9]{2}$/.test(code)) {
    throw new ApiError("Kode program harus memakai format PRG-WIR-01.", 400);
  }
  if (typeof input.pendampingId !== "string" || !UUID.test(input.pendampingId)) {
    throw new ApiError("Konsultan atau pendamping wajib dipilih.", 400);
  }
  const duration = Number(input.duration);
  const capacity = Number(input.capacity);
  const durationUnit = typeof input.durationUnit === "string" ? input.durationUnit.toUpperCase() : "";
  if (!Number.isInteger(duration) || duration < 1 || duration > 60) throw new ApiError("Durasi program tidak valid.", 400);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) throw new ApiError("Kapasitas program tidak valid.", 400);
  if (!["HARI", "MINGGU", "BULAN"].includes(durationUnit)) throw new ApiError("Satuan durasi tidak valid.", 400);
  return {
    code,
    name: text(input.name, "Nama program", 5, 200),
    category: text(input.category, "Kategori usaha", 2, 100),
    pendampingId: input.pendampingId,
    duration,
    durationUnit,
    capacity,
    description: text(input.description, "Deskripsi dan fasilitasi program", 10, 3000),
  };
}
