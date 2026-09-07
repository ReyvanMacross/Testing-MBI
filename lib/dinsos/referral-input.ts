import { ApiError } from "@/lib/http/api-error-response";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function assertReferralId(value: string) {
  if (!UUID.test(value)) throw new ApiError("ID referral tidak valid.", 400);
  return value;
}

function isValidDate(value: string) {
  if (!DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00+07:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  return value === new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(parsed);
}

export function parseReferralSendInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError("Data pengiriman referral tidak valid.", 400);
  const body = value as Record<string, unknown>;
  const allowed = new Set(["programId", "referralDate", "instruction"]);
  if (Object.keys(body).some((key) => !allowed.has(key))) throw new ApiError("Data pengiriman referral tidak valid.", 400);
  const programId = typeof body.programId === "string" ? body.programId : "";
  const referralDate = typeof body.referralDate === "string" ? body.referralDate : "";
  const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";
  if (!UUID.test(programId) || !isValidDate(referralDate) || instruction.length > 3000) throw new ApiError("Data pengiriman referral tidak valid.", 400);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  if (referralDate > today) throw new ApiError("Tanggal pengiriman tidak boleh di masa depan.", 400);
  return { programId, referralDate, instruction: instruction || null };
}
