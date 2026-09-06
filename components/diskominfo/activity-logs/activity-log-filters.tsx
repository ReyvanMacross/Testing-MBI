import Link from "next/link";

import type {
  ActivityLogFilterOptions,
  ActivityLogFilters,
} from "@/lib/diskominfo/activity-logs";

import styles from "./activity-logs.module.css";

type ActivityLogFiltersProps = {
  filters: ActivityLogFilters;
  options: ActivityLogFilterOptions;
};

export function ActivityLogFiltersForm({
  filters,
  options,
}: ActivityLogFiltersProps) {
  const hasFilters = Boolean(
    filters.search || filters.date || filters.module || filters.actor,
  );

  return (
    <form
      className={styles.filters}
      action="/diskominfo/log-aktivitas"
      method="get"
    >
      <label>
        <span className={styles.srOnly}>Cari aktivitas</span>
        <input
          type="search"
          name="q"
          defaultValue={filters.search ?? ""}
          placeholder="Cari aktivitas..."
          maxLength={120}
        />
      </label>

      <label>
        <span className={styles.srOnly}>Tanggal aktivitas</span>
        <input type="date" name="date" defaultValue={filters.date ?? ""} />
      </label>

      <label>
        <span className={styles.srOnly}>Kategori aktivitas</span>
        <select name="module" defaultValue={filters.module ?? ""}>
          <option value="">Semua Kategori</option>
          {options.modules.map((module) => (
            <option key={module} value={module}>
              {module}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className={styles.srOnly}>Pengguna aktivitas</span>
        <select name="actor" defaultValue={filters.actor ?? ""}>
          <option value="">Semua Pengguna</option>
          <option value="system">Sistem Auto</option>
          {options.actors.map((actor) => (
            <option key={actor.id} value={actor.id}>
              {actor.nama} — {actor.role}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.filterActions}>
        <button className={styles.filterButton} type="submit">
          Terapkan
        </button>
        {hasFilters ? (
          <Link className={styles.resetButton} href="/diskominfo/log-aktivitas">
            Reset
          </Link>
        ) : null}
      </div>
    </form>
  );
}
