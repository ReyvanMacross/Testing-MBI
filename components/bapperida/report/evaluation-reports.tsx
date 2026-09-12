"use client";

import { Download, Eye, X } from "lucide-react";
import { useState } from "react";

import type { EvaluationReport } from "@/lib/bapperida/data";
import styles from "../bapperida.module.css";

export function EvaluationReports({ reports }: { reports: EvaluationReport[] }) {
  const [selected, setSelected] = useState<EvaluationReport | null>(null);
  const latest = reports[0];
  return <>
    <section className={styles.tableCard}>
      {latest && <div className={styles.reportHero}>
        <div><h2>Laporan Evaluasi — {formatMonth(latest.period)}</h2><div className={styles.reportHeroMetrics}>
          <div><span>Warga Mandiri Bulan Ini</span><strong>{latest.independentCitizens.toLocaleString("id-ID")}</strong></div>
          <div><span>Tingkat Keberhasilan</span><strong>{latest.successRate}%</strong></div>
          <div><span>Warga Re-entry</span><strong>{latest.reentryCitizens}</strong></div>
        </div></div>
        <div className={styles.actions}><button type="button" onClick={() => window.print()}><Download size={17} /> Unduh PDF</button><button type="button" className={styles.primaryButton} onClick={() => setSelected(latest)}>Lihat Laporan Lengkap</button></div>
      </div>}
      {reports.length ? <table className={styles.reportTable}>
        <thead><tr><th>Periode</th><th>Ringkasan Capaian</th><th>Status</th><th>Tanggal Terbit</th><th>Aksi</th></tr></thead>
        <tbody>{reports.map((report) => <tr key={report.id}><td>{formatMonth(report.period)}</td><td>{report.independentCitizens.toLocaleString("id-ID")} warga mandiri, indeks {report.welfareIndex.toFixed(1)}</td><td><span className={styles.statusBadge}>SELESAI</span></td><td>{formatPublished(report.period)}</td><td><div className={styles.iconActions}><button type="button" aria-label={`Lihat laporan ${formatMonth(report.period)}`} onClick={() => setSelected(report)}><Eye /></button><button type="button" aria-label={`Unduh laporan ${formatMonth(report.period)}`} onClick={() => window.print()}><Download /></button></div></td></tr>)}</tbody>
      </table> : <p className={styles.emptyState}>Belum ada snapshot evaluasi yang diterbitkan.</p>}
    </section>
    {selected && <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setSelected(null)}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="report-detail-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><h2 id="report-detail-title">Laporan Evaluasi — {formatMonth(selected.period)}</h2><button type="button" aria-label="Tutup" onClick={() => setSelected(null)}><X /></button></header>
      <div className={styles.modalBody}><span className={styles.statusBadge}>PUBLISHED</span><h3>Ringkasan Outcome Lintas OPD</h3><dl><div><dt>Warga mandiri</dt><dd>{selected.independentCitizens.toLocaleString("id-ID")}</dd></div><div><dt>Tingkat keberhasilan</dt><dd>{selected.successRate}%</dd></div><div><dt>Warga re-entry</dt><dd>{selected.reentryCitizens}</dd></div><div><dt>Indeks kesejahteraan</dt><dd>{selected.welfareIndex.toFixed(1)} / 100</dd></div></dl><p>Snapshot ini diterbitkan dari agregasi referral, intervensi, dan realisasi modul operasional MBI pada periode terpilih.</p></div>
      <footer><button type="button" onClick={() => window.print()}><Download size={17} /> Unduh PDF</button><button type="button" onClick={() => setSelected(null)}>Tutup</button></footer>
    </section></div>}
  </>;
}

function formatMonth(value: string) { return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function formatPublished(value: string) { const date = new Date(`${value}T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + 1); return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date); }
