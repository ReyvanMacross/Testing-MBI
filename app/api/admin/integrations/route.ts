import { NextResponse } from "next/server";

import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { requireAdminDiskominfo } from "@/lib/auth/require-admin-diskominfo";
import { parseIntegrationInput } from "@/lib/diskominfo/integration-input";
import { IntegrationValidationError } from "@/lib/integrations/validate-integration-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { assertBodySize } from "@/lib/http/assert-body-size";
import { assertSameOrigin } from "@/lib/http/assert-same-origin";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    assertBodySize(request);
    const actor = await requireAdminDiskominfo();
    const input = parseIntegrationInput(await request.json());
    const admin = createAdminClient();
    if (input.opdId) {
      const { data: opd, error } = await admin.from("master_opd").select("id").eq("id", input.opdId).maybeSingle();
      if (error) throw new Error("OPD validation failed.");
      if (!opd) throw new IntegrationValidationError("OPD tidak ditemukan.");
    }
    const { data, error } = await admin.from("integrasi_api").insert({
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
      status: "BELUM_DITEST",
      latency_ms: null,
    }).select("id, layanan").single();
    if (error || !data) throw new Error(error?.message ?? "Integration insert failed.");
    await writeActivityLog({
      userId: actor.profileId,
      namaPengguna: actor.namaLengkap,
      rolePengguna: actor.role,
      aktivitas: `Membuat integrasi API: ${data.layanan}`,
      modul: "Integrasi API",
      metadata: { integrationId: data.id },
    });
    return NextResponse.json({ success: true, integration: { id: data.id } }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(
      error,
      "Integration creation failed",
      "Integrasi tidak dapat dibuat.",
    );
  }
}
