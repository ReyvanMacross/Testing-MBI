import Link from "next/link";

import type { ActivityLogFilters } from "@/lib/diskominfo/activity-logs";

import styles from "./activity-logs.module.css";

type ActivityLogPaginationProps = {
  filters: ActivityLogFilters;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function buildHref(filters: ActivityLogFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.search) params.set("q", filters.search);
  if (filters.date) params.set("date", filters.date);
  if (filters.module) params.set("module", filters.module);
  if (filters.actor) params.set("actor", filters.actor);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query
    ? `/diskominfo/log-aktivitas?${query}`
    : "/diskominfo/log-aktivitas";
}

function getPages(page: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  return [...pages].filter((item) => item >= 1 && item <= totalPages).sort((a, b) => a - b);
}

export function ActivityLogPagination({
  filters,
  page,
  pageSize,
  total,
  totalPages,
}: ActivityLogPaginationProps) {
  if (total === 0) {
    return null;
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const pages = getPages(page, totalPages);

  return (
    <nav className={styles.pagination} aria-label="Navigasi halaman log aktivitas">
      <p>
        Menampilkan {start}–{end} dari {total} log
      </p>

      <div className={styles.paginationLinks}>
        {page > 1 ? (
          <Link href={buildHref(filters, page - 1)}>Sebelumnya</Link>
        ) : (
          <span aria-disabled="true">Sebelumnya</span>
        )}

        {pages.map((pageNumber, index) => (
          <span className={styles.pageItem} key={pageNumber}>
            {index > 0 && pageNumber - pages[index - 1] > 1 ? (
              <span className={styles.ellipsis} aria-hidden="true">
                …
              </span>
            ) : null}
            <Link
              className={pageNumber === page ? styles.currentPage : undefined}
              href={buildHref(filters, pageNumber)}
              aria-current={pageNumber === page ? "page" : undefined}
            >
              {pageNumber}
            </Link>
          </span>
        ))}

        {page < totalPages ? (
          <Link href={buildHref(filters, page + 1)}>Berikutnya</Link>
        ) : (
          <span aria-disabled="true">Berikutnya</span>
        )}
      </div>
    </nav>
  );
}
