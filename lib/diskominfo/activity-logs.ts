import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const ACTIVITY_LOG_PAGE_SIZE = 20;
export const ACTIVITY_LOG_EXPORT_LIMIT = 10000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type ActivityLog = {
  id: string;
  user_id: string | null;
  nama_pengguna: string;
  role_pengguna: string;
  aktivitas: string;
  modul: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ActivityLogFilters = {
  search?: string;
  module?: string;
  actor?: string;
  date?: string;
  page?: number;
};

export type ActivityLogFilterOptions = {
  modules: string[];
  statuses: string[];
  actors: {
    id: string;
    nama: string;
    role: string;
  }[];
};

type ActivityLogRpcRow = ActivityLog & {
  total_count: number | string;
};

function isValidDate(value: string) {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value);
}

export function normalizeActivityLogFilters(input: {
  q?: string | null;
  module?: string | null;
  actor?: string | null;
  date?: string | null;
  page?: string | number | null;
}): ActivityLogFilters {
  const requestedPage =
    typeof input.page === "number"
      ? input.page
      : Number.parseInt(input.page ?? "1", 10);
  const actor = input.actor?.trim();
  const date = input.date?.trim();

  return {
    search:
      input.q && input.q.trim().length <= 100
        ? input.q.trim()
        : undefined,
    module:
      input.module && input.module.trim().length <= 100
        ? input.module.trim()
        : undefined,
    actor:
      actor === "system" || (actor && UUID_PATTERN.test(actor))
        ? actor
        : undefined,
    date: date && isValidDate(date) ? date : undefined,
    page:
      Number.isFinite(requestedPage) && requestedPage > 0
        ? Math.floor(requestedPage)
        : 1,
  };
}

async function queryActivityLogs(
  filters: ActivityLogFilters,
  limit: number,
  offset: number,
) {
  const supabase = createAdminClient();
  const actorIsSystem = filters.actor === "system";
  const actorId =
    filters.actor && filters.actor !== "system" ? filters.actor : null;

  const { data, error } = await supabase.rpc("list_activity_logs", {
    p_search: filters.search ?? null,
    p_module: filters.module ?? null,
    p_user_id: actorId,
    p_system_only: actorIsSystem,
    p_date: filters.date ?? null,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    throw new Error(`Gagal mengambil log aktivitas: ${error.message}`);
  }

  const rows = (data ?? []) as ActivityLogRpcRow[];
  return {
    logs: rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      nama_pengguna: row.nama_pengguna,
      role_pengguna: row.role_pengguna,
      aktivitas: row.aktivitas,
      modul: row.modul,
      status: row.status,
      metadata:
        row.metadata && typeof row.metadata === "object" ? row.metadata : {},
      created_at: row.created_at,
    })),
    total: rows.length > 0 ? Number(rows[0].total_count) : 0,
  };
}

export async function getActivityLogs(filters: ActivityLogFilters = {}) {
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const offset = (page - 1) * ACTIVITY_LOG_PAGE_SIZE;
  const result = await queryActivityLogs(
    filters,
    ACTIVITY_LOG_PAGE_SIZE,
    offset,
  );

  return {
    ...result,
    page,
    pageSize: ACTIVITY_LOG_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(result.total / ACTIVITY_LOG_PAGE_SIZE)),
  };
}

export async function getActivityLogsForExport(filters: ActivityLogFilters) {
  return queryActivityLogs(filters, ACTIVITY_LOG_EXPORT_LIMIT, 0);
}

export async function getActivityLogFilterOptions(): Promise<ActivityLogFilterOptions> {
  const supabase = createAdminClient();
  const [{ data: rawOptions, error: optionsError }, { data: actors, error: actorsError }] =
    await Promise.all([
      supabase.rpc("activity_log_filter_options"),
      supabase
        .from("user_profiles")
        .select("id, nama_lengkap, role")
        .order("nama_lengkap", { ascending: true }),
    ]);

  if (optionsError) {
    throw new Error("Gagal mengambil pilihan filter log aktivitas.");
  }

  if (actorsError) {
    throw new Error("Gagal mengambil pilihan pengguna log aktivitas.");
  }

  const options =
    rawOptions && typeof rawOptions === "object" && !Array.isArray(rawOptions)
      ? (rawOptions as { modules?: unknown; statuses?: unknown })
      : {};

  return {
    modules: Array.isArray(options.modules)
      ? options.modules.filter((item): item is string => typeof item === "string")
      : [],
    statuses: Array.isArray(options.statuses)
      ? options.statuses.filter((item): item is string => typeof item === "string")
      : [],
    actors: (actors ?? []).map((actor) => ({
      id: actor.id,
      nama: actor.nama_lengkap,
      role: actor.role,
    })),
  };
}
