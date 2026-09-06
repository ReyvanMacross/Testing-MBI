import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireAdminDiskominfo } from "@/lib/auth/require-admin-diskominfo";
import { recordHealthResult } from "@/lib/integrations/record-health-result";
import { testIntegration } from "@/lib/integrations/test-integration";
import { IntegrationValidationError } from "@/lib/integrations/validate-integration-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(_request);
    assertBodySize(_request);
    const actor = await requireAdminDiskominfo();
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) throw new IntegrationValidationError("Integrasi tidak valid.");
    const admin = createAdminClient();
    const { data: integration, error } = await admin.from("integrasi_api")
      .select("id, layanan, instansi, is_critical, endpoint_url, http_method, timeout_ms, expected_status_min, expected_status_max, credential_type, credential_ref")
      .eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!integration) throw new IntegrationValidationError("Integrasi tidak ditemukan.", 404);
    if (!integration.endpoint_url) throw new IntegrationValidationError("Endpoint belum dikonfigurasi.");
    const result = await testIntegration({ ...integration, endpoint_url: integration.endpoint_url });
    const testedAt = await recordHealthResult(admin, integration, result, actor.profileId);
    await writeActivityLog({
      userId: actor.profileId,
      namaPengguna: actor.namaLengkap,
      rolePengguna: actor.role,
      aktivitas: `Melakukan uji koneksi: ${integration.layanan}`,
      modul: "Integrasi API",
      status: "BERHASIL",
      metadata: {
        integrationId: integration.id,
        result: result.status,
        latencyMs: result.latencyMs,
        httpStatus: result.httpStatus,
      },
    });
    return NextResponse.json({
      status: result.status,
      latencyMs: result.latencyMs,
      httpStatus: result.httpStatus,
      errorMessage: result.errorMessage,
      testedAt,
    });
  } catch (error) {
    return apiErrorResponse(
      error,
      "Integration healthcheck failed",
      "Uji koneksi tidak dapat diselesaikan.",
    );
  }
}
