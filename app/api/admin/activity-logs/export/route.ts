import { NextResponse } from "next/server";

import {
  AdminAuthorizationError,
  requireAdminDiskominfo,
} from "@/lib/auth/require-admin-diskominfo";
import { writeActivityLog } from "@/lib/audit/write-activity-log";
import { createActivityLogCsv } from "@/lib/diskominfo/activity-log-csv";
import {
  ACTIVITY_LOG_EXPORT_LIMIT,
  getActivityLogsForExport,
  normalizeActivityLogFilters,
} from "@/lib/diskominfo/activity-logs";

export async function GET(request: Request) {
  try {
    const authorizedActor = await requireAdminDiskominfo();
    const url = new URL(request.url);
    const filters = normalizeActivityLogFilters({
      q: url.searchParams.get("q"),
      module: url.searchParams.get("module"),
      actor: url.searchParams.get("actor"),
      date: url.searchParams.get("date"),
      page: 1,
    });
    const { logs, total } = await getActivityLogsForExport(filters);

    if (total > ACTIVITY_LOG_EXPORT_LIMIT) {
      return NextResponse.json(
        {
          error:
            "Terlalu banyak data untuk diekspor. Persempit filter terlebih dahulu.",
        },
        { status: 422 },
      );
    }

    const csv = createActivityLogCsv(logs);
    const fileDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    await writeActivityLog({
      userId: authorizedActor.profileId,
      namaPengguna: authorizedActor.namaLengkap,
      rolePengguna: authorizedActor.role,
      aktivitas: "Mengekspor log aktivitas",
      modul: "Log Aktivitas",
      metadata: {
        filters: {
          search: filters.search ?? null,
          date: filters.date ?? null,
          module: filters.module ?? null,
          actor: filters.actor ?? null,
        },
        exportedRows: logs.length,
      },
    });

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="log-aktivitas-${fileDate}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Activity log export failed", error);
    return NextResponse.json(
      { error: "Log aktivitas tidak dapat diekspor." },
      { status: 500 },
    );
  }
}
