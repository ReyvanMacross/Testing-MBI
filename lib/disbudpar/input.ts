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
  if (!body || typeof body !== "object") throw new ApiError("Data pendampingan tidak valid.", 400);
  const input = body as Record<string, unknown>;
  if (typeof input.programId !== "string" || !UUID.test(input.programId)) {
    throw new ApiError("Program Ekraf & Sanggar Seni wajib dipilih.", 400);
  }
  if (typeof input.pendampingId !== "string" || !UUID.test(input.pendampingId)) {
    throw new ApiError("Pendamping DISBUDPAR wajib dipilih.", 400);
  }
  return {
    programId: input.programId,
    pendampingId: input.pendampingId,
    groupName: text(input.groupName, "Nama kelompok atau sanggar", 3, 200),
    creativeSubsector: text(input.creativeSubsector, "Subsektor ekonomi kreatif", 2, 100),
    venueLocation: text(input.venueLocation, "Lokasi sanggar atau galeri", 3, 300),
    startDate: date(input.startDate, "Tanggal mulai pendampingan"),
    aidPackage: text(input.aidPackage, "Fasilitas atau jenis bantuan", 3, 500),
    actionPlan: text(input.actionPlan, "Rencana pendampingan", 10, 2000),
  };
}

export function parseProgressInput(body: unknown) {
  if (!body || typeof body !== "object") throw new ApiError("Data progress tidak valid.", 400);
  const input = body as Record<string, unknown>;
  const participantStatus = typeof input.participantStatus === "string" ? input.participantStatus : "";
  const creativeResultStatus = typeof input.creativeResultStatus === "string" ? input.creativeResultStatus : "";
  const progressPercent = Number(input.progressPercent);
  if (participantStatus !== "AKTIF_PENDAMPINGAN") {
    throw new ApiError("Gunakan penyelesaian pendampingan untuk status mandiri.", 400);
  }
  if (!Number.isInteger(progressPercent) || progressPercent < 0 || progressPercent > 99) {
    throw new ApiError("Progress aktif harus 0 sampai 99 persen.", 400);
  }
  if (!["BELUM_AKTIF", "AKTIF_TERBATAS", "AKTIF_TAMPIL_PRODUKSI_RUTIN"].includes(creativeResultStatus)) {
    throw new ApiError("Status hasil ekraf dan seni tidak valid.", 400);
  }
  return {
    participantStatus,
    progressPercent,
    creativeResultStatus,
    evaluation: text(input.evaluation, "Catatan evaluasi pendamping", 10, 2000),
  };
}

export function parseCompleteInterventionInput(body: unknown) {
  if (!body || typeof body !== "object") throw new ApiError("Data penyelesaian tidak valid.", 400);
  const input = body as Record<string, unknown>;
  const achievementValue = Number(input.achievementValue);
  if (!Number.isSafeInteger(achievementValue) || achievementValue < 0 || achievementValue > 1_000_000_000_000) {
    throw new ApiError("Capaian omzet atau nilai tampil tidak valid.", 400);
  }
  return {
    achievementValue,
    completionDate: date(input.completionDate, "Tanggal selesai pendampingan"),
    evaluation: text(input.evaluation, "Catatan evaluasi pendamping", 10, 2000),
  };
}

export function parseProgramInput(body: unknown) {
  if (!body || typeof body !== "object") throw new ApiError("Data program tidak valid.", 400);
  const input = body as Record<string, unknown>;
  const code = text(input.code, "Kode program", 10, 10).toUpperCase();
  if (!/^PRG-BUD-[0-9]{2}$/.test(code)) {
    throw new ApiError("Kode program harus memakai format PRG-BUD-01.", 400);
  }
  if (typeof input.pendampingId !== "string" || !UUID.test(input.pendampingId)) {
    throw new ApiError("Pendamping DISBUDPAR wajib dipilih.", 400);
  }
  const duration = Number(input.duration);
  const capacity = Number(input.capacity);
  const durationUnit = typeof input.durationUnit === "string" ? input.durationUnit.toUpperCase() : "";
  if (!Number.isInteger(duration) || duration < 1 || duration > 60) throw new ApiError("Durasi program tidak valid.", 400);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) throw new ApiError("Kapasitas program tidak valid.", 400);
  if (!["HARI", "MINGGU", "BULAN"].includes(durationUnit)) throw new ApiError("Satuan durasi tidak valid.", 400);
  return {
    code,
    name: text(input.name, "Nama program atau bantuan", 5, 200),
    category: text(input.category, "Kategori program", 2, 100),
    pendampingId: input.pendampingId,
    duration,
    durationUnit,
    capacity,
    description: text(input.description, "Deskripsi fasilitas program", 10, 3000),
  };
}
