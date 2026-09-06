import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireAdminDiskominfo } from "@/lib/auth/require-admin-diskominfo";
import { parseIntegrationInput } from "@/lib/diskominfo/integration-input";
import { getIntegrationById, getIntegrationHistory } from "@/lib/diskominfo/integrations";
import { IntegrationValidationError } from "@/lib/integrations/validate-integration-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminDiskominfo();
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) throw new IntegrationValidationError("Integrasi tidak valid.");
    const [integration, history] = await Promise.all([getIntegrationById(id), getIntegrationHistory(id)]);
    if (!integration) throw new IntegrationValidationError("Integrasi tidak ditemukan.", 404);
    return NextResponse.json({ integration, history });
  } catch (error) {
    return apiErrorResponse(
      error,
      "Integration detail failed",
      "Detail integrasi tidak dapat diambil.",
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    assertBodySize(request);
    const actor = await requireAdminDiskominfo();
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) throw new IntegrationValidationError("Integrasi tidak valid.");
    const input = parseIntegrationInput(await request.json());
    const admin = createAdminClient();
    const { data: current, error: readError } = await admin.from("integrasi_api")
      .select("id, layanan, endpoint_url, http_method, credential_type, credential_ref")
      .eq("id", id).maybeSingle();
    if (readError) throw new Error("Integration read failed.");
    if (!current) throw new IntegrationValidationError("Integrasi tidak ditemukan.", 404);
    if (input.opdId) {
      const { data: opd, error } = await admin.from("master_opd").select("id").eq("id", input.opdId).maybeSingle();
      if (error) throw new Error("OPD validation failed.");
      if (!opd) throw new IntegrationValidationError("OPD tidak ditemukan.");
    }
    const connectionChanged =
      current.endpoint_url !== input.endpointUrl ||
      current.http_method !== input.httpMethod ||
      current.credential_type !== input.credentialType ||
      current.credential_ref !== input.credentialRef;
    const nextValues = {
      layanan: input.layanan,
      instansi: input.instansi,
      opd_id: input.opdId,
      endpoint_url: input.endpointUrl,
      http_method: input.httpMethod,
      timeout_ms: input.timeoutMs,
      expected_status_min: input.expectedStatusMin,
      expected_status_max: input.expectedStatusMax,
      credential_type: input.credentialType,
      credential_ref: input.credentialRef,
      healthcheck_enabled: input.healthcheckEnabled,
      is_critical: input.isCritical,
      critical_order: input.criticalOrder,
      notes: input.notes,
      ...(connectionChanged ? { status: "BELUM_DITEST", latency_ms: null, last_test_at: null } : {}),
    };
    const { data: updated, error } = await admin.from("integrasi_api").update(nextValues).eq("id", id).select("id, layanan").single();
    if (error || !updated) throw new Error(error?.message ?? "Integration update failed.");
    await writeActivityLog({
      userId: actor.profileId,
      namaPengguna: actor.namaLengkap,
      rolePengguna: actor.role,
      aktivitas: `Memperbarui integrasi API: ${updated.layanan}`,
      modul: "Integrasi API",
      metadata: { integrationId: id, connectionReset: connectionChanged },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(
      error,
      "Integration update failed",
      "Perubahan integrasi tidak dapat disimpan.",
    );
  }
}
