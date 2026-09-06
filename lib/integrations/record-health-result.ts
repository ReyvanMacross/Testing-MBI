import type { SupabaseClient } from "@supabase/supabase-js";

import type { IntegrationHealthResult } from "./test-integration";

export type HealthResultIntegration = {
  id: string;
  layanan: string;
  instansi: string;
  is_critical: boolean;
};

export async function recordHealthResult(
  admin: SupabaseClient,
  integration: HealthResultIntegration,
  result: IntegrationHealthResult,
  testedBy: string | null,
  metadata: Record<string, unknown> = {},
) {
  const testedAt = new Date().toISOString();
  const { error: historyError } = await admin.from("integrasi_api_log").insert({
    integrasi_api_id: integration.id,
    test_type: "HEALTHCHECK",
    status: result.status,
    latency_ms: result.latencyMs,
    http_status: result.httpStatus,
    error_message: result.errorMessage,
    tested_by: testedBy,
    metadata,
  });

  if (historyError) throw new Error(historyError.message);

  const { error: updateError } = await admin
    .from("integrasi_api")
    .update({
      status: result.status,
      latency_ms: result.latencyMs,
      last_test_at: testedAt,
    })
    .eq("id", integration.id);

  if (updateError) throw new Error(updateError.message);

  if (!integration.is_critical) return testedAt;

  const { data: existing, error: alertReadError } = await admin
    .from("system_alerts")
    .select("id, title")
    .eq("source_type", "INTEGRASI_API")
    .eq("source_id", integration.id)
    .eq("status", "OPEN");

  if (alertReadError) throw new Error(alertReadError.message);

  if (result.status === "ONLINE") {
    if ((existing ?? []).length > 0) {
      const { error } = await admin
        .from("system_alerts")
        .update({ status: "RESOLVED", resolved_at: testedAt })
        .eq("source_type", "INTEGRASI_API")
        .eq("source_id", integration.id)
        .eq("status", "OPEN");
      if (error) throw new Error(error.message);
    }
    return testedAt;
  }

  const nextAlert =
    result.status === "LAMBAT"
      ? {
          severity: "WARNING",
          title: `Latency ${integration.instansi} Tinggi`,
          message: `API ${integration.layanan} merespons dalam ${result.latencyMs ?? 0}ms.`,
        }
      : {
          severity: "CRITICAL",
          title: `Koneksi ${integration.instansi} Terputus`,
          message: `API ${integration.layanan} sedang berstatus OFFLINE.`,
        };

  const matching = (existing ?? []).find((item) => item.title === nextAlert.title);
  const otherIds = (existing ?? [])
    .filter((item) => item.id !== matching?.id)
    .map((item) => item.id);

  if (otherIds.length > 0) {
    const { error } = await admin
      .from("system_alerts")
      .update({ status: "RESOLVED", resolved_at: testedAt })
      .in("id", otherIds);
    if (error) throw new Error(error.message);
  }

  if (matching) {
    const { error } = await admin
      .from("system_alerts")
      .update({
        severity: nextAlert.severity,
        message: nextAlert.message,
        occurred_at: testedAt,
        resolved_at: null,
      })
      .eq("id", matching.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await admin.from("system_alerts").insert({
      severity: nextAlert.severity,
      title: nextAlert.title,
      message: nextAlert.message,
      module: "Integrasi API",
      source_type: "INTEGRASI_API",
      source_id: integration.id,
      status: "OPEN",
      occurred_at: testedAt,
      metadata: {},
    });
    if (error?.code === "23505") {
      const { error: retryError } = await admin
        .from("system_alerts")
        .update({
          severity: nextAlert.severity,
          message: nextAlert.message,
          occurred_at: testedAt,
          resolved_at: null,
        })
        .eq("source_type", "INTEGRASI_API")
        .eq("source_id", integration.id)
        .eq("title", nextAlert.title)
        .eq("status", "OPEN");
      if (retryError) throw new Error(retryError.message);
    } else if (error) {
      throw new Error(error.message);
    }
  }

  return testedAt;
}
