"use client";

import { BadgeCheck, ChevronLeft, ChevronRight, Printer, TriangleAlert, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";

import { Dialog, Drawer } from "@/components/disdagin/shared/dialog";
import styles from "@/components/disdagin/shared/disdagin-ui.module.css";
import type {
  DisdaginLegalStatus,
  DisdaginMentor,
  DisdaginParticipantStatus,
  DisdaginProgram,
  DisdaginReferral,
  DisdaginReferralStatus,
} from "@/lib/disdagin/data";

type Mode = "start" | "progress" | "detail" | null;

function statusLabel(status: DisdaginReferralStatus) {
  if (status === "PERLU_DIPROSES") return "Perlu Diproses";
  if (status === "SEDANG_DIDAMPINGI") return "Fasilitasi Pameran";
  return "Mitra Retail / Selesai";
}

function participantLabel(status: DisdaginParticipantStatus | null) {
  if (status === "MANDIRI_SELESAI") return "Mitra Retail / Selesai";
  if (status === "TIDAK_AKTIF") return "Tidak Aktif";
  return "Aktif Pendampingan";
}

function legalLabel(status: DisdaginLegalStatus | null) {
  if (status === "LEGAL") return "Mitra retail / pasar baru";
  if (status === "PROSES_NIB_HALAL") return "Stand teralokasi / fasilitasi pameran";
  return "Tahap kurasi produk";
}

function StatusBadge({ status }: { status: DisdaginReferralStatus }) {
  const tone = status === "PERLU_DIPROSES"
    ? styles.badgeAmber
    : status === "MANDIRI_SELESAI"
      ? styles.badgeGreen
      : "";
  return <span className={`${styles.badge} ${tone}`}>{statusLabel(status)}</span>;
}

export function DisdaginDashboard({
  initialReferrals,
  programs,
  mentors,
  summary,
  preview,
}: {
  initialReferrals: DisdaginReferral[];
  programs: DisdaginProgram[];
  mentors: DisdaginMentor[];
  summary: { newReferrals: number; assisted: number; independent: number };
  preview: boolean;
}) {
  const [referrals, setReferrals] = useState(initialReferrals);
  const [selected, setSelected] = useState<DisdaginReferral | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [notice, setNotice] = useState("");
  const [completionSelected, setCompletionSelected] = useState(false);
  const filtered = useMemo(
    () => referrals.filter((item) =>
      (!statusFilter || item.status === statusFilter)
      && (!programFilter || item.program === programFilter)),
    [programFilter, referrals, statusFilter],
  );
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  function open(item: DisdaginReferral, nextMode: Exclude<Mode, null>) {
    setSelected(item);
    setMode(nextMode);
    setNotice("");
    setCompletionSelected(false);
  }

  function close() {
    setSelected(null);
    setMode(null);
    setNotice("");
    setCompletionSelected(false);
  }

  async function submitStart(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/disdagin/referrals/${selected.id}/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        programId: form.get("programId"),
        pendampingId: form.get("pendampingId"),
        businessName: form.get("businessName"),
        businessCategory: form.get("businessCategory"),
        nib: form.get("nib"),
        stimulus: form.get("stimulus"),
        startDate: form.get("startDate"),
        actionPlan: form.get("actionPlan"),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(body.error ?? "Pendampingan tidak dapat dimulai.");
      return;
    }
    const selectedProgram = programs.find((program) => program.id === form.get("programId"));
    const selectedMentor = mentors.find((mentor) => mentor.id === form.get("pendampingId"));
    setReferrals((items) => items.map((item) => item.id === selected.id ? {
      ...item,
      status: "SEDANG_DIDAMPINGI",
      participantStatus: "AKTIF_PENDAMPINGAN",
      legalStatus: "BELUM",
      programId: selectedProgram?.id ?? item.programId,
      program: selectedProgram?.name ?? item.program,
      pendampingId: selectedMentor?.id ?? item.pendampingId,
      consultant: selectedMentor?.name ?? item.consultant,
      businessName: String(form.get("businessName")),
      businessCategory: String(form.get("businessCategory")),
      nib: String(form.get("nib")),
      stimulus: String(form.get("stimulus")),
      actionPlan: String(form.get("actionPlan")),
      interventionId: body.interventionId,
      progress: 0,
      timeline: [...item.timeline, {
        id: crypto.randomUUID(),
        type: "STARTED",
        date: "Hari ini",
        note: "Fasilitasi akses pasar dimulai.",
        progress: 0,
      }],
    } : item));
    setNotice("Fasilitasi pasar dimulai.");
    window.setTimeout(close, 650);
  }

  async function submitProgress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected?.interventionId) return;
    const form = new FormData(event.currentTarget);
    const completing = form.get("participantStatus") === "MANDIRI_SELESAI";
    const response = completing
      ? await fetch(`/api/disdagin/interventions/${selected.interventionId}/complete`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            nib: form.get("nib"),
            monthlyRevenue: Number(form.get("monthlyRevenue")),
            completionDate: form.get("completionDate"),
            evaluation: form.get("evaluation"),
          }),
        })
      : await fetch(`/api/disdagin/interventions/${selected.interventionId}/progress`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            participantStatus: "AKTIF_PENDAMPINGAN",
            progressPercent: Number(form.get("progressPercent")),
            legalStatus: form.get("legalStatus"),
            evaluation: form.get("evaluation"),
          }),
        });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(body.error ?? "Progress pendampingan tidak dapat disimpan.");
      return;
    }
    const evaluation = String(form.get("evaluation"));
    const progress = completing ? 100 : Number(form.get("progressPercent"));
    setReferrals((items) => items.map((item) => item.id === selected.id ? {
      ...item,
      status: completing ? "MANDIRI_SELESAI" : "SEDANG_DIDAMPINGI",
      participantStatus: completing ? "MANDIRI_SELESAI" : "AKTIF_PENDAMPINGAN",
      legalStatus: completing ? "LEGAL" : String(form.get("legalStatus")) as DisdaginLegalStatus,
      progress,
      nib: completing ? String(form.get("nib")) : item.nib,
      monthlyRevenue: completing ? Number(form.get("monthlyRevenue")) : item.monthlyRevenue,
      evaluation,
      timeline: [...item.timeline, {
        id: crypto.randomUUID(),
        type: completing ? "COMPLETED" : "PROGRESS_UPDATED",
        date: "Hari ini",
        note: completing ? "Kelulusan dan usaha berjalan mandiri." : evaluation,
        progress,
      }],
    } : item));
    setNotice(completing ? "Intervensi selesai dan penetrasi pasar tercatat." : "Progress fasilitasi tersimpan.");
    window.setTimeout(close, 650);
  }

  const programNames = [...new Set(referrals.map((item) => item.program))];
  const activePrograms = programs.filter((program) => program.status === "AKTIF");
  const currentSummary = referrals === initialReferrals ? summary : {
    newReferrals: referrals.filter((item) => item.status === "PERLU_DIPROSES").length,
    assisted: referrals.filter((item) => item.status === "SEDANG_DIDAMPINGI").length,
    independent: referrals.filter((item) => item.status === "MANDIRI_SELESAI").length,
  };

  return <section aria-labelledby="disdagin-title">
    <div className={styles.pageHeading}>
      <div>
        <h1 id="disdagin-title">Rujukan Masuk &amp; Intervensi</h1>
        <p>Pengelolaan dan fasilitasi perluasan akses pasar, kemitraan retail, serta pameran dagang untuk UMKM MBI.</p>
      </div>
    </div>

    <div className={styles.summaryGrid}>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><TriangleAlert size={27} /></span><div><p>Rujukan Baru<br />(Perlu Tindak Lanjut)</p><strong>{currentSummary.newReferrals}</strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><UsersRound size={27} /></span><div><p>Dalam Fasilitasi Pasar /<br />Pameran</p><strong>{currentSummary.assisted}</strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><BadgeCheck size={27} /></span><div><p>Berhasil Penetrasi<br />Pasar</p><strong>{currentSummary.independent}</strong></div></article>
    </div>

    <section className={styles.card} aria-label="Daftar rujukan masuk">
      {preview && <p className={styles.previewNote}>Mode pratinjau eksplisit aktif untuk pengembangan lokal.</p>}
      <div className={styles.filters}>
        <h2>Daftar Rujukan Masuk</h2>
        <div className={styles.filterControls}>
          <select aria-label="Filter status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Semua Status</option>
            <option value="PERLU_DIPROSES">Perlu Diproses</option>
            <option value="SEDANG_DIDAMPINGI">Fasilitasi Pameran</option>
            <option value="MANDIRI_SELESAI">Mitra Retail / Selesai</option>
          </select>
          <select aria-label="Filter program" value={programFilter} onChange={(event) => setProgramFilter(event.target.value)}>
            <option value="">Semua Program</option>
            {programNames.map((name) => <option key={name}>{name}</option>)}
          </select>
        </div>
      </div>
      <div className={styles.desktopTable}>
        <table>
          <thead><tr><th>ID Rujukan / Warga</th><th>Tanggal</th><th>Jenis Usaha &amp; NIB</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>{filtered.map((item) => <tr key={item.id}>
            <td><strong>{item.name}</strong><span className={styles.muted}>{item.maskedNik}<br />{item.code}</span></td>
            <td>{item.date}</td>
            <td><strong>{item.businessCategory}</strong><span className={styles.muted}>{item.businessName}<br />NIB: {item.nib ?? "Belum didata"}</span></td>
            <td><StatusBadge status={item.status} /></td>
            <td>{item.status === "PERLU_DIPROSES"
              ? <button className={`${styles.action} ${styles.actionPrimary}`} onClick={() => open(item, "start")}>Proses Intervensi</button>
              : item.status === "SEDANG_DIDAMPINGI"
                ? <button className={styles.action} onClick={() => open(item, "progress")}>Update Progress</button>
                : <button className={styles.action} onClick={() => open(item, "detail")}>Detail</button>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className={styles.mobileCards}>{filtered.map((item) => <article key={item.id}>
        <header><div><h3>{item.name}</h3><span className={styles.muted}>{item.maskedNik}<br />{item.code}</span></div><StatusBadge status={item.status} /></header>
        <dl><div><dt>Tanggal</dt><dd>{item.date}</dd></div><div><dt>Usaha / NIB</dt><dd>{item.businessCategory}<br />{item.nib ?? "Belum didata"}</dd></div></dl>
        <button className={`${styles.action} ${item.status === "PERLU_DIPROSES" ? styles.actionPrimary : ""}`} onClick={() => open(item, item.status === "PERLU_DIPROSES" ? "start" : item.status === "SEDANG_DIDAMPINGI" ? "progress" : "detail")}>
          {item.status === "PERLU_DIPROSES" ? "Proses Intervensi" : item.status === "SEDANG_DIDAMPINGI" ? "Update Progress" : "Detail"}
        </button>
      </article>)}</div>
      {!filtered.length && <p className={styles.emptyState}>Belum ada rujukan WIRAUSAHA yang sesuai filter.</p>}
      <nav className={styles.pagination} aria-label="Halaman rujukan"><p>Menampilkan 1–{filtered.length} dari {referrals.length} data</p><div className={styles.pages}><span><ChevronLeft size={15} /></span><strong aria-current="page">1</strong><span><ChevronRight size={15} /></span></div></nav>
    </section>

    {selected && mode === "start" && <Dialog
      title={`Proses Intervensi Akses Pasar — ${selected.code}`}
      close={close}
      footer={<><button className={styles.secondary} onClick={close}>Batal</button><button className={styles.primary} type="submit" form="start-disdagin">Simpan &amp; Alokasikan Fasilitasi</button></>}
    >
      <form id="start-disdagin" className={styles.form} onSubmit={submitStart}>
        <div className={styles.identity}><small>Identitas Warga</small><h3>{selected.name}</h3><p>NIK: {selected.maskedNik} | Desil: Desil {selected.desil || "—"} | Kelurahan: {selected.kelurahan}</p><span className={styles.badge}>Wirausaha</span></div>
        <div className={styles.twoColumns}><label>Nama Usaha<input name="businessName" defaultValue={selected.businessName === "Usaha belum didata" ? "" : selected.businessName} minLength={3} maxLength={200} required /></label><label>Nomor NIB<input name="nib" inputMode="numeric" pattern="\d{13}" maxLength={13} defaultValue={selected.nib ?? ""} required /></label></div>
        <label>Jenis Usaha<select name="businessCategory" defaultValue={selected.businessCategory === "Belum diklasifikasikan" ? "Confectionery & Fashion" : selected.businessCategory} required><option>Confectionery &amp; Fashion</option><option>Olahan Kuliner</option><option>Servis Elektronik</option><option>Kerajinan &amp; Aksesori</option></select></label>
        <label>Agenda & Kemitraan Spesifik<select name="programId" defaultValue={activePrograms.find((item) => item.id === selected.programId)?.id ?? activePrograms[0]?.id} required>{activePrograms.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select></label>
        <label>Mitra / Penyelenggara Target<select name="pendampingId" defaultValue={selected.pendampingId ?? activePrograms[0]?.pendampingId} required>{mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.name} ({mentor.cluster})</option>)}</select></label>
        <label>Jenis Fasilitasi Pasar<select name="stimulus" defaultValue="Fasilitasi Pameran & Display Retail" required><option>Fasilitasi Pameran &amp; Display Retail</option><option>Temu Bisnis &amp; Kemitraan Retail</option><option>Kurasi Produk &amp; Promosi Digital</option></select></label>
        <label>Tanggal Pelaksanaan<input type="date" name="startDate" defaultValue={today} required /></label>
        <label>Catatan &amp; Dukungan Fasilitasi<textarea name="actionPlan" defaultValue={selected.actionPlan} minLength={10} maxLength={2000} required /></label>
        {notice && <p role="status">{notice}</p>}
      </form>
    </Dialog>}

    {selected && mode === "progress" && <Dialog
      title={`Update Status Fasilitasi — ${selected.name}`}
      close={close}
      footer={<><button className={styles.secondary} onClick={close}>Batal</button><button className={styles.primary} type="submit" form="progress-disdagin">{completionSelected ? "Simpan & Selesaikan Pendampingan" : "Simpan Progress"}</button></>}
    >
      <form id="progress-disdagin" className={styles.form} onSubmit={submitProgress}>
        <div className={styles.identity}><small>Nama Warga</small><h3>{selected.name} ({selected.maskedNik})</h3><p>Desil {selected.desil || "—"} | {selected.kelurahan}<br />{selected.program} ({selected.consultant})</p><span className={styles.badge}>{participantLabel(selected.participantStatus)}</span></div>
        <label>Status Intervensi Baru<select name="participantStatus" defaultValue="AKTIF_PENDAMPINGAN" onChange={(event) => setCompletionSelected(event.target.value === "MANDIRI_SELESAI")} required><option value="AKTIF_PENDAMPINGAN">Aktif Pendampingan</option><option value="MANDIRI_SELESAI">Mitra Retail / Selesai (Usaha Berjalan)</option></select></label>
        {!completionSelected && <>
          <div className={styles.twoColumns}>
            <label>Persentase Progress Usaha (%)<input name="progressPercent" type="number" min="0" max="99" defaultValue={selected.progress ?? 0} required /></label>
            <label>Status Penetrasi Pasar<select name="legalStatus" defaultValue={selected.legalStatus ?? "BELUM"} required><option value="BELUM">Tahap Kurasi</option><option value="PROSES_NIB_HALAL">Stand Teralokasi / Fasilitasi Pameran</option><option value="LEGAL">Mitra Retail</option></select></label>
          </div>
        </>}
        {completionSelected && <>
          <div className={styles.twoColumns}>
            <label>Nomor NIB<input name="nib" inputMode="numeric" pattern="\d{13}" maxLength={13} defaultValue={selected.nib ?? ""} required /></label>
            <label>Transaksi / Omzet Event (Rp)<input name="monthlyRevenue" type="number" min="0" max="1000000000000" required /></label>
          </div>
          <label>Tanggal Selesai Pendampingan<input name="completionDate" type="date" defaultValue={today} required /></label>
        </>}
        <label>Catatan Evaluasi Pendamping<textarea name="evaluation" defaultValue={selected.evaluation ?? ""} minLength={10} maxLength={2000} required /></label>
        {notice && <p role="status">{notice}</p>}
      </form>
    </Dialog>}

    {selected && mode === "detail" && <Drawer
      title={`Detail Progress Peserta — ${selected.code}`}
      close={close}
      footer={<><button className={styles.secondary} type="button" onClick={() => window.print()}><Printer size={16} /> Cetak Sertifikat UMKM</button><button className={styles.secondary} onClick={close}>Tutup</button></>}
    >
      <div className={styles.detailStack}>
        <div className={styles.identity}>
          <small>Nama Warga</small><h3>{selected.name} ({selected.maskedNik})</h3>
          <div className={styles.twoColumns}><div><small>Progress Usaha</small><strong>{selected.progress ?? 0}%</strong></div><div><small>NIB / Omzet Bulanan</small><strong>{selected.nib ?? "—"} / {selected.monthlyRevenue === null ? "—" : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(selected.monthlyRevenue)}</strong></div></div>
          <span className={`${styles.badge} ${styles.badgeGreen}`}>Mitra Retail / Selesai</span>
        </div>
        <section><h2>Riwayat Pendampingan</h2><div className={styles.timeline}>{selected.timeline.map((event) => <div key={event.id} aria-current={event.type === "COMPLETED" ? "step" : undefined}><span className={styles.muted}>{event.date}</span><p>{event.note}{event.progress === null ? "" : ` — Progress ${event.progress}%`}</p></div>)}</div>{!selected.timeline.length && <p className={styles.muted}>Belum ada event pendampingan.</p>}</section>
        <div className={styles.detailBox}><small>Status Legalitas</small><strong>{legalLabel(selected.legalStatus)}</strong></div>
      </div>
    </Drawer>}
  </section>;
}
