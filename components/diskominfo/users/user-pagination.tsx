import Link from "next/link";

import type { UserFilters } from "@/lib/diskominfo/users";

import styles from "./users.module.css";

type UserPaginationProps = {
  filters: UserFilters;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function buildHref(filters: UserFilters, page: number) {
  const params = new URLSearchParams();

  if (filters.search) params.set("q", filters.search);
  if (filters.opdId) params.set("opd", filters.opdId);
  if (filters.wilayahId) params.set("wilayah", filters.wilayahId);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `/diskominfo/pengguna?${query}` : "/diskominfo/pengguna";
}

export function UserPagination({
  filters,
  page,
  pageSize,
  total,
  totalPages,
}: UserPaginationProps) {
  if (total === 0) {
    return null;
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const firstPage = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => firstPage + index,
  ).filter((value) => value <= totalPages);

  return (
    <nav className={styles.pagination} aria-label="Navigasi halaman pengguna">
      <p>
        Menampilkan {start}–{end} dari {total} akun
      </p>

      <div className={styles.paginationLinks}>
        {page > 1 ? (
          <Link href={buildHref(filters, page - 1)}>Sebelumnya</Link>
        ) : (
          <span aria-disabled="true">Sebelumnya</span>
        )}

        {pages.map((pageNumber) => (
          <Link
            className={pageNumber === page ? styles.currentPage : undefined}
            href={buildHref(filters, pageNumber)}
            key={pageNumber}
            aria-current={pageNumber === page ? "page" : undefined}
          >
            {pageNumber}
          </Link>
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
