import {
  IntegrationValidationError,
  validateIntegrationUrl,
} from "@/lib/integrations/validate-integration-url";

export type IntegrationInput = {
  layanan: string;
  instansi: string;
  opdId: string | null;
  endpointUrl: string | null;
  httpMethod: "GET" | "HEAD" | "POST";
  timeoutMs: number;
  expectedStatusMin: number;
  expectedStatusMax: number;
  credentialType: "NONE" | "BEARER";
  credentialRef: string | null;
  healthcheckEnabled: boolean;
  isCritical: boolean;
  criticalOrder: number | null;
  notes: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CREDENTIAL_REF_PATTERN = /^[A-Z][A-Z0-9_]{2,100}$/;

function textValue(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  const result = value.trim();
  if (result.length > maxLength) {
    throw new IntegrationValidationError(
      `Nilai teks melebihi batas ${maxLength} karakter.`,
    );
  }
  return result;
}

function integerValue(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

export function parseIntegrationInput(body: unknown): IntegrationInput {
  if (!body || typeof body !== "object") {
    throw new IntegrationValidationError("Data integrasi tidak valid.");
  }

  const input = body as Record<string, unknown>;
  const layanan = textValue(input.layanan, 200);
  const instansi = textValue(input.instansi, 200);
  if (!layanan) throw new IntegrationValidationError("Nama layanan wajib diisi.");
  if (!instansi) throw new IntegrationValidationError("Instansi wajib diisi.");

  const opdId = textValue(input.opdId, 50) || null;
  if (opdId && !UUID_PATTERN.test(opdId)) {
    throw new IntegrationValidationError("OPD tidak valid.");
  }

  const endpointUrl = textValue(input.endpointUrl, 2048) || null;
  if (endpointUrl) validateIntegrationUrl(endpointUrl);

  const httpMethod = textValue(input.httpMethod, 10).toUpperCase() || "GET";
  if (!(["GET", "HEAD", "POST"] as string[]).includes(httpMethod)) {
    throw new IntegrationValidationError("HTTP method tidak valid.");
  }

  const timeoutMs = integerValue(input.timeoutMs, 5000);
  if (timeoutMs < 500 || timeoutMs > 30000) {
    throw new IntegrationValidationError(
      "Timeout harus antara 500 dan 30000 milidetik.",
    );
  }

  const expectedStatusMin = integerValue(input.expectedStatusMin, 200);
  const expectedStatusMax = integerValue(input.expectedStatusMax, 299);
  if (
    expectedStatusMin < 100 ||
    expectedStatusMin > 599 ||
    expectedStatusMax < 100 ||
    expectedStatusMax > 599 ||
    expectedStatusMin > expectedStatusMax
  ) {
    throw new IntegrationValidationError("Rentang HTTP status tidak valid.");
  }

  const credentialType =
    textValue(input.credentialType, 20).toUpperCase() || "NONE";
  if (credentialType !== "NONE" && credentialType !== "BEARER") {
    throw new IntegrationValidationError("Jenis credential tidak valid.");
  }

  const credentialRef = textValue(input.credentialRef, 100) || null;
  if (credentialType === "BEARER" && !credentialRef) {
    throw new IntegrationValidationError("Credential Reference wajib diisi.");
  }
  if (credentialRef && !CREDENTIAL_REF_PATTERN.test(credentialRef)) {
    throw new IntegrationValidationError(
      "Format Credential Reference tidak valid.",
    );
  }

  const criticalOrderValue = integerValue(input.criticalOrder, 0);
  const criticalOrder = criticalOrderValue > 0 ? criticalOrderValue : null;

  return {
    layanan,
    instansi,
    opdId,
    endpointUrl,
    httpMethod: httpMethod as IntegrationInput["httpMethod"],
    timeoutMs,
    expectedStatusMin,
    expectedStatusMax,
    credentialType,
    credentialRef: credentialType === "BEARER" ? credentialRef : null,
    healthcheckEnabled: input.healthcheckEnabled !== false,
    isCritical: input.isCritical === true,
    criticalOrder,
    notes: textValue(input.notes, 2000) || null,
  };
}
