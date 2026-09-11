"use client";

import { BarChart3, ChevronLeft, ChevronRight, Download, Eye, Palette, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";

import { Drawer } from "@/components/disbudpar/shared/dialog";
import styles from "@/components/disbudpar/shared/disbudpar-ui.module.css";
import type { CreativeReport } from "@/lib/disbudpar/data";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function escapeCsv(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function CreativeReportView({
  beneficiaries,
  summary,
}: {
  beneficiaries: CreativeReport[];
  summary: { independent: number; totalAchievement: number; averageAchievement: number };
}) {
  const [selected, setSelected] = useState<CreativeReport | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const categories = [...new Set(beneficiaries.map((item) => item.category))];
  const filtered = useMemo(() => beneficiaries.filter((item) => {
    const haystack = `${item.referralCode} ${item.name} ${item.groupName} ${item.venueLocation}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase()))
      && (!category || item.category === category);
  }), [beneficiaries, category, query]);

  function exportReport() {
    const rows = [
      ["ID Referral", "Nama Warga", "Kelompok/Sanggar", "Lokasi Sanggar", "Subsektor Ekraf", "Omzet/Nilai Tampil", "Status"],
      ...beneficiaries.map((item) => [
        item.referralCode,
        item.name,
        item.groupName,
        item.venueLocation,
        item.category,
        item.achievementValue,
        item.status,
      ]),
    ];
    const blob = new Blob([rows.map((row) => row.map(escapeCsv).join(",")).join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "laporan-pembinaan-disbudpar.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return <section aria-labelledby="creative-report-title">
    <div className={styles.pageHeading}>
      <div>
        <h1 id="creative-report-title">Laporan Pembinaan Budpar &amp; Ekonomi Kreatif</h1>
        <p>Rekapitulasi pencapaian pembinaan sanggar, distribusi bantuan peralatan seni, dan evaluasi kemandirian pelaku ekraf MBI.</p>
      </div>
      <button className={styles.primary} onClick={exportReport}><Download size={17} /> Export Laporan (Excel/PDF)</button>
    </div>

    <div className={styles.summaryGrid}>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><Palette size={27} /></span><div><p>Total Mandiri Karya &amp; Seni</p><strong>{summary.independent} <small>Pelaku Ekraf/Sanggar</small></strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><WalletCards size={27} /></span><div><p>Total Estimasi Omzet / Nilai Tampil</p><strong>{rupiah.format(summary.totalAchievement)}</strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><BarChart3 size={27} /></span><div><p>Rata-rata Omzet / Pelaku Ekraf</p><strong>{rupiah.format(summary.averageAchievement)}</strong></div></article>
    </div>

    <section className={styles.card} aria-label="Laporan pembinaan Disbudpar">
      <div className={styles.filters}>
        <input style={{ minWidth: 430 }} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari NIK, Nama Warga, atau Subsektor Ekraf..." aria-label="Cari laporan pembinaan" />
        <div className={styles.filterControls}>
          <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Subsektor ekraf"><option value="">Semua Subsektor Ekraf</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
          <select aria-label="Status kemandirian" defaultValue="MANDIRI"><option value="MANDIRI">Status Kemandirian (Mandiri)</option></select>
        </div>
      </div>
      <div className={styles.desktopTable}>
        <table>
          <thead><tr><th>ID Referral &amp; Nama Warga</th><th>Subsektor &amp; Lokasi Sanggar</th><th>Capaian Omzet / Nilai Tampil</th><th>Status Kemandirian</th><th>Aksi</th></tr></thead>
          <tbody>{filtered.map((item) => <tr key={item.id}>
            <td><strong>{item.name}</strong><span className={styles.muted}>{item.maskedNik}<br />{item.referralCode}</span></td>
            <td><strong>{item.category}</strong><span className={styles.muted}>{item.venueLocation}<br />{item.groupName}</span></td>
            <td>{rupiah.format(item.achievementValue)} / Bulan</td>
            <td><span className={`${styles.badge} ${styles.badgeGreen}`}>Mandiri Karya &amp; Seni</span></td>
            <td><button className={styles.action} onClick={() => setSelected(item)}><Eye size={16} /> Detail</button></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className={styles.mobileCards}>{filtered.map((item) => <article key={item.id}>
        <header><div><h3>{item.name}</h3><span className={styles.muted}>{item.referralCode}<br />{item.maskedNik}</span></div><span className={`${styles.badge} ${styles.badgeGreen}`}>Mandiri Karya &amp; Seni</span></header>
        <dl><div><dt>Subsektor / Lokasi</dt><dd>{item.category}<br />{item.venueLocation}</dd></div><div><dt>Omzet / Nilai Tampil</dt><dd>{rupiah.format(item.achievementValue)}</dd></div></dl>
        <button className={styles.action} onClick={() => setSelected(item)}><Eye size={16} /> Detail</button>
      </article>)}</div>
      {!filtered.length && <p className={styles.emptyState}>Belum ada hasil pembinaan yang sesuai filter.</p>}
      <nav className={styles.pagination} aria-label="Halaman laporan"><p>Menampilkan 1–{filtered.length} dari {beneficiaries.length} data</p><div className={styles.pages}><span><ChevronLeft size={15} /></span><strong aria-current="page">1</strong><span><ChevronRight size={15} /></span></div></nav>
    </section>

    {selected && <Drawer title={`Detail Rekap Pembinaan — ${selected.referralCode}`} close={() => setSelected(null)} footer={<><button className={styles.secondary} onClick={() => window.print()}><Download size={16} /> Unduh Laporan (PDF)</button><button className={styles.secondary} onClick={() => setSelected(null)}>Tutup</button></>}>
      <div className={styles.detailStack}>
        <div className={styles.identity}><small>Nama Warga</small><h3>{selected.name} ({selected.maskedNik})</h3><p>Subsektor &amp; Lokasi Sanggar<br />{selected.category} ({selected.venueLocation})</p><span className={`${styles.badge} ${styles.badgeGreen}`}>Mandiri Karya &amp; Seni</span></div>
        <div className={styles.summaryGrid} style={{ marginBottom: 0 }}>
          <div className={styles.detailBox}><small>Sarana / Fasilitas Utama</small><strong>{selected.aidPackage}</strong></div>
          <div className={styles.detailBox}><small>Capaian Omzet / Nilai Tampil</small><strong>{rupiah.format(selected.achievementValue)} / Bulan</strong></div>
        </div>
        <section><h2>Riwayat Aktivitas &amp; Hasil Pembinaan</h2><div className={styles.timeline}>{selected.history.map((entry) => <div key={entry.id}><span className={styles.muted}>{entry.period}</span><p>{entry.status === "TERVERIFIKASI" ? "Capaian pembinaan terverifikasi" : "Menunggu verifikasi"} — {rupiah.format(entry.amount)}</p></div>)}</div>{!selected.history.length && <p className={styles.emptyState}>Belum ada riwayat capaian pembinaan.</p>}</section>
      </div>
    </Drawer>}
  </section>;
}
