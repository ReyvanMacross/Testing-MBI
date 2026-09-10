import { ApiError } from "@/lib/http/api-error-response";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UPDATE_ALLOWED_KEYS = new Set([
  "namaLengkap",
  "kelurahanId",
  "statusPerkawinan",
  "alamatLengkap",
  "pekerjaan",
  "expectedUpdatedAt",
]);

const CREATE_ALLOWED_KEYS = new Set([
  "nik",
  "nomorKk",
  "namaLengkap",
  "tempatLahir",
  "tanggalLahir",
  "jenisKelamin",
  "statusPerkawinan",
  "nomorHp",
  "email",
  "alamatLengkap",
  "kelurahanId",
  "pendidikanTerakhir",
  "pekerjaan",
  "jumlahAnggotaKk",
  "statusRumah",
]);

export type WargaUpdateInput = {
  namaLengkap: string;
  kelurahanId: string | null;
  statusPerkawinan: string | null;
  alamatLengkap: string | null;
  pekerjaan: string | null;
  expectedUpdatedAt: string;
};

export type WargaCreateInput = {
  nik: string;
  nomorKk: string;
  namaLengkap: string;
  tempatLahir: string;
  tanggalLahir: string;
  jenisKelamin: "Laki-laki" | "Perempuan";
  statusPerkawinan: string;
  nomorHp: string;
  email: string;
  alamatLengkap: string;
  kelurahanId: string;
  pendidikanTerakhir: string;
  pekerjaan: string;
  jumlahAnggotaKk: number;
  statusRumah: string;
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

function requiredText(value: unknown, label: string, maxLength: number) {
  const normalized = optionalText(value, label, maxLength);
  if (!normalized) throw new ApiError(`${label} wajib diisi.`, 400);
  return normalized;
}

function assertOnlyAllowedKeys(
  input: Record<string, unknown>,
  allowedKeys: Set<string>,
) {
  const unexpected = Object.keys(input).filter((key) => !allowedKeys.has(key));
  if (unexpected.length) {
    throw new ApiError("Terdapat field yang tidak dapat diproses.", 400);
  }
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
  assertOnlyAllowedKeys(input, UPDATE_ALLOWED_KEYS);

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

export function parseWargaCreateInput(value: unknown): WargaCreateInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("Data yang diberikan tidak valid.", 400);
  }
  const input = value as Record<string, unknown>;
  assertOnlyAllowedKeys(input, CREATE_ALLOWED_KEYS);

  const nik = requiredText(input.nik, "NIK", 16);
  if (!/^\d{16}$/.test(nik)) {
    throw new ApiError("NIK harus terdiri dari 16 digit.", 400);
  }

  const nomorKk = requiredText(input.nomorKk, "Nomor KK", 16);
  if (!/^\d{16}$/.test(nomorKk)) {
    throw new ApiError("Nomor KK harus terdiri dari 16 digit.", 400);
  }

  if (typeof input.kelurahanId !== "string" || !UUID.test(input.kelurahanId)) {
    throw new ApiError("Kelurahan wajib dipilih.", 400);
  }

  const tanggalLahir = requiredText(input.tanggalLahir, "Tanggal lahir", 10);
  const parsedDate = new Date(`${tanggalLahir}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(tanggalLahir) ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate < new Date("1900-01-01T00:00:00Z") ||
    parsedDate > new Date()
  ) {
    throw new ApiError("Tanggal lahir tidak valid.", 400);
  }

  const jenisKelamin = requiredText(input.jenisKelamin, "Jenis kelamin", 20);
  if (!["Laki-laki", "Perempuan"].includes(jenisKelamin)) {
    throw new ApiError("Jenis kelamin tidak valid.", 400);
  }

  const email = requiredText(input.email, "Email", 254).toLocaleLowerCase("id-ID");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError("Email wajib memakai format yang benar, misalnya nama@example.invalid.", 400);
  }

  const nomorHpMentah = requiredText(input.nomorHp, "Nomor telepon", 25);
  let angkaTelepon = nomorHpMentah.replace(/\D/g, "");
  if (angkaTelepon.startsWith("62")) angkaTelepon = angkaTelepon.slice(2);
  if (angkaTelepon.startsWith("0")) angkaTelepon = angkaTelepon.slice(1);
  if (!/^8\d{7,12}$/.test(angkaTelepon)) {
    throw new ApiError("Nomor telepon harus diawali +628 dan berisi 8–13 digit setelah +62.", 400);
  }
  const nomorHp = `+62${angkaTelepon}`;

  const jumlahAnggotaKk = Number(input.jumlahAnggotaKk);
  if (!Number.isInteger(jumlahAnggotaKk) || jumlahAnggotaKk < 1 || jumlahAnggotaKk > 50) {
    throw new ApiError("Jumlah anggota keluarga harus antara 1 dan 50.", 400);
  }

  return {
    nik,
    nomorKk,
    namaLengkap: requiredText(input.namaLengkap, "Nama lengkap", 200),
    tempatLahir: requiredText(input.tempatLahir, "Tempat lahir", 100),
    tanggalLahir,
    jenisKelamin: jenisKelamin as WargaCreateInput["jenisKelamin"],
    statusPerkawinan: requiredText(input.statusPerkawinan, "Status perkawinan", 100),
    nomorHp,
    email,
    alamatLengkap: requiredText(input.alamatLengkap, "Alamat domisili", 3000),
    kelurahanId: input.kelurahanId,
    pendidikanTerakhir: requiredText(input.pendidikanTerakhir, "Pendidikan terakhir", 150),
    pekerjaan: requiredText(input.pekerjaan, "Pekerjaan", 200),
    jumlahAnggotaKk,
    statusRumah: requiredText(input.statusRumah, "Status kepemilikan rumah", 150),
  };
}
