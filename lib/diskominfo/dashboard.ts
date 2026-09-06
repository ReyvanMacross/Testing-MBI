import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type DailySyncActivity = {
  date: string;
  label: string;
  records: number;
};

export type CriticalEndpoint = {
  id: string;
  layanan: string;
  instansi: string;
  latency: string | null;
  status: string;
};

export type SystemAlert = {
  id: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  message: string;
  module: string;
  occurred_at: string;
};

const dayNames = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export async function getDashboardSummary() {
  const supabase = createAdminClient();

  const [
    totalOpdResult,
    integrationRowsResult,
    onlineResult,
    slowResult,
    offlineResult,
    untestedResult,
    activeUsersResult,
  ] = await Promise.all([
    supabase
      .from("master_opd")
      .select("*", {
        count: "exact",
        head: true,
      }),
    supabase
      .from("integrasi_api")
      .select("opd_id")
      .not("opd_id", "is", null),
    supabase
      .from("integrasi_api")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("status", "ONLINE"),
    supabase
      .from("integrasi_api")
      .select("*", { count: "exact", head: true })
      .eq("status", "LAMBAT"),
    supabase
      .from("integrasi_api")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("status", "OFFLINE"),
    supabase
      .from("integrasi_api")
      .select("*", { count: "exact", head: true })
      .eq("status", "BELUM_DITEST"),
    supabase
      .from("user_profiles")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("status", "AKTIF"),
  ]);

  const queryError = [
    totalOpdResult.error,
    integrationRowsResult.error,
    onlineResult.error,
    slowResult.error,
    offlineResult.error,
    untestedResult.error,
    activeUsersResult.error,
  ].find(Boolean);

  if (queryError) {
    throw new Error("Gagal memuat ringkasan dashboard.", {
      cause: queryError,
    });
  }

  const integratedOpd = new Set(
    (integrationRowsResult.data ?? [])
      .map((row) => row.opd_id)
      .filter(Boolean),
  ).size;

  return {
    integrations: {
      active: integratedOpd,
      total: totalOpdResult.count ?? 0,
    },
    api: {
      online: onlineResult.count ?? 0,
      slow: slowResult.count ?? 0,
      offline: offlineResult.count ?? 0,
      untested: untestedResult.count ?? 0,
    },
    activeUsers: activeUsersResult.count ?? 0,
    warehouseHealth: null,
  };
}

export async function getSyncActivityLast7Days(): Promise<
  DailySyncActivity[]
> {
  const supabase = createAdminClient();
  const today = new Date();

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);

    date.setDate(date.getDate() - (6 - index));
    date.setHours(0, 0, 0, 0);

    return date;
  });

  const start = days[0];

  const { data, error } = await supabase
    .from("integrasi_api_log")
    .select("records_processed, created_at")
    .gte("created_at", start.toISOString())
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    throw new Error("Gagal mengambil aktivitas sinkronisasi.", {
      cause: error,
    });
  }

  const recordsByDate = new Map(
    days.map((date) => [formatDateKey(date), 0]),
  );

  for (const row of data ?? []) {
    const createdAt = new Date(row.created_at);

    if (Number.isNaN(createdAt.getTime())) {
      continue;
    }

    const dateKey = formatDateKey(createdAt);

    if (!recordsByDate.has(dateKey)) {
      continue;
    }

    recordsByDate.set(
      dateKey,
      (recordsByDate.get(dateKey) ?? 0) + (row.records_processed ?? 0),
    );
  }

  return days.map((date) => {
    const dateKey = formatDateKey(date);

    return {
      date: dateKey,
      label: dayNames[date.getDay()],
      records: recordsByDate.get(dateKey) ?? 0,
    };
  });
}

export async function getCriticalEndpoints(): Promise<CriticalEndpoint[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("integrasi_api")
    .select("id, layanan, instansi, latency, latency_ms, status")
    .eq("is_critical", true)
    .order("critical_order", {
      ascending: true,
    });

  if (error) {
    throw new Error("Gagal mengambil status endpoint kritis.", {
      cause: error,
    });
  }

  return (data ?? []).map((item) => ({
    id: item.id,
    layanan: item.layanan,
    instansi: item.instansi,
    latency:
      item.latency_ms === null || item.latency_ms === undefined
        ? item.latency
        : `${item.latency_ms}ms`,
    status: item.status,
  }));
}

export async function getOpenSystemAlerts(): Promise<SystemAlert[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("system_alerts")
    .select("id, severity, title, message, module, occurred_at")
    .eq("status", "OPEN")
    .order("occurred_at", {
      ascending: false,
    })
    .limit(5);

  if (error) {
    throw new Error("Gagal mengambil log peringatan.", {
      cause: error,
    });
  }

  return (data ?? []) as SystemAlert[];
}
