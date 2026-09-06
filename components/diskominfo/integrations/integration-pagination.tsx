import Link from "next/link";

import type { IntegrationFilters } from "@/lib/diskominfo/integrations";

import styles from "./integrations.module.css";

function href(filters: IntegrationFilters, page: number) {
  const p = new URLSearchParams();
  if (filters.search) p.set("q", filters.search);
  if (filters.status) p.set("status", filters.status);
  if (filters.opdId) p.set("opd", filters.opdId);
  if (page > 1) p.set("page", String(page));
  const q = p.toString();
  return q ? `/diskominfo/integrasi-api?${q}` : "/diskominfo/integrasi-api";
}

export function IntegrationPagination({ filters, page, pageSize, total, totalPages }: { filters: IntegrationFilters; page: number; pageSize: number; total: number; totalPages: number }) {
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);
  return (
    <div className={styles.pagination}>
      <p>Menampilkan {start}–{end} dari {total} integrasi</p>
      <nav className={styles.paginationLinks} aria-label="Paginasi integrasi">
        {page > 1 ? <Link href={href(filters, page - 1)}>Sebelumnya</Link> : <span>Sebelumnya</span>}
        {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, page - 3), Math.max(5, page + 2)).map((n) => n === page ? <span className={styles.currentPage} aria-current="page" key={n}>{n}</span> : <Link href={href(filters, n)} key={n}>{n}</Link>)}
        {page < totalPages ? <Link href={href(filters, page + 1)}>Berikutnya</Link> : <span>Berikutnya</span>}
      </nav>
    </div>
  );
}
