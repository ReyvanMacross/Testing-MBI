"use client";

import { useEffect } from "react";
import type { IntegrationDetail, IntegrationHistory } from "@/lib/diskominfo/integrations";
import { statusClass, statusLabel } from "./integration-table";
import styles from "./integrations.module.css";

function date(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function IntegrationDetailDialog({ integration, history, onClose }: { integration: IntegrationDetail | null; history: IntegrationHistory[]; onClose: () => void }) {
  useEffect(() => {
    if (!integration) return;
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [integration, onClose]);
  if (!integration) return null;
  const details = [
    ["Nama layanan", integration.layanan], ["Instansi", integration.instansi], ["OPD", integration.opdNama ?? "Sumber eksternal"], ["Endpoint", integration.endpointUrl ?? "Belum dikonfigurasi"], ["Method", integration.httpMethod], ["Latency", integration.latencyMs === null ? "—" : `${integration.latencyMs}ms`], ["Kritis", integration.isCritical ? "Ya" : "Tidak"], ["Healthcheck", integration.healthcheckEnabled ? "Aktif" : "Nonaktif"], ["Credential", integration.credentialConfigured ? "Bearer via environment — configured" : "Tanpa credential"], ["Last Test", date(integration.lastTestAt)], ["Last Sync", date(integration.lastSyncAt)], ["Dibuat", date(integration.createdAt)], ["Diperbarui", date(integration.updatedAt)],
  ];
  return <div className={styles.dialogOverlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className={`${styles.dialog} ${styles.detailDialog}`} role="dialog" aria-modal="true" aria-labelledby="integration-detail-title"><header className={styles.dialogHeader}><div><h2 id="integration-detail-title">Detail Integrasi</h2><p>Konfigurasi dan 20 pemeriksaan terbaru.</p></div><button className={styles.dialogClose} type="button" aria-label="Tutup dialog" onClick={onClose}>×</button></header><div className={styles.detailBody}><div className={styles.detailStatus}><span className={`${styles.statusBadge} ${statusClass(integration.status)}`}>{statusLabel(integration.status)}</span></div><dl className={styles.detailGrid}>{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><h3>Riwayat Pemeriksaan</h3>{history.length ? <div className={styles.historyList}>{history.map((item) => <article key={item.id}><div><strong>{date(item.createdAt)}</strong><span className={`${styles.statusBadge} ${statusClass(item.status as IntegrationDetail["status"])}`}>{statusLabel(item.status as IntegrationDetail["status"])}</span></div><p>{item.latencyMs === null ? "—" : `${item.latencyMs}ms`} · {item.httpStatus ? `HTTP ${item.httpStatus}` : item.errorMessage ?? "Tanpa HTTP status"}</p></article>)}</div> : <p className={styles.historyEmpty}>Belum ada riwayat pemeriksaan.</p>}</div></section></div>;
}
