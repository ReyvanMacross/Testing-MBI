"use client";

import { BarChart3, ChevronLeft, ChevronRight, Download, Eye, Leaf, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";

import { Drawer } from "@/components/dkpp/shared/dialog";
import styles from "@/components/dkpp/shared/dkpp-ui.module.css";
import type { FoodReport } from "@/lib/dkpp/data";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function escapeCsv(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function HarvestReport({
  beneficiaries,
  summary,
}: {
  beneficiaries: FoodReport[];
  summary: { independent: number; totalHarvest: number; averageHarvest: number };
}) {
  const [selected, setSelected] = useState<FoodReport | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const categories = [...new Set(beneficiaries.map((item) => item.category))];
  const filtered = useMemo(() => beneficiaries.filter((item) => {
    const haystack = `${item.referralCode} ${item.name} ${item.groupName} ${item.plotLocation}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase()))
      && (!category || item.category === category);
  }), [beneficiaries, category, query]);

  function exportReport() {
    const rows = [
      ["ID Referral", "Nama Warga", "Kelompok", "Lokasi Demplot", "Kategori Program", "Nilai Panen", "Status"],
      ...beneficiaries.map((item) => [
        item.referralCode,
        item.name,
        item.groupName,
        item.plotLocation,
        item.category,
        item.harvestValue,
        item.status,
      ]),
    ];
    const blob = new Blob([rows.map((row) => row.map(escapeCsv).join(",")).join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "laporan-ketahanan-pangan-dkpp.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return <section aria-labelledby="harvest-report-title">
    <div className={styles.pageHeading}>
      <div>
        <h1 id="harvest-report-title">Laporan Ketahanan Pangan &amp; Usaha Agro</h1>
        <p>Rekapitulasi pencapaian panen, distribusi bantuan bibit, dan evaluasi kemandirian pangan keluarga.</p>
      </div>
      <button className={styles.primary} onClick={exportReport}><Download size={17} /> Export Laporan (Excel/PDF)</button>
    </div>

    <div className={styles.summaryGrid}>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><Leaf size={27} /></span><div><p>Total Mandiri Pangan</p><strong>{summary.independent} <small>Kelompok/Keluarga</small></strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><WalletCards size={27} /></span><div><p>Total Estimasi Nilai Panen</p><strong>{rupiah.format(summary.totalHarvest)}</strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><BarChart3 size={27} /></span><div><p>Rata-rata Nilai Panen / Poktan</p><strong>{rupiah.format(summary.averageHarvest)}</strong></div></article>
    </div>

    <section className={styles.card} aria-label="Laporan ketahanan pangan">
      <div className={styles.filters}>
        <input style={{ minWidth: 430 }} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari NIK, Nama Warga, atau Kelompok Tani..." aria-label="Cari laporan pangan" />
        <div className={styles.filterControls}>
          <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Kategori program"><option value="">Semua Kategori Program</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
          <select aria-label="Status kemandirian" defaultValue="MANDIRI"><option value="MANDIRI">Status Kemandirian (Mandiri)</option></select>
        </div>
      </div>
      <div className={styles.desktopTable}>
        <table>
          <thead><tr><th>ID Referral &amp; Nama Warga</th><th>Jenis Bantuan &amp; Lokasi</th><th>Capaian Harvest / Omzet</th><th>Status Ketahanan</th><th>Aksi</th></tr></thead>
          <tbody>{filtered.map((item) => <tr key={item.id}>
            <td><strong>{item.name}</strong><span className={styles.muted}>{item.maskedNik}<br />{item.referralCode}</span></td>
            <td><strong>{item.category}</strong><span className={styles.muted}>{item.plotLocation}<br />{item.groupName}</span></td>
            <td>{rupiah.format(item.harvestValue)} / Panen</td>
            <td><span className={`${styles.badge} ${styles.badgeGreen}`}>Mandiri Pangan</span></td>
            <td><button className={styles.action} onClick={() => setSelected(item)}><Eye size={16} /> Detail</button></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className={styles.mobileCards}>{filtered.map((item) => <article key={item.id}>
        <header><div><h3>{item.name}</h3><span className={styles.muted}>{item.referralCode}<br />{item.maskedNik}</span></div><span className={`${styles.badge} ${styles.badgeGreen}`}>Mandiri Pangan</span></header>
        <dl><div><dt>Bantuan / Lokasi</dt><dd>{item.category}<br />{item.plotLocation}</dd></div><div><dt>Nilai Panen</dt><dd>{rupiah.format(item.harvestValue)}</dd></div></dl>
        <button className={styles.action} onClick={() => setSelected(item)}><Eye size={16} /> Detail</button>
      </article>)}</div>
      {!filtered.length && <p className={styles.emptyState}>Belum ada hasil ketahanan pangan yang sesuai filter.</p>}
      <nav className={styles.pagination} aria-label="Halaman laporan"><p>Menampilkan 1–{filtered.length} dari {beneficiaries.length} data</p><div className={styles.pages}><span><ChevronLeft size={15} /></span><strong aria-current="page">1</strong><span><ChevronRight size={15} /></span></div></nav>
    </section>

    {selected && <Drawer title={`Detail Rekap Ketahanan Pangan — ${selected.referralCode}`} close={() => setSelected(null)} footer={<><button className={styles.secondary} onClick={() => window.print()}><Download size={16} /> Unduh Laporan (PDF)</button><button className={styles.secondary} onClick={() => setSelected(null)}>Tutup</button></>}>
      <div className={styles.detailStack}>
        <div className={styles.identity}><small>Nama Warga</small><h3>{selected.name} ({selected.maskedNik})</h3><p>Jenis Bantuan &amp; Lokasi<br />{selected.category} ({selected.plotLocation})</p><span className={`${styles.badge} ${styles.badgeGreen}`}>Mandiri Pangan</span></div>
        <div className={styles.summaryGrid} style={{ marginBottom: 0 }}>
          <div className={styles.detailBox}><small>Sarana / Fasilitas Utama</small><strong>{selected.aidPackage}</strong></div>
          <div className={styles.detailBox}><small>Capaian Harvest / Omzet</small><strong>{rupiah.format(selected.harvestValue)} / Panen</strong></div>
        </div>
        <section><h2>Riwayat Aktivitas &amp; Hasil Panen</h2><div className={styles.timeline}>{selected.history.map((entry) => <div key={entry.id}><span className={styles.muted}>{entry.period}</span><p>{entry.status === "TERVERIFIKASI" ? "Hasil panen terverifikasi" : "Menunggu verifikasi"} — {rupiah.format(entry.amount)}</p></div>)}</div>{!selected.history.length && <p className={styles.emptyState}>Belum ada riwayat hasil panen.</p>}</section>
      </div>
    </Drawer>}
  </section>;
}
