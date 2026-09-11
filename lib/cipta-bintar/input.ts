import { ApiError } from "@/lib/http/api-error-response";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

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
  if (!body || typeof body !== "object") throw new ApiError("Data intervensi tidak valid.", 400);
  const input = body as Record<string, unknown>;
  if (typeof input.programId !== "string" || !UUID.test(input.programId)) {
    throw new ApiError("Program rehabilitasi wajib dipilih.", 400);
  }
  if (typeof input.petugasId !== "string" || !UUID.test(input.petugasId)) throw new ApiError("Petugas teknis wajib dipilih.", 400);
  const allocatedBudget = Number(input.allocatedBudget);
  if (!Number.isSafeInteger(allocatedBudget) || allocatedBudget < 0 || allocatedBudget > 1_000_000_000_000) {
    throw new ApiError("Alokasi pagu anggaran tidak valid.", 400);
  }
  return {
    programId: input.programId,
    petugasId: input.petugasId,
    objectAddress: text(input.objectAddress, "Alamat objek", 3, 200),
    infrastructureCategory: text(input.infrastructureCategory, "Kategori infrastruktur", 2, 100),
    objectLocation: text(input.objectLocation, "Lokasi objek", 3, 300),
    startDate: date(input.startDate, "Tanggal mulai pengerjaan fisik"),
    aidPackage: text(input.aidPackage, "Jenis bantuan atau sarana", 3, 500),
    allocatedBudget,
    actionPlan: text(input.actionPlan, "Rencana rincian perbaikan", 10, 2000),
  };
}

export function parseProgressInput(body: unknown) {
  if (!body || typeof body !== "object") throw new ApiError("Data progress tidak valid.", 400);
  const input = body as Record<string, unknown>;
  const participantStatus = typeof input.participantStatus === "string" ? input.participantStatus : "";
  const feasibilityStatus = typeof input.feasibilityStatus === "string" ? input.feasibilityStatus : "";
  const progressPercent = Number(input.progressPercent);
  if (participantStatus !== "DALAM_PENGERJAAN") {
    throw new ApiError("Gunakan penyelesaian rehabilitasi untuk status layak huni.", 400);
  }
  if (!Number.isInteger(progressPercent) || progressPercent < 0 || progressPercent > 99) {
    throw new ApiError("Progress aktif harus 0 sampai 99 persen.", 400);
  }
  if (!["BELUM_DIVERIFIKASI", "PROGRES_FISIK", "LAYAK_HUNI_BERFUNGSI"].includes(feasibilityStatus)) {
    throw new ApiError("Status hasil kelayakan tidak valid.", 400);
  }
  return {
    participantStatus,
    progressPercent,
    feasibilityStatus,
    evaluation: text(input.evaluation, "Catatan evaluasi lapangan", 10, 2000),
  };
}

export function parseCompleteInterventionInput(body: unknown) {
  if (!body || typeof body !== "object") throw new ApiError("Data penyelesaian tidak valid.", 400);
  const input = body as Record<string, unknown>;
  const realizationValue = Number(input.realizationValue);
  if (!Number.isSafeInteger(realizationValue) || realizationValue < 0 || realizationValue > 1_000_000_000_000) {
    throw new ApiError("Nilai realisasi anggaran tidak valid.", 400);
  }
  return {
    realizationValue,
    completionDate: date(input.completionDate, "Tanggal selesai rehabilitasi"),
    evaluation: text(input.evaluation, "Catatan evaluasi lapangan", 10, 2000),
  };
}

export function parseProgramInput(body: unknown) {
  if (!body || typeof body !== "object") throw new ApiError("Data program tidak valid.", 400);
  const input = body as Record<string, unknown>;
  const code = text(input.code, "Kode program", 10, 10).toUpperCase();
  if (!/^PRG-INF-[0-9]{2}$/.test(code)) {
    throw new ApiError("Kode program harus memakai format PRG-INF-01.", 400);
  }
  if (typeof input.petugasId !== "string" || !UUID.test(input.petugasId)) {
    throw new ApiError("Petugas CIPTA_BINTAR wajib dipilih.", 400);
  }
  const duration = Number(input.duration);
  const capacity = Number(input.capacity);
  const budgetPerUnit = Number(input.budgetPerUnit);
  const durationUnit = typeof input.durationUnit === "string" ? input.durationUnit.toUpperCase() : "";
  if (!Number.isInteger(duration) || duration < 1 || duration > 60) throw new ApiError("Durasi program tidak valid.", 400);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) throw new ApiError("Kapasitas program tidak valid.", 400);
  if (!Number.isSafeInteger(budgetPerUnit) || budgetPerUnit < 0 || budgetPerUnit > 1_000_000_000_000) throw new ApiError("Pagu anggaran per unit tidak valid.", 400);
  if (!["HARI", "MINGGU", "BULAN"].includes(durationUnit)) throw new ApiError("Satuan durasi tidak valid.", 400);
  return {
    code,
    name: text(input.name, "Nama program atau bantuan", 5, 200),
    category: text(input.category, "Kategori program", 2, 100),
    petugasId: input.petugasId,
    startDate: date(input.startDate, "Tanggal pelaksanaan"),
    duration,
    durationUnit,
    capacity,
    budgetPerUnit,
    description: text(input.description, "Deskripsi fasilitas program", 10, 3000),
  };
}
