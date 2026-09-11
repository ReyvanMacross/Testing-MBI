"use client";

import { ChevronLeft, ChevronRight, Download, Eye, Store, TrendingUp, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";

import { Drawer } from "@/components/disdagin/shared/dialog";
import styles from "@/components/disdagin/shared/disdagin-ui.module.css";
import type { BusinessReport } from "@/lib/disdagin/data";

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function RevenueReport({ businesses, summary }: {
  businesses: BusinessReport[];
  summary: { independent: number; totalRevenue: number; averageRevenue: number };
}) {
  const [selected, setSelected] = useState<BusinessReport | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const categories = [...new Set(businesses.map((business) => business.category))];
  const filtered = useMemo(() => businesses.filter((business) => {
    const haystack = `${business.referralCode} ${business.name} ${business.businessName} ${business.nib}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase())) && (!category || business.category === category);
  }), [businesses, category, query]);

  function exportCsv() {
    const rows: Array<Array<string | number>> = [
      ["ID Referral", "Nama Warga", "Nama Usaha", "NIB", "Kategori", "Omzet Bulanan", "Status"],
      ...businesses.map((business) => [business.referralCode, business.name, business.businessName, business.nib, business.category, business.monthlyRevenue, business.status]),
    ];
    const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "laporan-omzet-kemandirian-umkm.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return <section aria-labelledby="revenue-report-title">
    <div className={styles.pageHeading}>
      <div><h1 id="revenue-report-title">Laporan Pemasaran &amp; Penetrasi Pasar UMKM</h1><p>Rekapitulasi pencapaian omzet pameran, jaringan retail, dan penetrasi pasar produk UMKM MBI.</p></div>
      <button className={styles.primary} onClick={exportCsv} disabled={!businesses.length}><Download size={17} /> Export Laporan (CSV)</button>
    </div>

    <div className={styles.summaryGrid}>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><Store size={27} /></span><div><p>Total UMKM Penetrasi Pasar</p><strong>{summary.independent} <small>Usaha</small></strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><WalletCards size={27} /></span><div><p>Total Transaksi Pameran &amp; Retail</p><strong>{rupiah.format(summary.totalRevenue)}</strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><TrendingUp size={27} /></span><div><p>Rata-rata Penjualan / Event</p><strong>{rupiah.format(summary.averageRevenue)} <small>/bln</small></strong></div></article>
    </div>

    <section className={styles.card} aria-label="Laporan usaha mandiri">
      <div className={styles.filters}>
        <input style={{ minWidth: 430 }} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari NIK, Nama Warga, atau Nomor NIB..." aria-label="Cari laporan usaha" />
        <div className={styles.filterControls}><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Kategori usaha"><option value="">Semua Kategori Usaha</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Status kemandirian" defaultValue="MANDIRI"><option value="MANDIRI">Status Penetrasi (Mitra Retail)</option></select></div>
      </div>
      <div className={styles.desktopTable}><table><thead><tr><th>ID Referral &amp; Nama Warga</th><th>Jenis Usaha &amp; NIB</th><th>Kategori Usaha</th><th>Transaksi / Omzet Event</th><th>Status Penetrasi</th><th>Aksi</th></tr></thead><tbody>{filtered.map((business) => <tr key={business.id}>
        <td><strong>{business.name}</strong><span className={styles.muted}>{business.referralCode}<br />{business.maskedNik}</span></td>
        <td><strong>{business.businessName}</strong><span className={styles.muted}>NIB: {business.nib}</span></td>
        <td><span className={styles.badge}>{business.category}</span></td><td>{rupiah.format(business.monthlyRevenue)}</td>
        <td><span className={`${styles.badge} ${styles.badgeGreen}`}>Mitra Retail</span></td><td><button className={styles.action} onClick={() => setSelected(business)}><Eye size={16} /> Detail</button></td>
      </tr>)}</tbody></table></div>
      <div className={styles.mobileCards}>{filtered.map((business) => <article key={business.id}><header><div><h3>{business.name}</h3><span className={styles.muted}>{business.referralCode}<br />{business.maskedNik}</span></div><span className={`${styles.badge} ${styles.badgeGreen}`}>Mitra Retail</span></header><dl><div><dt>Usaha / NIB</dt><dd>{business.businessName}<br />{business.nib}</dd></div><div><dt>Omzet / Bulan</dt><dd>{rupiah.format(business.monthlyRevenue)}</dd></div></dl><button className={styles.action} onClick={() => setSelected(business)}><Eye size={16} /> Detail</button></article>)}</div>
      {!filtered.length && <p className={styles.emptyState}>Belum ada usaha mandiri yang sesuai filter.</p>}
      <nav className={styles.pagination} aria-label="Halaman laporan"><p>Menampilkan 1–{filtered.length} dari {businesses.length} usaha</p><div className={styles.pages}><span><ChevronLeft size={15} /></span><strong aria-current="page">1</strong><span><ChevronRight size={15} /></span></div></nav>
    </section>

    {selected && <Drawer title={`Detail Rekap Pemasaran — ${selected.referralCode}`} close={() => setSelected(null)} footer={<><button className={styles.secondary} onClick={() => window.print()}><Download size={16} /> Unduh Laporan</button><button className={styles.secondary} onClick={() => setSelected(null)}>Tutup</button></>}>
      <div className={styles.detailStack}>
        <div className={styles.identity}><h3>{selected.name}</h3><p>NIK: {selected.maskedNik}<br />NIB: {selected.nib}<br />Desil: {selected.desil || "—"} | Kelurahan: {selected.kelurahan}<br />Jenis Usaha: {selected.businessName}</p><span className={`${styles.badge} ${styles.badgeGreen}`}>Mitra Retail</span></div>
        <div className={styles.summaryGrid} style={{ marginBottom: 0 }}><div className={styles.detailBox}><small>Omzet Saat Ini</small><strong>{rupiah.format(selected.monthlyRevenue)} / bln</strong></div><div className={styles.detailBox}><small>Pertumbuhan</small><strong style={{ color: selected.growthPercent >= 0 ? "#236b39" : "#a12a2a" }}>{selected.growthPercent >= 0 ? "+" : ""}{selected.growthPercent}%</strong></div><div className={styles.detailBox}><small>Status Bantuan</small><strong>{selected.stimulus}</strong></div></div>
        <section><h2>Riwayat Penjualan & Event</h2><div className={styles.desktopTable}><table><thead><tr><th>Periode</th><th>Nominal</th><th>Status</th></tr></thead><tbody>{selected.history.map((entry) => <tr key={entry.id}><td>{entry.period}</td><td>{rupiah.format(entry.amount)}</td><td><span className={styles.badge}>{entry.status === "TERVERIFIKASI" ? "Verifikasi" : "Menunggu"}</span></td></tr>)}</tbody></table></div>{!selected.history.length && <p className={styles.emptyState}>Belum ada riwayat pelaporan omzet.</p>}</section>
      </div>
    </Drawer>}
  </section>;
}
