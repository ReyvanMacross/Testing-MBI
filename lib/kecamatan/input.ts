import { ApiError } from "@/lib/http/api-error-response";

function object(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError("Payload tidak valid.", 400);
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, min: number, max: number) {
  if (typeof value !== "string") throw new ApiError(`${field} wajib diisi.`, 400);
  const result = value.trim();
  if (result.length < min || result.length > max) throw new ApiError(`${field} tidak valid.`, 400);
  return result;
}

function uuid(value: unknown, field: string) {
  const result = text(value, field, 36, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(result)) {
    throw new ApiError(`${field} tidak valid.`, 400);
  }
  return result;
}

function integer(value: unknown, field: string, min: number, max: number) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new ApiError(`${field} tidak valid.`, 400);
  return number;
}

export function assertKecamatanId(value: string, label = "ID") { return uuid(value, label); }

export function parseProposalInput(value: unknown) {
  const body = object(value);
  return {
    wargaId: uuid(body.wargaId, "Warga"),
    kelurahanId: uuid(body.kelurahanId, "Kelurahan"),
    rt: text(body.rt, "RT", 1, 3), rw: text(body.rw, "RW", 1, 3),
    initialDesil: integer(body.initialDesil, "Desil", 1, 5),
    targetProgramId: uuid(body.targetProgramId, "Program tujuan"),
    reason: text(body.reason, "Alasan usulan", 20, 2000),
  };
}

export function parseSurveyAssignmentInput(value: unknown) {
  const body = object(value);
  const dueDate = text(body.dueDate, "Batas waktu", 10, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(dueDate)) throw new ApiError("Batas waktu tidak valid.", 400);
  return {
    surveyorName: text(body.surveyorName, "Petugas surveyor", 3, 150),
    dueDate,
    instruction: text(body.instruction, "Instruksi", 10, 2000),
  };
}

export function parseSurveyResultInput(value: unknown) {
  const body = object(value);
  return {
    score: integer(body.score, "Skor asesmen", 0, 100),
    factualDesil: integer(body.factualDesil, "Desil faktual", 1, 5),
    notes: text(body.notes, "Catatan faktual", 20, 3000),
  };
}

export function parseSurveyReviewInput(value: unknown) {
  const body = object(value);
  const decision = text(body.decision, "Keputusan", 6, 7);
  if (decision !== "APPROVE" && decision !== "REPEAT") throw new ApiError("Keputusan tidak valid.", 400);
  return {
    decision,
    targetProgramId: uuid(body.targetProgramId, "Program tujuan"),
    reviewNote: text(body.reviewNote, "Catatan persetujuan", 10, 2000),
  };
}

export function parseReferralInput(value: unknown) {
  const body = object(value);
  return {
    programId: uuid(body.programId, "Program tujuan"),
    category: text(body.category, "Kategori layanan", 3, 250),
    instruction: text(body.instruction, "Catatan pengantar", 10, 2000),
    slaHours: integer(body.slaHours ?? 48, "SLA", 1, 720),
  };
}

export function parseLookupInput(value: unknown) {
  const body = object(value);
  const nik = text(body.nik, "NIK", 16, 16);
  if (!/^\d{16}$/u.test(nik)) throw new ApiError("NIK harus berisi 16 digit.", 400);
  return { nik };
}

export function parseHelpdeskInput(value: unknown) {
  const body = object(value);
  return {
    wargaId: body.wargaId === null || body.wargaId === undefined || body.wargaId === "" ? null : uuid(body.wargaId, "Warga"),
    category: text(body.category, "Kategori kendala", 3, 100),
    description: text(body.description, "Deskripsi kendala", 20, 2000),
  };
}
