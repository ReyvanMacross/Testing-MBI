import { ApiError } from "@/lib/http/api-error-response";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_KEYS = new Set([
  "namaLengkap",
  "kelurahanId",
  "statusPerkawinan",
  "alamatLengkap",
  "pekerjaan",
  "expectedUpdatedAt",
]);

export type WargaUpdateInput = {
  namaLengkap: string;
  kelurahanId: string | null;
  statusPerkawinan: string | null;
  alamatLengkap: string | null;
  pekerjaan: string | null;
  expectedUpdatedAt: string;
};

function optionalText(
  value: unknown,
  label: string,
  maxLength: number,
) {
  if (value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new ApiError(`${label} tidak valid.`, 400);
  }
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new ApiError(`${label} melebihi batas karakter.`, 400);
  }
  return normalized;
}

export function assertWargaId(value: string) {
  if (!UUID.test(value)) throw new ApiError("Data warga tidak ditemukan.", 404);
  return value;
}

export function parseWargaUpdateInput(value: unknown): WargaUpdateInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("Data yang diberikan tidak valid.", 400);
  }
  const input = value as Record<string, unknown>;
  const unexpected = Object.keys(input).filter((key) => !ALLOWED_KEYS.has(key));
  if (unexpected.length) {
    throw new ApiError("Field tersebut tidak dapat diubah.", 400);
  }

  if (typeof input.namaLengkap !== "string") {
    throw new ApiError("Nama lengkap wajib diisi.", 400);
  }
  const namaLengkap = input.namaLengkap.trim();
  if (!namaLengkap || namaLengkap.length > 200) {
    throw new ApiError("Nama lengkap tidak valid.", 400);
  }

  const kelurahanId = input.kelurahanId;
  if (kelurahanId !== null && (typeof kelurahanId !== "string" || !UUID.test(kelurahanId))) {
    throw new ApiError("Kelurahan tidak valid.", 400);
  }

  if (
    typeof input.expectedUpdatedAt !== "string" ||
    Number.isNaN(Date.parse(input.expectedUpdatedAt))
  ) {
    throw new ApiError("Versi data warga tidak valid.", 400);
  }

  return {
    namaLengkap,
    kelurahanId,
    statusPerkawinan: optionalText(input.statusPerkawinan, "Status perkawinan", 100),
    alamatLengkap: optionalText(input.alamatLengkap, "Alamat domisili", 3000),
    pekerjaan: optionalText(input.pekerjaan, "Pekerjaan", 200),
    expectedUpdatedAt: input.expectedUpdatedAt,
  };
}
