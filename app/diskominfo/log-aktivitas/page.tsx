import { ActivityLogFiltersForm } from "@/components/diskominfo/activity-logs/activity-log-filters";
import { ActivityLogPagination } from "@/components/diskominfo/activity-logs/activity-log-pagination";
import { ActivityLogTable } from "@/components/diskominfo/activity-logs/activity-log-table";
import {
  getActivityLogFilterOptions,
  getActivityLogs,
  normalizeActivityLogFilters,
} from "@/lib/diskominfo/activity-logs";

import styles from "./log-aktivitas.module.css";

type ActivityLogPageProps = {
  searchParams: Promise<{
    q?: string;
    date?: string;
    module?: string;
    actor?: string;
    page?: string;
  }>;
};

function buildExportHref(filters: {
  search?: string;
  date?: string;
  module?: string;
  actor?: string;
}) {
  const params = new URLSearchParams();
  if (filters.search) params.set("q", filters.search);
  if (filters.date) params.set("date", filters.date);
  if (filters.module) params.set("module", filters.module);
  if (filters.actor) params.set("actor", filters.actor);
  const query = params.toString();
  return query
    ? `/api/admin/activity-logs/export?${query}`
    : "/api/admin/activity-logs/export";
}

export default async function ActivityLogPage({
  searchParams,
}: ActivityLogPageProps) {
  const params = await searchParams;
  const filters = normalizeActivityLogFilters(params);
  const [result, filterOptions] = await Promise.all([
    getActivityLogs(filters),
    getActivityLogFilterOptions(),
  ]);
  const hasFilters = Boolean(
    filters.search || filters.date || filters.module || filters.actor,
  );

  return (
    <section className={styles.page} aria-labelledby="activity-logs-heading">
      <header className={styles.pageHeader}>
        <div>
          <h1 id="activity-logs-heading">Log Aktivitas</h1>
          <p>Riwayat audit sistem dan aktivitas pengguna di platform MBI.</p>
        </div>

        <a
          className={styles.exportButton}
          href={buildExportHref(filters)}
          download
        >
          Export Log
        </a>
      </header>

      <ActivityLogFiltersForm filters={filters} options={filterOptions} />

      <div className={styles.tableCard}>
        <ActivityLogTable logs={result.logs} hasFilters={hasFilters} />
        <ActivityLogPagination
          filters={filters}
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          totalPages={result.totalPages}
        />
      </div>
    </section>
  );
}
