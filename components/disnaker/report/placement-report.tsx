"use client";

import { BriefcaseBusiness, ChevronLeft, ChevronRight, Download, GraduationCap, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";

import { Dialog } from "@/components/disnaker/shared/dialog";
import styles from "@/components/disnaker/shared/disnaker-ui.module.css";
import type { DisnakerReferral, PlacementPartner } from "@/lib/disnaker/data";

export function PlacementReport({ partners, referrals }: { partners: PlacementPartner[]; referrals: DisnakerReferral[] }) {
  const [selected, setSelected] = useState<PlacementPartner | null>(null);
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const filtered = useMemo(() => partners.filter((partner) =>
    (!query || `${partner.name} ${partner.program}`.toLowerCase().includes(query.toLowerCase())) && (!sector || partner.sector === sector),
  ), [partners, query, sector]);
  const sectors = [...new Set(partners.map((partner) => partner.sector))];
  const workers = referrals.filter((item) => item.status === "BEKERJA_SELESAI" || item.status === "SEDANG_PELATIHAN").slice(0, 2);

  function exportCsv() {
    const rows = [["Nama Perusahaan", "Sektor", "Warga Diserap", "Program", "Status"], ...partners.map((item) => [item.name, item.sector, String(item.absorbed), item.program, item.status])];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "laporan-penempatan-disnaker.csv"; link.click(); URL.revokeObjectURL(url);
  }

  return <section aria-labelledby="report-title">
    <div className={styles.pageHeading}><div><h1 id="report-title">Laporan Penempatan Kerja MBI</h1><p>Rekapitulasi warga MBI yang berhasil ditempatkan kerja dan peta kemitraan industri</p></div><button className={styles.primary} onClick={exportCsv}><Download size={17} /> Export Laporan (Excel/PDF)</button></div>
    <div className={styles.summaryGrid}>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><BriefcaseBusiness size={27} /></span><div><p>Total Berhasil<br />Ditempatkan</p><strong>185 <small>Warga</small></strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><GraduationCap size={27} /></span><div><p>Tingkat Penempatan<br />Kerja</p><strong>82%</strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><UsersRound size={27} /></span><div><p>Perusahaan Mitra<br />Penyerap</p><strong>34 <small>Perusahaan</small></strong></div></article>
    </div>
    <section className={styles.card} aria-label="Daftar mitra penempatan">
      <div className={styles.filters}><input style={{minWidth:420}} type="search" placeholder="Cari nama perusahaan atau program..." aria-label="Cari perusahaan" value={query} onChange={(event) => setQuery(event.target.value)} /><div className={styles.filterControls}><select value={sector} onChange={(event) => setSector(event.target.value)} aria-label="Sektor industri"><option value="">Semua Sektor Industri</option>{sectors.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Status kemitraan"><option>Semua Kemitraan (AKTIF)</option></select></div></div>
      <div className={styles.desktopTable}><table><thead><tr><th>Nama Perusahaan Mitra</th><th>Sektor Industri</th><th>Warga Diserap</th><th>Program Pelatihan Terkait</th><th>Status Kemitraan</th><th>Aksi</th></tr></thead><tbody>{filtered.map((partner) => <tr key={partner.id}><td><strong>{partner.name}</strong></td><td>{partner.sector}</td><td>{partner.absorbed} Warga</td><td>{partner.program}</td><td><span className={`${styles.badge} ${styles.badgeGreen}`}>{partner.status}</span></td><td><button className={styles.action} onClick={() => setSelected(partner)}>Detail Penempatan</button></td></tr>)}</tbody></table></div>
      <div className={styles.mobileCards}>{filtered.map((partner) => <article key={partner.id}><header><div><h3>{partner.name}</h3><span className={styles.muted}>{partner.sector}</span></div><span className={`${styles.badge} ${styles.badgeGreen}`}>{partner.status}</span></header><dl><div><dt>Warga Diserap</dt><dd>{partner.absorbed} Warga</dd></div><div><dt>Program</dt><dd>{partner.program}</dd></div></dl><button className={styles.action} onClick={() => setSelected(partner)}>Detail Penempatan</button></article>)}</div>
      <nav className={styles.pagination}><p>Menampilkan 1–{filtered.length} dari 34 Perusahaan</p><div className={styles.pages}><span><ChevronLeft size={15} /></span><strong>1</strong><span>2</span><span>3</span><span>…</span><span>13</span><span><ChevronRight size={15} /></span></div></nav>
    </section>
    {selected && <Dialog wide title={`Detail Penempatan Kerja — ${selected.name}`} close={() => setSelected(null)} footer={<><button className={styles.secondary} onClick={() => window.print()}><Download size={16} /> Unduh Daftar Pekerja (PDF)</button><button className={styles.secondary} onClick={() => setSelected(null)}>Tutup</button></>}><div className={styles.detailStack}>
      <div className={styles.identity}><small>Profil Kemitraan Industri</small><h2 style={{margin:"4px 0",color:"#0d4fa3"}}>{selected.name}</h2><p>Sektor: {selected.sector} &nbsp; | &nbsp; <span className={`${styles.badge} ${styles.badgeGreen}`}>Aktif</span></p><div style={{position:"absolute",right:22,top:22,padding:"14px 20px",border:"1px solid #173969",background:"#dce8ff",textAlign:"center"}}><small>Total Warga Diserap</small><strong style={{display:"block"}}>{selected.absorbed} Warga MBI</strong></div></div>
      <div className={styles.desktopTable}><table><thead><tr><th>ID Referral</th><th>NIK &amp; Nama Warga</th><th>Program Vokasi Terkait</th><th>Tanggal Bekerja</th><th>Status Pekerja</th></tr></thead><tbody>{workers.map((worker) => <tr key={worker.id}><td>{worker.code}</td><td><strong>{worker.name}</strong><span className={styles.muted}>{worker.maskedNik}</span></td><td>{worker.program}</td><td>{worker.placementDate ?? "21/08/2026"}</td><td><span className={`${styles.badge} ${styles.badgeGreen}`}>Aktif Bekerja</span></td></tr>)}</tbody></table></div>
      <nav className={styles.pagination}><p>Menampilkan 1–{workers.length} dari {selected.absorbed} pekerja</p><div className={styles.pages}><span><ChevronLeft size={15} /></span><strong>1</strong><span>2</span><span>3</span><span>…</span><span>13</span><span><ChevronRight size={15} /></span></div></nav>
    </div></Dialog>}
  </section>;
}
