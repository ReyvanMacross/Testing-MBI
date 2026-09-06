import { ApiError } from "./api-error-response";

export function assertBodySize(request: Request, maxBytes = 32768) {
  const raw = request.headers.get("content-length");
  if (!raw) return;

  const length = Number(raw);
  if (Number.isFinite(length) && length > maxBytes) {
    throw new ApiError("Payload terlalu besar.", 413);
  }
}
