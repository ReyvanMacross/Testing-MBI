"use client";

import { BriefcaseBusiness, ChevronLeft, ChevronRight, GraduationCap, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { Dialog, Drawer } from "@/components/disnaker/shared/dialog";
import styles from "@/components/disnaker/shared/disnaker-ui.module.css";
import type {
  DisnakerIndustryPartner,
  DisnakerParticipantStatus,
  DisnakerProgram,
  DisnakerProvider,
  DisnakerReferral,
  DisnakerReferralStatus,
} from "@/lib/disnaker/data";

type Mode = "start" | "progress" | "complete" | "detail" | null;

function StatusBadge({ status }: { status: DisnakerReferralStatus }) {
  const label = status === "PERLU_DIPROSES" ? "Perlu Diproses" : status === "SEDANG_PELATIHAN" ? "Sedang Pelatihan" : "Bekerja / Selesai";
  const tone = status === "PERLU_DIPROSES" ? styles.badgeAmber : status === "BEKERJA_SELESAI" ? styles.badgeGreen : "";
  return <span className={`${styles.badge} ${tone}`}>{label}</span>;
}

function participantLabel(status: DisnakerParticipantStatus | null) {
  if (status === "LULUS_MAGANG") return "Lulus / Magang";
  if (status === "TIDAK_AKTIF") return "Tidak Aktif";
  if (status === "BEKERJA_SELESAI") return "Bekerja / Selesai";
  return "Aktif Pelatihan";
}

export function DisnakerDashboard({ initialReferrals, programs, providers, partners, summary, preview }: {
  initialReferrals: DisnakerReferral[];
  programs: DisnakerProgram[];
  providers: DisnakerProvider[];
  partners: DisnakerIndustryPartner[];
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
    setSelected(item);
    setMode(nextMode);
    setNotice("");
  }

  function close() {
    setSelected(null);
    setMode(null);
    setNotice("");
  }

  async function submitStart(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const response = preview ? null : await fetch(`/api/disnaker/referrals/${selected.id}/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        programId: form.get("programId"),
        lembagaId: form.get("lembagaId"),
        startDate: form.get("startDate"),
        instruction: form.get("instruction"),
      }),
    });
    const body = response ? await response.json().catch(() => ({})) : { interventionId: `preview-${crypto.randomUUID()}` };
    if (response && !response.ok) {
      setNotice(body.error ?? "Intervensi tidak dapat dimulai.");
      return;
    }
    const selectedProgram = programs.find((program) => program.id === form.get("programId"));
    setReferrals((items) => items.map((item) => item.id === selected.id ? {
      ...item,
      status: "SEDANG_PELATIHAN",
      participantStatus: "AKTIF_PELATIHAN",
      programId: selectedProgram?.id ?? item.programId,
      program: selectedProgram?.name ?? item.program,
      institution: selectedProgram?.institution ?? item.institution,
      lembagaId: selectedProgram?.lembagaId ?? item.lembagaId,
      interventionId: body.interventionId,
      timeline: [...item.timeline, { id: crypto.randomUUID(), type: "STARTED", date: "Hari ini", note: "Program vokasi dimulai.", attendance: null }],
    } : item));
    setNotice("Intervensi dimulai dan referral masuk ke tahap pelatihan.");
    window.setTimeout(close, 700);
  }

  async function submitProgress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected?.interventionId) return;
    const form = new FormData(event.currentTarget);
    const response = preview ? null : await fetch(`/api/disnaker/interventions/${selected.interventionId}/progress`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        statusPeserta: form.get("statusPeserta"),
        kehadiranPersen: Number(form.get("kehadiranPersen")),
        evaluasiInstruktur: form.get("evaluasiInstruktur"),
      }),
    });
    const body = response ? await response.json().catch(() => ({})) : {};
    if (response && !response.ok) {
      setNotice(body.error ?? "Progress tidak dapat disimpan.");
      return;
    }
    const participantStatus = String(form.get("statusPeserta")) as DisnakerParticipantStatus;
    const attendance = Number(form.get("kehadiranPersen"));
    const evaluation = String(form.get("evaluasiInstruktur"));
    setReferrals((items) => items.map((item) => item.id === selected.id ? {
      ...item,
      participantStatus,
      attendance,
      evaluation,
      timeline: [...item.timeline, { id: crypto.randomUUID(), type: "PROGRESS_UPDATED", date: "Hari ini", note: evaluation, attendance }],
    } : item));
    setNotice("Progress peserta tersimpan. Referral tetap dalam tahap diproses.");
    window.setTimeout(close, 700);
  }

  async function submitComplete(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected?.interventionId) return;
    const form = new FormData(event.currentTarget);
    const response = preview ? null : await fetch(`/api/disnaker/interventions/${selected.interventionId}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mitraIndustriId: form.get("mitraIndustriId"),
        placementDate: form.get("placementDate"),
        evaluation: form.get("evaluation"),
      }),
    });
    const body = response ? await response.json().catch(() => ({})) : {};
    if (response && !response.ok) {
      setNotice(body.error ?? "Intervensi tidak dapat diselesaikan.");
      return;
    }
    const partner = partners.find((item) => item.id === form.get("mitraIndustriId"));
    const evaluation = String(form.get("evaluation"));
    setReferrals((items) => items.map((item) => item.id === selected.id ? {
      ...item,
      status: "BEKERJA_SELESAI",
      participantStatus: "BEKERJA_SELESAI",
      mitraIndustriId: partner?.id ?? null,
      placementPartner: partner?.name ?? "Mitra penempatan",
      placementDate: String(form.get("placementDate")),
      evaluation,
      timeline: [...item.timeline, { id: crypto.randomUUID(), type: "COMPLETED", date: "Hari ini", note: "Peserta berhasil ditempatkan kerja.", attendance: item.attendance }],
    } : item));
    setNotice("Intervensi selesai dan penempatan kerja tersimpan.");
    window.setTimeout(close, 700);
  }

  const programNames = [...new Set(referrals.map((item) => item.program))];
  const activePrograms = programs.filter((program) => program.status === "AKTIF");
  const currentSummary = referrals === initialReferrals ? summary : {
      newReferrals: referrals.filter((item) => item.status === "PERLU_DIPROSES").length,
      inTraining: referrals.filter((item) => item.status === "SEDANG_PELATIHAN").length,
      placed: referrals.filter((item) => item.status === "BEKERJA_SELESAI").length,
    };
  return <section aria-labelledby="disnaker-title">
    <div className={styles.pageHeading}><div><h1 id="disnaker-title">Rujukan Masuk &amp; Intervensi</h1><p>Pengelolaan dan pemantauan warga penerima jalur intervensi PEKERJA</p></div></div>
    <div className={styles.summaryGrid}>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><TriangleAlert size={27} /></span><div><p>Rujukan Baru<br />(Perlu Tindak Lanjut)</p><strong>{currentSummary.newReferrals}</strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><GraduationCap size={27} /></span><div><p>Warga Dalam Pelatihan</p><strong>{currentSummary.inTraining}</strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><BriefcaseBusiness size={27} /></span><div><p>Berhasil<br />Ditempatkan Kerja</p><strong>{currentSummary.placed}</strong></div></article>
    </div>
    <section className={styles.card} aria-label="Daftar rujukan masuk">
      {preview && <p className={styles.previewNote}>Mode pratinjau eksplisit aktif untuk pengembangan lokal.</p>}
      <div className={styles.filters}><h2>Daftar Rujukan Masuk</h2><div className={styles.filterControls}>
        <select aria-label="Filter status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Semua Status</option><option value="PERLU_DIPROSES">Perlu Diproses</option><option value="SEDANG_PELATIHAN">Sedang Pelatihan</option><option value="BEKERJA_SELESAI">Bekerja / Selesai</option></select>
        <select aria-label="Filter program" value={programFilter} onChange={(event) => setProgramFilter(event.target.value)}><option value="">Semua Program</option>{programNames.map((name) => <option key={name}>{name}</option>)}</select>
      </div></div>
      <div className={styles.desktopTable}><table><thead><tr><th>ID Rujukan / Warga</th><th>Tanggal</th><th>Program / Intervensi</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><span className={styles.muted}>{item.maskedNik}<br />{item.code}</span></td><td>{item.date}</td><td>{item.program}</td><td><StatusBadge status={item.status} /></td><td>{item.status === "PERLU_DIPROSES" ? <button className={`${styles.action} ${styles.actionPrimary}`} onClick={() => open(item, "start")}>Proses Intervensi</button> : item.status === "SEDANG_PELATIHAN" ? <span style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className={styles.action} onClick={() => open(item, "progress")}>Update Progress</button><button className={`${styles.action} ${styles.actionPrimary}`} onClick={() => open(item, "complete")}>Selesaikan Penempatan</button></span> : <button className={styles.action} onClick={() => open(item, "detail")}>Detail</button>}</td></tr>)}</tbody></table></div>
      <div className={styles.mobileCards}>{filtered.map((item) => <article key={item.id}><header><div><h3>{item.name}</h3><span className={styles.muted}>{item.maskedNik}<br />{item.code}</span></div><StatusBadge status={item.status} /></header><dl><div><dt>Tanggal</dt><dd>{item.date}</dd></div><div><dt>Program</dt><dd>{item.program}</dd></div></dl>{item.status === "PERLU_DIPROSES" ? <button className={`${styles.action} ${styles.actionPrimary}`} onClick={() => open(item, "start")}>Proses Intervensi</button> : item.status === "SEDANG_PELATIHAN" ? <><button className={styles.action} onClick={() => open(item, "progress")}>Update Progress</button><button className={`${styles.action} ${styles.actionPrimary}`} onClick={() => open(item, "complete")}>Selesaikan Penempatan</button></> : <button className={styles.action} onClick={() => open(item, "detail")}>Detail</button>}</article>)}</div>
      {!filtered.length && <p className={styles.emptyState}>Belum ada rujukan PEKERJA yang sesuai filter.</p>}
      <nav className={styles.pagination} aria-label="Halaman rujukan"><p>Menampilkan 1–{filtered.length} dari {referrals.length} data</p><div className={styles.pages}><span><ChevronLeft size={15} /></span><strong aria-current="page">1</strong><span><ChevronRight size={15} /></span></div></nav>
    </section>

    {selected && mode === "start" && <Dialog title={`Proses Intervensi Vokasi — ${selected.code}`} close={close} footer={<><button className={styles.secondary} onClick={close}>Batal</button><button className={styles.primary} type="submit" form="start-intervention">Simpan &amp; Mulai Pelatihan</button></>}><form id="start-intervention" className={styles.form} onSubmit={submitStart}>
      <div className={styles.identity}><small>Identitas Warga</small><h3>{selected.name}</h3><p>NIK: {selected.maskedNik} | Desil: Desil {selected.desil || "—"} | Kelurahan: {selected.kelurahan}</p><span className={styles.badge}>Pekerja</span></div>
      <label>Program Vokasi Spesifik<select name="programId" defaultValue={activePrograms.find((item) => item.id === selected.programId)?.id ?? activePrograms[0]?.id} required>{activePrograms.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select></label>
      <label>Lembaga Pelaksana / BLK Target<select name="lembagaId" defaultValue={selected.lembagaId ?? activePrograms[0]?.lembagaId} required>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>
      <label>Tanggal Mulai Pelatihan<input type="date" name="startDate" required /></label>
      <label>Catatan Instruksi untuk Peserta<textarea name="instruction" defaultValue={selected.instruction} minLength={10} maxLength={2000} required /></label>
      {notice && <p role="status">{notice}</p>}
    </form></Dialog>}

    {selected && mode === "progress" && <Dialog title={`Update Progress Intervensi — ${selected.code}`} close={close} footer={<><button className={styles.secondary} onClick={close}>Batal</button><button className={styles.primary} type="submit" form="progress-intervention">Simpan Progress</button></>}><form id="progress-intervention" className={styles.form} onSubmit={submitProgress}>
      <div className={styles.identity}><small>Identitas Warga</small><h3>{selected.name} ({selected.maskedNik})</h3><p>{selected.program} ({selected.institution})</p><span className={styles.badge}>{participantLabel(selected.participantStatus)}</span></div>
      <label>Status Kehadiran / Keikutsertaan<select name="statusPeserta" defaultValue={selected.participantStatus ?? "AKTIF_PELATIHAN"} required><option value="AKTIF_PELATIHAN">Aktif Pelatihan</option><option value="LULUS_MAGANG">Lulus / Magang</option><option value="TIDAK_AKTIF">Tidak Aktif</option></select></label>
      <label>Persentase Kehadiran (%)<input name="kehadiranPersen" type="number" min="0" max="100" defaultValue={selected.attendance ?? 0} required /></label>
      <label>Catatan Evaluasi Instruktur BLK<textarea name="evaluasiInstruktur" defaultValue={selected.evaluation ?? ""} minLength={10} maxLength={2000} required /></label>
      {notice && <p role="status">{notice}</p>}
    </form></Dialog>}

    {selected && mode === "complete" && <Dialog title={`Selesaikan Penempatan — ${selected.code}`} close={close} footer={<><button className={styles.secondary} onClick={close}>Batal</button><button className={styles.primary} type="submit" form="complete-intervention">Simpan &amp; Selesaikan Intervensi</button></>}><form id="complete-intervention" className={styles.form} onSubmit={submitComplete}>
      <div className={styles.identity}><small>Identitas Warga</small><h3>{selected.name} ({selected.maskedNik})</h3><p>{selected.program} ({selected.institution})</p><StatusBadge status={selected.status} /></div>
      <label>Perusahaan / Mitra Penempatan<select name="mitraIndustriId" required><option value="">Pilih mitra industri</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select></label>
      <label>Tanggal Penempatan Kerja<input name="placementDate" type="date" required /></label>
      <label>Catatan Evaluasi Disnaker<textarea name="evaluation" defaultValue={selected.evaluation ?? ""} minLength={10} maxLength={2000} required /></label>
      {notice && <p role="status">{notice}</p>}
    </form></Dialog>}

    {selected && mode === "detail" && <Drawer title={`Detail Intervensi Warga — ${selected.code}`} close={close} footer={<><button className={styles.secondary} type="button" onClick={() => window.print()}>Cetak Berkas Penempatan</button><button className={styles.warning} type="button" onClick={close}>Tutup</button></>}><div className={styles.detailStack}>
      <div className={styles.identity}><small>Identitas Warga</small><h3>{selected.name}</h3><p>{selected.maskedNik} | Desil: Desil {selected.desil || "—"} | Kelurahan: {selected.kelurahan}</p><div style={{marginTop:16,display:"flex",gap:10}}><span className={styles.badge}>Pekerja</span><StatusBadge status={selected.status} /></div></div>
      <div className={styles.detailBox}><small>Program Vokasi</small><strong>{selected.program}</strong></div>
      <div className={styles.detailBox}><small>Lembaga Pelaksana</small><strong>{selected.institution}</strong></div>
      <div className={styles.detailBox}><small>Mitra Tempat Kerja</small><strong>{selected.placementPartner ?? "—"}</strong></div>
      <div className={styles.detailBox}><small>Tanggal Mulai Bekerja</small><strong>{selected.placementDate ?? "—"}</strong></div>
      <section><h3>Riwayat Intervensi</h3><div className={styles.timeline}>{selected.timeline.map((event) => <div key={event.id} aria-current={event.type === "COMPLETED" ? "step" : undefined}><span className={styles.muted}>{event.date}</span><p>{event.note}{event.attendance === null ? "" : ` — Kehadiran ${event.attendance}%`}</p></div>)}</div>{!selected.timeline.length && <p className={styles.muted}>Belum ada event intervensi.</p>}</section>
      <section><h3>Catatan Evaluasi Akhir</h3><div className={styles.detailBox}>{selected.evaluation ?? "Belum ada catatan evaluasi."}</div></section>
    </div></Drawer>}
  </section>;
}
