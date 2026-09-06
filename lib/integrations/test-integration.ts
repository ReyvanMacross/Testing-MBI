import { assertSafeIntegrationHost } from "./assert-safe-integration-host";
import { validateIntegrationUrl } from "./validate-integration-url";

export const SLOW_THRESHOLD_MS = 1000;

export type IntegrationHealthStatus = "ONLINE" | "LAMBAT" | "OFFLINE";

export type IntegrationHealthResult = {
  status: IntegrationHealthStatus;
  latencyMs: number | null;
  httpStatus: number | null;
  errorMessage: string | null;
};

export type TestableIntegration = {
  endpoint_url: string;
  http_method: "GET" | "HEAD" | "POST";
  timeout_ms: number;
  expected_status_min: number;
  expected_status_max: number;
  credential_type: "NONE" | "BEARER";
  credential_ref: string | null;
};

type TestDependencies = {
  fetchImpl?: typeof fetch;
  assertSafeHost?: (hostname: string) => Promise<void>;
  now?: () => number;
  allowedHosts?: Set<string>;
};

export function classifyIntegrationResponse(
  latencyMs: number,
  httpStatus: number,
  expectedMin: number,
  expectedMax: number,
): IntegrationHealthResult {
  if (httpStatus < expectedMin || httpStatus > expectedMax) {
    return {
      status: "OFFLINE",
      latencyMs,
      httpStatus,
      errorMessage: "HTTP status tidak sesuai.",
    };
  }

  return {
    status: latencyMs >= SLOW_THRESHOLD_MS ? "LAMBAT" : "ONLINE",
    latencyMs,
    httpStatus,
    errorMessage: null,
  };
}

export async function testIntegration(
  integration: TestableIntegration,
  dependencies: TestDependencies = {},
): Promise<IntegrationHealthResult> {
  const url = validateIntegrationUrl(
    integration.endpoint_url,
    dependencies.allowedHosts,
  );
  await (dependencies.assertSafeHost ?? assertSafeIntegrationHost)(url.hostname);

  const headers = new Headers({ Accept: "application/json" });
  if (integration.credential_type === "BEARER") {
    const secret = integration.credential_ref
      ? process.env[integration.credential_ref]
      : undefined;
    if (!secret) {
      return {
        status: "OFFLINE",
        latencyMs: null,
        httpStatus: null,
        errorMessage: "Credential server belum dikonfigurasi.",
      };
    }
    headers.set("Authorization", `Bearer ${secret}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), integration.timeout_ms);
  const now = dependencies.now ?? Date.now;
  const startedAt = now();

  try {
    const response = await (dependencies.fetchImpl ?? fetch)(url, {
      method: integration.http_method,
      headers,
      redirect: "manual",
      signal: controller.signal,
    });
    const latencyMs = Math.max(0, Math.round(now() - startedAt));

    if (response.status >= 300 && response.status < 400) {
      return {
        status: "OFFLINE",
        latencyMs,
        httpStatus: response.status,
        errorMessage: "Redirect tidak diizinkan.",
      };
    }

    return classifyIntegrationResponse(
      latencyMs,
      response.status,
      integration.expected_status_min,
      integration.expected_status_max,
    );
  } catch (error) {
    return {
      status: "OFFLINE",
      latencyMs: null,
      httpStatus: null,
      errorMessage:
        error instanceof Error && error.name === "AbortError"
          ? "Timeout koneksi."
          : "Endpoint tidak dapat dihubungi.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
