import {
  isManagedUserRole,
  type ManagedUserRole,
} from "@/lib/diskominfo/user-role-config";
import { UserValidationError } from "@/lib/diskominfo/validate-user-assignment";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9._-]{3,50}$/;
const NIP_PATTERN = /^\d{18}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type JsonRecord = Record<string, unknown>;

export type UserStatus = "AKTIF" | "NONAKTIF";

export type NormalizedUserInput = {
  namaLengkap: string;
  email: string;
  username: string | null;
  nip: string | null;
  role: string;
  opdId: string | null;
  wilayahId: string | null;
  status: UserStatus;
};

export type CreateUserInput = NormalizedUserInput & {
  role: ManagedUserRole;
  password: string;
};

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new UserValidationError("Data akun tidak valid.");
  }

  return value as JsonRecord;
}

function requiredString(record: JsonRecord, key: string, label: string) {
  const value = record[key];

  if (typeof value !== "string" || !value.trim()) {
    throw new UserValidationError(`${label} wajib diisi.`);
  }

  return value.trim();
}

function optionalString(record: JsonRecord, key: string) {
  const value = record[key];

  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new UserValidationError("Format data akun tidak valid.");
  }

  return value.trim() || null;
}

function parseCommon(value: unknown): NormalizedUserInput {
  const record = asRecord(value);
  const namaLengkap = requiredString(record, "namaLengkap", "Nama lengkap");
  const email = requiredString(record, "email", "Email").toLowerCase();
  const usernameValue = optionalString(record, "username");
  const username = usernameValue?.toLowerCase() ?? null;
  const nip = optionalString(record, "nip");
  const role = requiredString(record, "role", "Role");
  const opdId = optionalString(record, "opdId");
  const wilayahId = optionalString(record, "wilayahId");
  const statusValue = optionalString(record, "status") ?? "AKTIF";

  if (namaLengkap.length < 2 || namaLengkap.length > 200) {
    throw new UserValidationError("Nama lengkap harus 2–200 karakter.");
  }

  if (!EMAIL_PATTERN.test(email) || email.length > 320) {
    throw new UserValidationError("Format email tidak valid.");
  }

  if (!username && !nip) {
    throw new UserValidationError("Username atau NIP wajib diisi.");
  }

  if (username && !USERNAME_PATTERN.test(username)) {
    throw new UserValidationError(
      "Username harus 3–50 karakter dan hanya memakai huruf kecil, angka, titik, garis bawah, atau tanda hubung.",
    );
  }

  if (nip && !NIP_PATTERN.test(nip)) {
    throw new UserValidationError("NIP harus terdiri dari tepat 18 digit.");
  }

  if (opdId && !UUID_PATTERN.test(opdId)) {
    throw new UserValidationError("Instansi/OPD tidak valid.");
  }

  if (wilayahId && !UUID_PATTERN.test(wilayahId)) {
    throw new UserValidationError("Wilayah penugasan tidak valid.");
  }

  if (statusValue !== "AKTIF" && statusValue !== "NONAKTIF") {
    throw new UserValidationError("Status akun tidak valid.");
  }

  return {
    namaLengkap,
    email,
    username,
    nip,
    role,
    opdId,
    wilayahId,
    status: statusValue,
  };
}

export function parseCreateUserInput(value: unknown): CreateUserInput {
  const common = parseCommon(value);
  const record = asRecord(value);
  const password = requiredString(
    record,
    "password",
    "Kata sandi sementara",
  );

  if (!isManagedUserRole(common.role)) {
    throw new UserValidationError("Pilih role yang didukung sistem.");
  }

  if (password.length < 12 || password.length > 1024) {
    throw new UserValidationError(
      "Kata sandi sementara harus 12–1024 karakter.",
    );
  }

  return {
    ...common,
    role: common.role,
    status: "AKTIF",
    password,
  };
}

export function parseUpdateUserInput(value: unknown): NormalizedUserInput {
  return parseCommon(value);
}
