import Link from "next/link";

import { CriticalEndpointsTable } from "@/components/diskominfo/critical-endpoints-table";
import { SyncActivityChart } from "@/components/diskominfo/sync-activity-chart";
import { SummaryCard } from "@/components/diskominfo/summary-card";
import { SystemAlerts } from "@/components/diskominfo/system-alerts";
import {
  getCriticalEndpoints,
  getDashboardSummary,
  getOpenSystemAlerts,
  getSyncActivityLast7Days,
} from "@/lib/diskominfo/dashboard";

import styles from "./diskominfo.module.css";

const tabs = [
  { label: "Ringkasan", href: "/diskominfo" },
  { label: "Peta Sebaran Desil", href: "/diskominfo/peta" },
  { label: "Manajemen Akun", href: "/diskominfo/pengguna" },
  { label: "Integrasi API", href: "/diskominfo/integrasi-api" },
];

export default async function DiskominfoPage() {
  const [summary, syncActivity, criticalEndpoints, systemAlerts] =
    await Promise.all([
      getDashboardSummary(),
      getSyncActivityLast7Days(),
      getCriticalEndpoints(),
      getOpenSystemAlerts(),
    ]);

  return (
    <section className={styles.page} aria-labelledby="dashboard-heading">
      <header className={styles.pageHeader}>
        <div>
          <h1 id="dashboard-heading">Dashboard Diskominfo</h1>
          <p>Monitoring &amp; Integrasi Sistem</p>
        </div>

        <div className={styles.actions} aria-label="Aksi dashboard">
          <button className={styles.secondaryAction} type="button">
            Unduh Laporan
          </button>
          <button className={styles.primaryAction} type="button">
            Tambah Integrasi
          </button>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="Bagian dashboard">
        {tabs.map((tab, index) =>
          tab.href ? (
            <Link
              className={`${styles.tab} ${index === 0 ? styles.tabActive : ""}`}
              href={tab.href}
              key={tab.label}
              aria-current={index === 0 ? "page" : undefined}
            >
              {tab.label}
            </Link>
          ) : (
            <button className={styles.tab} type="button" key={tab.label}>
              {tab.label}
            </button>
          ),
        )}
      </nav>

      <div className={styles.summaryGrid}>
        <SummaryCard
          title="Total OPD Terintegrasi"
          value={`${summary.integrations.active}/${summary.integrations.total}`}
        />

        <SummaryCard
          title="Status API"
          value={`${summary.api.online} On / ${summary.api.offline} Off`}
          badge={
            summary.api.offline > 0 ? "PERLU PERHATIAN" : "NORMAL"
          }
          description={`${summary.api.slow} lambat · ${summary.api.untested} belum dites`}
        />

        <SummaryCard
          title="Total Akun Aktif"
          value={String(summary.activeUsers)}
        />

        <SummaryCard
          title="Kesehatan Data Warehouse"
          value="Belum tersedia"
        />
      </div>

      <SyncActivityChart data={syncActivity} />

      <div className={styles.bottomGrid}>
        <CriticalEndpointsTable endpoints={criticalEndpoints} />
        <SystemAlerts alerts={systemAlerts} />
      </div>
    </section>
  );
}
