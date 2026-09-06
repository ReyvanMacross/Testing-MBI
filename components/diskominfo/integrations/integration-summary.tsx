import type { IntegrationSummary as Summary } from "@/lib/diskominfo/integrations";

import styles from "./integrations.module.css";

export function IntegrationSummary({ summary }: { summary: Summary }) {
  const cards = [
    { label: "Total Integrasi", value: String(summary.total), note: `${summary.untested} belum dites` },
    { label: "Status Online", value: String(summary.online), note: `${summary.slow} lambat` },
    { label: "Status Offline", value: String(summary.offline), note: "perlu pemeriksaan" },
    { label: "Rata-rata Latency", value: summary.averageLatencyMs === null ? "Belum tersedia" : `${summary.averageLatencyMs}ms`, note: "dari data terukur" },
  ];

  return (
    <div className={styles.summaryGrid} aria-label="Ringkasan integrasi API">
      {cards.map((card) => (
        <article className={styles.summaryCard} key={card.label}>
          <p>{card.label}</p>
          <strong>{card.value}</strong>
          <span>{card.note}</span>
        </article>
      ))}
    </div>
  );
}
