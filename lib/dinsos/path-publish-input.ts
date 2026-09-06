import { ApiError } from "@/lib/http/api-error-response";

import { isDinsosPath } from "./path-values";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function optionalText(value: unknown, maximum: number) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new ApiError("Data penerbitan referral tidak valid.", 400);
  }
  const result = value.trim();
  if (result.length > maximum) {
    throw new ApiError("Data penerbitan referral tidak valid.", 400);
  }
  return result || null;
}

export function assertPathCaseId(value: string) {
  if (!UUID.test(value)) {
    throw new ApiError("Kasus tidak ditemukan.", 404);
  }
  return value;
}

export function parsePathPublishInput(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError("Data penerbitan referral tidak valid.", 400);
  }

  const source = body as Record<string, unknown>;
  const allowed = ["path", "targetOpdId", "overrideReason", "referralNote"];
  if (Object.keys(source).some((key) => !allowed.includes(key))) {
    throw new ApiError("Data penerbitan referral tidak valid.", 400);
  }
  if (!isDinsosPath(source.path)) {
    throw new ApiError("Jalur intervensi tidak valid.", 400);
  }
  if (typeof source.targetOpdId !== "string" || !UUID.test(source.targetOpdId)) {
    throw new ApiError("OPD rujukan tidak valid.", 400);
  }

  const overrideReason = optionalText(source.overrideReason, 1000);
  if (overrideReason && overrideReason.length < 20) {
    throw new ApiError("Alasan perubahan jalur minimal 20 karakter.", 400);
  }

  return {
    path: source.path,
    targetOpdId: source.targetOpdId,
    overrideReason,
    referralNote: optionalText(source.referralNote, 3000),
  };
}
