import { ApiError } from "@/lib/http/api-error-response";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError("Payload tidak valid.", 400);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) {
    throw new ApiError(`${label} harus ${min}-${max} karakter.`, 400);
  }
  return value.trim();
}
function integer(value: unknown, label: string, min: number, max: number) {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    throw new ApiError(`${label} tidak valid.`, 400);
  }
  return Number(value);
}
export function id(value: unknown, label: string) {
  const result = text(value, label, 36, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(result)) {
    throw new ApiError(`${label} tidak valid.`, 400);
  }
  return result;
}
export function parseNikLookup(value: unknown) {
  const body = object(value); const nik = text(body.nik, "NIK", 16, 16);
  if (!/^\d{16}$/u.test(nik)) throw new ApiError("NIK wajib 16 digit.", 400);
  return { nik };
}
export function parseProposal(value: unknown) {
  const body = object(value);
  return {
    citizenId: id(body.citizenId, "Warga"), rt: text(body.rt, "RT", 1, 3), rw: text(body.rw, "RW", 1, 3),
    estimatedDesil: integer(body.estimatedDesil, "Desil", 1, 5), targetProgramId: id(body.targetProgramId, "Program"),
    reason: text(body.reason, "Alasan usulan", 20, 2000),
  };
}
export function parseAssignment(value: unknown) {
  const body = object(value);
  return { surveyorProfileId: body.surveyorProfileId ? id(body.surveyorProfileId, "Surveyor") : null,
    surveyorName: text(body.surveyorName, "Nama surveyor", 3, 150), instruction: text(body.instruction, "Instruksi survei", 10, 2000),
    expectedVersion: integer(body.expectedVersion, "Versi", 1, 1_000_000) };
}
export function parseSurvey(value: unknown) {
  const body = object(value);
  return { score: integer(body.score, "Skor", 0, 100), factualDesil: integer(body.factualDesil, "Desil faktual", 1, 5),
    notes: text(body.notes, "Catatan faktual", 20, 3000), expectedVersion: integer(body.expectedVersion, "Versi", 1, 1_000_000) };
}
export function parseHandoff(value: unknown) {
  const body = object(value);
  return { note: text(body.note, "Catatan pengantar", 10, 2000), expectedVersion: integer(body.expectedVersion, "Versi", 1, 1_000_000) };
}
export function parseHelpdesk(value: unknown) {
  const body = object(value);
  return { category: text(body.category, "Kategori", 3, 100), description: text(body.description, "Deskripsi", 20, 2000) };
}
