"use client";

import { Banknote, ChevronLeft, ChevronRight, Download, Eye, HeartHandshake, Search, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";

import { Drawer } from "@/components/dp3a/shared/dialog";
import styles from "@/components/dp3a/shared/dp3a-ui.module.css";
import type { Dp3aReport } from "@/lib/dp3a/data";

function rupiah(value: number) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value); }
function csv(value: string | number) { return `"${String(value).replaceAll('"', '""')}"`; }

export function Dp3aReportView({ reports, summary }: { reports: Dp3aReport[]; summary: { completed: number; totalRealization: number; averageBudget: number } }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [program, setProgram] = useState("");
  const [selected, setSelected] = useState<Dp3aReport | null>(null);
  const filtered = useMemo(() => reports.filter((item) => (!query || `${item.name} ${item.maskedNik} ${item.referralCode} ${item.program}`.toLowerCase().includes(query.toLowerCase())) && (!status || item.status === status) && (!program || item.program === program)), [reports, query, status, program]);
  const programs = [...new Set(reports.map((item) => item.program))];

  function exportCsv() {
    const rows = [["ID Referral", "Nama Warga", "Kategori Layanan", "Kelurahan", "Program", "Realisasi", "Status"], ...filtered.map((item) => [item.referralCode, item.name, item.serviceType, item.kelurahan, item.program, item.realizedAmount, item.status])];
    const blob = new Blob([rows.map((row) => row.map(csv).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "laporan-realisasi-dp3a.csv";
    anchor.click();
    URL.revokeObjectURL(href);
  }

  return <section aria-labelledby="report-title">
    <div className={styles.pageHeading}><div><h1 id="report-title">Laporan Pelaksanaan &amp; Realisasi DP3A</h1><p>Rekapitulasi penanganan rujukan, pendampingan hukum, konseling psikologis, rumah aman, dan realisasi pagu anggaran MBI.</p></div><button className={styles.primary} onClick={exportCsv}><Download size={17} /> Export Laporan (CSV)</button></div>
    <div className={styles.summaryGrid}><article className={styles.summaryCard}><span className={styles.summaryIcon}><HeartHandshake size={27} /></span><div><p>Warga Terpendamping / Selesai</p><strong>{summary.completed}</strong></div></article><article className={styles.summaryCard}><span className={styles.summaryIcon}><Banknote size={27} /></span><div><p>Total Realisasi Anggaran</p><strong style={{ fontSize: 26 }}>{rupiah(summary.totalRealization)}</strong></div></article><article className={styles.summaryCard}><span className={styles.summaryIcon}><WalletCards size={27} /></span><div><p>Rata-rata Pagu / Warga</p><strong style={{ fontSize: 26 }}>{rupiah(summary.averageBudget)}</strong></div></article></div>
    <section className={styles.card}><div className={styles.filters}><label style={{ position: "relative" }}><Search size={17} style={{ position: "absolute", left: 12, top: 12 }} /><input style={{ paddingLeft: 40, minWidth: 410 }} aria-label="Cari laporan" placeholder="Cari NIK, nama warga, atau program layanan..." value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className={styles.filterControls}><select aria-label="Filter program laporan" value={program} onChange={(event) => setProgram(event.target.value)}><option value="">Semua Program Layanan</option>{programs.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter status laporan" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Status Penanganan (Semua)</option><option value="DALAM_PENANGANAN">Dalam Penanganan</option><option value="TERINTERVENSI_SELESAI">Terintervensi / Selesai</option></select></div></div>
      <div className={styles.desktopTable}><table><thead><tr><th>ID Referral &amp; Nama Warga</th><th>Kategori Layanan &amp; Lokasi</th><th>Realisasi (Rp)</th><th>Status Penanganan</th><th>Aksi</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><span className={styles.muted}>{item.maskedNik}<br />{item.referralCode}</span></td><td>{item.serviceType}<br /><span className={styles.muted}>{item.kelurahan}, Kec. {item.kecamatan}</span></td><td><strong>{rupiah(item.realizedAmount)}</strong></td><td><span className={`${styles.badge} ${item.status === "TERINTERVENSI_SELESAI" ? styles.badgeGreen : ""}`}>{item.status === "TERINTERVENSI_SELESAI" ? "Terintervensi / Selesai" : "Dalam Penanganan"}</span></td><td><button className={styles.action} onClick={() => setSelected(item)}><Eye size={16} /> Detail</button></td></tr>)}</tbody></table></div>
      <div className={styles.mobileCards}>{filtered.map((item) => <article key={item.id}><header><div><h3>{item.name}</h3><span className={styles.muted}>{item.referralCode}</span></div><span className={`${styles.badge} ${item.status === "TERINTERVENSI_SELESAI" ? styles.badgeGreen : ""}`}>{item.status === "TERINTERVENSI_SELESAI" ? "Selesai" : "Penanganan"}</span></header><dl><div><dt>Layanan</dt><dd>{item.serviceType}</dd></div><div><dt>Realisasi</dt><dd>{rupiah(item.realizedAmount)}</dd></div></dl><button className={styles.action} onClick={() => setSelected(item)}>Detail</button></article>)}</div>
      {!filtered.length && <p className={styles.emptyState}>Belum ada realisasi yang sesuai filter.</p>}<nav className={styles.pagination} aria-label="Halaman laporan"><p>Menampilkan 1–{filtered.length} dari {reports.length} data</p><div className={styles.pages}><span><ChevronLeft size={15} /></span><strong aria-current="page">1</strong><span><ChevronRight size={15} /></span></div></nav>
    </section>
    {selected && <Drawer title={`Detail Laporan Realisasi — ${selected.referralCode}`} close={() => setSelected(null)} footer={<><button className={styles.secondary} onClick={() => window.print()}><Download size={16} /> Unduh Laporan (PDF)</button><button className={styles.secondary} onClick={() => setSelected(null)}>Tutup</button></>}><div className={styles.detailStack}><div className={styles.identity}><small>Nama Korban / Warga</small><h3>{selected.name} ({selected.maskedNik})</h3><p>{selected.serviceType} — {selected.kelurahan}, Kec. {selected.kecamatan}</p><span className={`${styles.badge} ${selected.status === "TERINTERVENSI_SELESAI" ? styles.badgeGreen : ""}`}>{selected.status === "TERINTERVENSI_SELESAI" ? "Terintervensi / Selesai" : "Dalam Penanganan"}</span></div><div className={styles.twoColumns}><div className={styles.detailBox}><small>Layanan / Bantuan DP3A</small><strong>{selected.supportItem}</strong></div><div className={styles.detailBox}><small>Realisasi Pagu Anggaran</small><strong>{rupiah(selected.realizedAmount)}</strong></div></div><div className={styles.detailBox}><small>Program &amp; Tim Pendamping</small><strong>{selected.program}<br />{selected.unit}</strong></div><section><h2>Riwayat Penanganan &amp; Bukti Lapangan</h2><div className={styles.timeline}>{selected.timeline.map((item) => <div key={item.id}><span className={styles.muted}>{item.date}</span><p>{item.note}</p></div>)}</div></section></div></Drawer>}
  </section>;
}
