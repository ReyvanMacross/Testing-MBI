import Link from "next/link";

import type { IntegrationFilters } from "@/lib/diskominfo/integrations";
import type { OpdOption } from "@/lib/diskominfo/users";

import styles from "./integrations.module.css";

export function IntegrationFiltersForm({ filters, opdOptions }: { filters: IntegrationFilters; opdOptions: OpdOption[] }) {
  const hasFilters = Boolean(filters.search || filters.status || filters.opdId);
  return (
    <form className={styles.filters} method="get" action="/diskominfo/integrasi-api">
      <label>
        <span className={styles.srOnly}>Cari integrasi</span>
        <input name="q" defaultValue={filters.search ?? ""} placeholder="Cari integrasi..." maxLength={100} />
      </label>
      <label>
        <span className={styles.srOnly}>Status integrasi</span>
        <select name="status" defaultValue={filters.status ?? ""}>
          <option value="">Semua Status</option>
          <option value="ONLINE">Online</option>
          <option value="LAMBAT">Lambat</option>
          <option value="OFFLINE">Offline</option>
          <option value="BELUM_DITEST">Belum Dites</option>
        </select>
      </label>
      <label>
        <span className={styles.srOnly}>OPD</span>
        <select name="opd" defaultValue={filters.opdId ?? ""}>
          <option value="">Semua OPD</option>
          {opdOptions.map((opd) => <option key={opd.id} value={opd.id}>{opd.nama}</option>)}
        </select>
      </label>
      <div className={styles.filterActions}>
        <button className={styles.outlineButton} type="submit">Terapkan</button>
        {hasFilters ? <Link className={styles.resetButton} href="/diskominfo/integrasi-api">Reset</Link> : null}
      </div>
    </form>
  );
}
