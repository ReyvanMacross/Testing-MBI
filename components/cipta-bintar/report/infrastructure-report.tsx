"use client";

import { BarChart3, ChevronLeft, ChevronRight, Download, Eye, House, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";

import { Drawer } from "@/components/cipta-bintar/shared/dialog";
import styles from "@/components/cipta-bintar/shared/cipta-bintar-ui.module.css";
import type { InfrastructureReport } from "@/lib/cipta-bintar/data";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function escapeCsv(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function InfrastructureReportView({
  beneficiaries,
  summary,
}: {
  beneficiaries: InfrastructureReport[];
  summary: { independent: number; totalAchievement: number; averageAchievement: number };
}) {
  const [selected, setSelected] = useState<InfrastructureReport | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const categories = [...new Set(beneficiaries.map((item) => item.category))];
  const filtered = useMemo(() => beneficiaries.filter((item) => {
    const haystack = `${item.referralCode} ${item.name} ${item.category} ${item.objectLocation}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase()))
      && (!category || item.category === category)
      && (!status || item.status === status);
  }), [beneficiaries, category, query, status]);

  function exportReport() {
    const rows = [
      ["ID Referral", "Nama Warga", "Kategori", "Lokasi", "Realisasi", "Progress", "Status"],
      ...beneficiaries.map((item) => [
        item.referralCode, item.name, item.category, item.objectLocation,
        item.realizationValue, item.progressPercent, item.status,
      ]),
    ];
    const blob = new Blob([rows.map((row) => row.map(escapeCsv).join(",")).join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "laporan-realisasi-cipta-bintar.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return <section aria-labelledby="infrastructure-report-title">
    <div className={styles.pageHeading}>
      <div>
        <h1 id="infrastructure-report-title">Laporan Pelaksanaan &amp; Realisasi Infrastruktur</h1>
        <p>Rekapitulasi pencapaian perbaikan Rutilahu, fasilitasi MCK komunal, penyediaan SPAM air bersih, dan realisasi pagu anggaran MBI.</p>
      </div>
      <button className={styles.primary} onClick={exportReport}><Download size={17} /> Export Laporan (Excel/PDF)</button>
    </div>

    <div className={styles.summaryGrid}>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><House size={27} /></span><div><p>Hunian Layak &amp; Terpasang</p><strong>{summary.independent} <small>Unit / Lokasi</small></strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><WalletCards size={27} /></span><div><p>Total Realisasi Anggaran</p><strong>{rupiah.format(summary.totalAchievement)}</strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><BarChart3 size={27} /></span><div><p>Rata-rata Pagu / Unit</p><strong>{rupiah.format(summary.averageAchievement)}</strong></div></article>
    </div>

    <section className={styles.card} aria-label="Laporan realisasi infrastruktur">
      <div className={styles.filters}>
        <input style={{ minWidth: 430 }} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari NIK, Nama Warga, atau Kategori Infrastruktur..." aria-label="Cari laporan realisasi" />
        <div className={styles.filterControls}>
          <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Kategori infrastruktur"><option value="">Semua Kategori Infrastruktur</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status kelayakan"><option value="">Status Kelayakan (Semua)</option><option value="LAYAK">Hunian Layak / Selesai</option><option value="DALAM_PENGERJAAN">Dalam Pengerjaan</option></select>
        </div>
      </div>
      <div className={styles.desktopTable}>
        <table>
          <thead><tr><th>ID Referral &amp; Nama Warga</th><th>Kategori &amp; Lokasi</th><th>Realisasi (Rp)</th><th>Status Kelayakan</th><th>Aksi</th></tr></thead>
          <tbody>{filtered.map((item) => <tr key={item.id}>
            <td><strong>{item.name}</strong><span className={styles.muted}>{item.maskedNik}<br />{item.referralCode}</span></td>
            <td><strong>{item.category}</strong><span className={styles.muted}>{item.kelurahan}</span></td>
            <td>{rupiah.format(item.realizationValue)}</td>
            <td><span className={`${styles.badge} ${item.status === "LAYAK" ? styles.badgeGreen : ""}`}>{item.status === "LAYAK" ? "Hunian Layak / Selesai" : "Dalam Pengerjaan"}</span></td>
            <td><button className={styles.action} onClick={() => setSelected(item)}><Eye size={16} /> Detail</button></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className={styles.mobileCards}>{filtered.map((item) => <article key={item.id}>
        <header><div><h3>{item.name}</h3><span className={styles.muted}>{item.referralCode}<br />{item.maskedNik}</span></div><span className={`${styles.badge} ${item.status === "LAYAK" ? styles.badgeGreen : ""}`}>{item.status === "LAYAK" ? "Layak / Selesai" : "Dalam Pengerjaan"}</span></header>
        <dl><div><dt>Kategori / Lokasi</dt><dd>{item.category}<br />{item.kelurahan}</dd></div><div><dt>Realisasi</dt><dd>{rupiah.format(item.realizationValue)}</dd></div></dl>
        <button className={styles.action} onClick={() => setSelected(item)}><Eye size={16} /> Detail</button>
      </article>)}</div>
      {!filtered.length && <p className={styles.emptyState}>Belum ada realisasi infrastruktur yang sesuai filter.</p>}
      <nav className={styles.pagination} aria-label="Halaman laporan"><p>Menampilkan 1–{filtered.length} dari {beneficiaries.length} data</p><div className={styles.pages}><span><ChevronLeft size={15} /></span><strong aria-current="page">1</strong><span><ChevronRight size={15} /></span></div></nav>
    </section>

    {selected && <Drawer title={`Detail Laporan Realisasi — ${selected.referralCode}`} close={() => setSelected(null)} footer={<><button className={styles.secondary} onClick={() => window.print()}><Download size={16} /> Unduh Laporan (PDF)</button><button className={styles.secondary} onClick={() => setSelected(null)}>Tutup</button></>}>
      <div className={styles.detailStack}>
        <div className={styles.identity}><small>Nama Warga</small><h3>{selected.name} ({selected.maskedNik})</h3><p>Kategori &amp; Lokasi Pekerjaan<br />{selected.category} — {selected.kelurahan}</p><span className={`${styles.badge} ${selected.status === "LAYAK" ? styles.badgeGreen : ""}`}>{selected.status === "LAYAK" ? "Hunian Layak / Selesai" : "Dalam Pengerjaan"}</span></div>
        <div className={styles.summaryGrid} style={{ marginBottom: 0 }}>
          <div className={styles.detailBox}><small>Fasilitas Utama</small><strong>{selected.aidPackage}</strong></div>
          <div className={styles.detailBox}><small>Estimasi Serapan Pagu</small><strong>{rupiah.format(selected.realizationValue)}<br />(Progress {selected.progressPercent}%)</strong></div>
        </div>
        <section><h2>Riwayat Progres Fisik Lapangan</h2><div className={styles.timeline}>{selected.history.map((entry) => <div key={entry.id}><span className={styles.muted}>{entry.period}</span><p>Realisasi {rupiah.format(entry.amount)} — Progress {entry.progress}%</p></div>)}</div>{!selected.history.length && <p className={styles.emptyState}>Belum ada riwayat progres fisik.</p>}</section>
      </div>
    </Drawer>}
  </section>;
}