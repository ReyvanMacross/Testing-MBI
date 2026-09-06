import { ApiError } from "@/lib/http/api-error-response";

export class IntegrationValidationError extends ApiError {
  constructor(message: string, status: 400 | 404 = 400) {
    super(message, status);
    this.name = "IntegrationValidationError";
  }
}

export function getAllowedIntegrationHosts() {
  return new Set(
    (process.env.INTEGRATION_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function validateIntegrationUrl(
  rawUrl: string,
  allowedHosts = getAllowedIntegrationHosts(),
) {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new IntegrationValidationError("Endpoint URL tidak valid.");
  }

  if (url.protocol !== "https:") {
    throw new IntegrationValidationError(
      "Endpoint integrasi wajib menggunakan HTTPS.",
    );
  }

  if (url.username || url.password) {
    throw new IntegrationValidationError(
      "Credential tidak boleh disimpan di URL.",
    );
  }

  if (!allowedHosts.has(url.hostname.toLowerCase())) {
    throw new IntegrationValidationError(
      "Host endpoint belum berada dalam allowlist integrasi.",
    );
  }

  return url;
}
