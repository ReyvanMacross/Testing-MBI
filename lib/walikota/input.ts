import { ApiError } from "@/lib/http/api-error-response";

const actions = ["APPROVE", "REQUEST_REVISION"] as const;
const priorities = ["NORMAL", "TINGGI", "MENDESAK"] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const datePattern = /^\d{4}-\d{2}-\d{2}$/u;

type ReviewBody = {
  expectedVersion?: unknown;
  action?: unknown;
  priorityLevel?: unknown;
  leaderNote?: unknown;
  dispositions?: unknown;
};

function validText(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) {
    throw new ApiError(`${label} tidak valid.`, 400);
  }
  return value.trim();
}

export function parseExecutiveReviewInput(body: ReviewBody) {
  const expectedVersion = Number(body.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new ApiError("Versi rekomendasi tidak valid.", 400);
  if (typeof body.action !== "string" || !actions.includes(body.action as (typeof actions)[number])) throw new ApiError("Keputusan tidak valid.", 400);
  if (typeof body.priorityLevel !== "string" || !priorities.includes(body.priorityLevel as (typeof priorities)[number])) throw new ApiError("Prioritas tidak valid.", 400);
  if (!Array.isArray(body.dispositions) || body.dispositions.length > 20) throw new ApiError("Daftar disposisi tidak valid.", 400);
  const dispositions = body.dispositions.map((item) => {
    if (!item || typeof item !== "object") throw new ApiError("Disposisi tidak valid.", 400);
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.opdId !== "string" || !uuidPattern.test(candidate.opdId)) throw new ApiError("Tujuan disposisi tidak valid.", 400);
    if (candidate.dueDate != null && (typeof candidate.dueDate !== "string" || !datePattern.test(candidate.dueDate))) throw new ApiError("Tenggat disposisi tidak valid.", 400);
    return {
      opdId: candidate.opdId,
      instruction: validText(candidate.instruction, "Instruksi disposisi", 10, 2000),
      dueDate: candidate.dueDate || null,
    };
  });
  if (new Set(dispositions.map((item) => item.opdId)).size !== dispositions.length) throw new ApiError("Tujuan disposisi tidak boleh berulang.", 400);
  if (body.action === "REQUEST_REVISION" && dispositions.length) throw new ApiError("Permintaan revisi tidak dapat disertai disposisi.", 400);
  return {
    expectedVersion,
    action: body.action as (typeof actions)[number],
    priorityLevel: body.priorityLevel as (typeof priorities)[number],
    leaderNote: validText(body.leaderNote, "Catatan pimpinan", 10, 2000),
    dispositions,
  };
}
