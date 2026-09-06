import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const INTEGRATIONS_PAGE_SIZE = 15;
export type IntegrationStatus =
  | "BELUM_DITEST"
  | "ONLINE"
  | "LAMBAT"
  | "OFFLINE";

export type IntegrationListItem = {
  id: string;
  opdId: string | null;
  opdNama: string | null;
  layanan: string;
  instansi: string;
  endpointUrl: string | null;
  httpMethod: "GET" | "HEAD" | "POST";
  status: IntegrationStatus;
  latencyMs: number | null;
  isCritical: boolean;
  healthcheckEnabled: boolean;
  lastTestAt: string | null;
  lastSyncAt: string | null;
  updatedAt: string;
};

export type IntegrationDetail = IntegrationListItem & {
  timeoutMs: number;
  expectedStatusMin: number;
  expectedStatusMax: number;
  credentialType: "NONE" | "BEARER";
  credentialConfigured: boolean;
  credentialRef: string | null;
  criticalOrder: number | null;
  notes: string | null;
  createdAt: string;
};

export type IntegrationHistory = {
  id: string;
  status: string;
  latencyMs: number | null;
  httpStatus: number | null;
  errorMessage: string | null;
  testType: string;
  createdAt: string;
};

export type IntegrationFilters = {
  search?: string;
  status?: IntegrationStatus;
  opdId?: string;
  page?: number;
};

export type IntegrationSummary = {
  total: number;
  online: number;
  slow: number;
  offline: number;
  untested: number;
  averageLatencyMs: number | null;
};

type RpcRow = {
  id: string;
  opd_id: string | null;
  opd_nama: string | null;
  layanan: string;
  instansi: string;
  endpoint_url: string | null;
  http_method: "GET" | "HEAD" | "POST";
  status: IntegrationStatus;
  latency_ms: number | null;
  is_critical: boolean;
  healthcheck_enabled: boolean;
  last_test_at: string | null;
  last_sync_at: string | null;
  updated_at: string;
  total_count: number | string;
};

function mapListItem(row: RpcRow): IntegrationListItem {
  return {
    id: row.id,
    opdId: row.opd_id,
    opdNama: row.opd_nama,
    layanan: row.layanan,
    instansi: row.instansi,
    endpointUrl: row.endpoint_url,
    httpMethod: row.http_method,
    status: row.status,
    latencyMs: row.latency_ms,
    isCritical: row.is_critical,
    healthcheckEnabled: row.healthcheck_enabled,
    lastTestAt: row.last_test_at,
    lastSyncAt: row.last_sync_at,
    updatedAt: row.updated_at,
  };
}

export async function getIntegrationSummary(): Promise<IntegrationSummary> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("integration_summary");
  if (error) throw new Error(`Gagal mengambil ringkasan integrasi: ${error.message}`);
  const value = (data ?? {}) as Record<string, unknown>;
  return {
    total: Number(value.total ?? 0),
    online: Number(value.online ?? 0),
    slow: Number(value.slow ?? 0),
    offline: Number(value.offline ?? 0),
    untested: Number(value.untested ?? 0),
    averageLatencyMs:
      value.averageLatencyMs === null || value.averageLatencyMs === undefined
        ? null
        : Number(value.averageLatencyMs),
  };
}

export async function getIntegrations(filters: IntegrationFilters = {}) {
  const admin = createAdminClient();
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const offset = (page - 1) * INTEGRATIONS_PAGE_SIZE;
  const { data, error } = await admin.rpc("list_integrations", {
    p_search:
      filters.search && filters.search.trim().length <= 100
        ? filters.search.trim()
        : null,
    p_status: filters.status || null,
    p_opd_id: filters.opdId || null,
    p_limit: INTEGRATIONS_PAGE_SIZE,
    p_offset: offset,
  });
  if (error) throw new Error(`Gagal mengambil integrasi: ${error.message}`);
  const rows = (data ?? []) as RpcRow[];
  const total = rows.length ? Number(rows[0].total_count) : 0;
  return {
    integrations: rows.map(mapListItem),
    page,
    pageSize: INTEGRATIONS_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / INTEGRATIONS_PAGE_SIZE)),
  };
}

export async function getIntegrationById(id: string): Promise<IntegrationDetail | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integrasi_api")
    .select("id, opd_id, layanan, instansi, endpoint_url, http_method, status, latency_ms, timeout_ms, expected_status_min, expected_status_max, credential_type, credential_ref, is_critical, critical_order, healthcheck_enabled, notes, last_test_at, last_sync_at, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Gagal mengambil detail integrasi.");
  if (!data) return null;
  let opdNama: string | null = null;
  if (data.opd_id) {
    const { data: opd } = await admin.from("master_opd").select("nama_opd").eq("id", data.opd_id).maybeSingle();
    opdNama = opd?.nama_opd ?? null;
  }
  return {
    id: data.id,
    opdId: data.opd_id,
    opdNama,
    layanan: data.layanan,
    instansi: data.instansi,
    endpointUrl: data.endpoint_url,
    httpMethod: data.http_method,
    status: data.status,
    latencyMs: data.latency_ms,
    timeoutMs: data.timeout_ms,
    expectedStatusMin: data.expected_status_min,
    expectedStatusMax: data.expected_status_max,
    credentialType: data.credential_type,
    credentialConfigured: data.credential_type !== "NONE" && Boolean(data.credential_ref),
    credentialRef: data.credential_ref,
    isCritical: data.is_critical,
    criticalOrder: data.critical_order,
    healthcheckEnabled: data.healthcheck_enabled,
    notes: data.notes,
    lastTestAt: data.last_test_at,
    lastSyncAt: data.last_sync_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function getIntegrationHistory(id: string): Promise<IntegrationHistory[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("integrasi_api_log")
    .select("id, status, latency_ms, http_status, error_message, test_type, created_at")
    .eq("integrasi_api_id", id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error("Gagal mengambil riwayat pemeriksaan.");
  return (data ?? []).map((row) => ({
    id: row.id,
    status: row.status,
    latencyMs: row.latency_ms,
    httpStatus: row.http_status,
    errorMessage: row.error_message,
    testType: row.test_type,
    createdAt: row.created_at,
  }));
}
