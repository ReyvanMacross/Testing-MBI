"use client";

import { BriefcaseBusiness, ChevronLeft, ChevronRight, GraduationCap, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

import type { DisnakerProgram, DisnakerReferral, DisnakerReferralStatus } from "@/lib/disnaker/data";
import { Dialog, Drawer } from "@/components/disnaker/shared/dialog";
import styles from "@/components/disnaker/shared/disnaker-ui.module.css";

type Mode = "start" | "update" | "detail" | null;

function StatusBadge({ status }: { status: DisnakerReferralStatus }) {
  const label = status === "PERLU_DIPROSES" ? "Perlu Diproses" : status === "SEDANG_PELATIHAN" ? "Sedang Pelatihan" : "Bekerja / Selesai";
  const tone = status === "PERLU_DIPROSES" ? styles.badgeAmber : status === "BEKERJA_SELESAI" ? styles.badgeGreen : "";
  return <span className={`${styles.badge} ${tone}`}>{label}</span>;
}

export function DisnakerDashboard({ initialReferrals, programs, summary, preview }: {
  initialReferrals: DisnakerReferral[];
  programs: DisnakerProgram[];
  summary: { newReferrals: number; inTraining: number; placed: number };
  preview: boolean;
}) {
  const [referrals, setReferrals] = useState(initialReferrals);
  const [selected, setSelected] = useState<DisnakerReferral | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [notice, setNotice] = useState("");
  const filtered = useMemo(() => referrals.filter((item) =>
    (!statusFilter || item.status === statusFilter) && (!programFilter || item.program === programFilter),
  ), [referrals, statusFilter, programFilter]);

  function open(item: DisnakerReferral, nextMode: Exclude<Mode, null>) {
    setSelected(item); setMode(nextMode); setNotice("");
  }
  function close() { setSelected(null); setMode(null); }

  async function submitStart(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    if (!selected.isPreview) {
      const response = await fetch(`/api/disnaker/referrals/${selected.id}/start`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ programId: form.get("programId"), institution: form.get("institution"), startDate: form.get("startDate"), instruction: form.get("instruction") }),
      });
      if (!response.ok) { const body = await response.json().catch(() => ({})); setNotice(body.error ?? "Intervensi tidak dapat dimulai."); return; }
    }
    setReferrals((items) => items.map((item) => item.id === selected.id ? { ...item, status: "SEDANG_PELATIHAN" } : item));
    setNotice("Intervensi dimulai dan referral masuk ke tahap pelatihan.");
    window.setTimeout(close, 700);
  }

  async function submitUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    if (!selected.isPreview) {
      const response = await fetch(`/api/disnaker/referrals/${selected.id}/complete`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ placementPartner: form.get("placementPartner"), placementDate: form.get("placementDate"), evaluation: form.get("evaluation") }),
      });
      if (!response.ok) { const body = await response.json().catch(() => ({})); setNotice(body.error ?? "Progress tidak dapat disimpan."); return; }
    }
    setReferrals((items) => items.map((item) => item.id === selected.id ? {
      ...item, status: "BEKERJA_SELESAI", placementPartner: String(form.get("placementPartner")),
      placementDate: String(form.get("placementDate")), evaluation: String(form.get("evaluation")),
    } : item));
    setNotice("Intervensi selesai dan hasil penempatan tersimpan.");
    window.setTimeout(close, 700);
  }

  const programNames = [...new Set(referrals.map((item) => item.program))];
  return <section aria-labelledby="disnaker-title">
    <div className={styles.pageHeading}><div><h1 id="disnaker-title">Rujukan Masuk &amp; Intervensi</h1><p>Pengelolaan dan pemantauan warga penerima jalur intervensi PEKERJA</p></div></div>
    <div className={styles.summaryGrid}>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><TriangleAlert size={27} /></span><div><p>Rujukan Baru<br />(Perlu Tindak Lanjut)</p><strong>{summary.newReferrals}</strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><GraduationCap size={27} /></span><div><p>Warga Dalam Pelatihan</p><strong>{summary.inTraining}</strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><BriefcaseBusiness size={27} /></span><div><p>Berhasil<br />Ditempatkan Kerja</p><strong>{summary.placed}</strong></div></article>
    </div>
    <section className={styles.card} aria-label="Daftar rujukan masuk">
      {preview && <p className={styles.previewNote}>Pratinjau aman ditampilkan karena belum ada referral PEKERJA pada database. Semua NIK pada pratinjau sudah disamarkan.</p>}
      <div className={styles.filters}><h2>Daftar Rujukan Masuk</h2><div className={styles.filterControls}>
        <select aria-label="Filter status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Semua Status</option><option value="PERLU_DIPROSES">Perlu Diproses</option><option value="SEDANG_PELATIHAN">Sedang Pelatihan</option><option value="BEKERJA_SELESAI">Bekerja / Selesai</option></select>
        <select aria-label="Filter program" value={programFilter} onChange={(event) => setProgramFilter(event.target.value)}><option value="">Semua Program</option>{programNames.map((name) => <option key={name}>{name}</option>)}</select>
      </div></div>
      <div className={styles.desktopTable}><table><thead><tr><th>ID Rujukan / Warga</th><th>Tanggal</th><th>Program / Intervensi</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><span className={styles.muted}>{item.maskedNik}<br />{item.code}</span></td><td>{item.date}</td><td>{item.program}</td><td><StatusBadge status={item.status} /></td><td>{item.status === "PERLU_DIPROSES" ? <button className={`${styles.action} ${styles.actionPrimary}`} onClick={() => open(item, "start")}>Proses Intervensi</button> : item.status === "SEDANG_PELATIHAN" ? <button className={styles.action} onClick={() => open(item, "update")}>Update Progress</button> : <button className={styles.action} onClick={() => open(item, "detail")}>Detail</button>}</td></tr>)}</tbody></table></div>
      <div className={styles.mobileCards}>{filtered.map((item) => <article key={item.id}><header><div><h3>{item.name}</h3><span className={styles.muted}>{item.maskedNik}<br />{item.code}</span></div><StatusBadge status={item.status} /></header><dl><div><dt>Tanggal</dt><dd>{item.date}</dd></div><div><dt>Program</dt><dd>{item.program}</dd></div></dl><button className={`${styles.action} ${item.status === "PERLU_DIPROSES" ? styles.actionPrimary : ""}`} onClick={() => open(item, item.status === "PERLU_DIPROSES" ? "start" : item.status === "SEDANG_PELATIHAN" ? "update" : "detail")}>{item.status === "PERLU_DIPROSES" ? "Proses Intervensi" : item.status === "SEDANG_PELATIHAN" ? "Update Progress" : "Detail"}</button></article>)}</div>
      <nav className={styles.pagination} aria-label="Halaman rujukan"><p>Menampilkan 1–{filtered.length} dari {preview ? "245" : referrals.length} data</p><div className={styles.pages}><span><ChevronLeft size={15} /></span><strong aria-current="page">1</strong><span>2</span><span>3</span><span>…</span><span>13</span><span><ChevronRight size={15} /></span></div></nav>
    </section>
    {selected && mode === "start" && <Dialog title={`Proses Intervensi Vokasi — ${selected.code}`} close={close} footer={<><button className={styles.secondary} onClick={close}>Batal</button><button className={styles.primary} type="submit" form="start-intervention">Simpan &amp; Mulai Pelatihan</button></>}><form id="start-intervention" className={styles.form} onSubmit={submitStart}>
      <div className={styles.identity}><small>Identitas Warga</small><h3>{selected.name}</h3><p>NIK: {selected.maskedNik} | Desil: Desil {selected.desil || "—"} | Kelurahan: {selected.kelurahan}</p><span className={styles.badge}>Pekerja</span></div>
      <label>Program Vokasi Spesifik<select name="programId" defaultValue={programs.find((item) => item.name.includes(selected.program.split(" ")[1] ?? ""))?.id ?? programs[0]?.id} required>{programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select></label>
      <label>Lembaga Pelaksana / BLK Target<select name="institution" defaultValue={selected.institution} required><option>{selected.institution}</option><option>BLK Kota Bandung (Bidang Teknik &amp; Manufaktur)</option><option>LPK Otomotif Mandiri</option></select></label>
      <label>Tanggal Mulai Pelatihan<input type="date" name="startDate" defaultValue="2026-09-15" required /></label>
      <label>Catatan Instruksi untuk Peserta<textarea name="instruction" defaultValue={selected.instruction} minLength={10} maxLength={2000} required /></label>
      {notice && <p role="status">{notice}</p>}
    </form></Dialog>}
    {selected && mode === "update" && <Dialog title={`Update Progress Intervensi — ${selected.code}`} close={close} footer={<><button className={styles.secondary} onClick={close}>Batal</button><button className={styles.primary} type="submit" form="update-intervention">Simpan &amp; Selesaikan Intervensi</button></>}><form id="update-intervention" className={styles.form} onSubmit={submitUpdate}>
      <div className={styles.identity}><small>Identitas Warga</small><h3>{selected.name} ({selected.maskedNik})</h3><div className={styles.twoColumns}><p>Desil {selected.desil} | {selected.kelurahan}</p><p>{selected.program} ({selected.institution})</p></div><StatusBadge status={selected.status} /></div>
      <label>Status Intervensi Baru<select name="status" defaultValue="BEKERJA_SELESAI"><option value="BEKERJA_SELESAI">Berhasil Ditempatkan Kerja (Selesai)</option></select></label>
      <label>Perusahaan / Mitra Penempatan<input name="placementPartner" defaultValue={selected.placementPartner ?? ""} minLength={3} maxLength={200} required /></label>
      <label>Tanggal Penempatan Kerja<input name="placementDate" type="date" defaultValue="2026-08-21" required /></label>
      <label>Catatan Evaluasi Disnaker<textarea name="evaluation" defaultValue={selected.evaluation ?? ""} minLength={10} maxLength={2000} required /></label>
      {notice && <p role="status">{notice}</p>}
    </form></Dialog>}
    {selected && mode === "detail" && <Drawer title={`Detail Intervensi Warga — ${selected.code}`} close={close} footer={<><button className={styles.secondary} type="button" onClick={() => window.print()}>Cetak Berkas Penempatan</button><button className={styles.warning} type="button" onClick={close}>Tutup</button></>}><div className={styles.detailStack}>
      <div className={styles.identity}><small>Identitas Warga</small><h3>{selected.name}</h3><p>{selected.maskedNik} | Desil: Desil {selected.desil} | Kelurahan: {selected.kelurahan}</p><div style={{marginTop:16,display:"flex",gap:10}}><span className={styles.badge}>Pekerja</span><StatusBadge status={selected.status} /></div></div>
      <div className={styles.detailBox}><small>Program Vokasi</small><strong>{selected.program}</strong></div>
      <div className={styles.detailBox}><small>Lembaga Pelaksana</small><strong>{selected.institution}</strong></div>
      <div className={styles.detailBox}><small>Mitra Tempat Kerja</small><strong>{selected.placementPartner ?? "—"}</strong></div>
      <div className={styles.detailBox}><small>Tanggal Mulai Bekerja</small><strong>{selected.placementDate ?? "—"}</strong></div>
      <section><h3>Catatan Evaluasi Akhir</h3><div className={styles.detailBox}>{selected.evaluation ?? "Belum ada catatan evaluasi."}</div></section>
    </div></Drawer>}
  </section>;
}
