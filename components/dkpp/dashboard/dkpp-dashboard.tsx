"use client";

import { BadgeCheck, ChevronLeft, ChevronRight, Printer, TriangleAlert, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";

import { Dialog, Drawer } from "@/components/dkpp/shared/dialog";
import styles from "@/components/dkpp/shared/dkpp-ui.module.css";
import type {
  DkppHarvestStatus,
  DkppOfficer,
  DkppParticipantStatus,
  DkppProgram,
  DkppReferral,
  DkppReferralStatus,
} from "@/lib/dkpp/data";

type Mode = "start" | "progress" | "detail" | null;

function statusLabel(status: DkppReferralStatus) {
  if (status === "PERLU_DIPROSES") return "Perlu Diproses";
  if (status === "SEDANG_DIDAMPINGI") return "Sedang Didampingi";
  return "Mandiri / Selesai";
}

function participantLabel(status: DkppParticipantStatus | null) {
  if (status === "MANDIRI_SELESAI") return "Mandiri / Selesai";
  if (status === "TIDAK_AKTIF") return "Tidak Aktif";
  return "Aktif Pendampingan";
}

function harvestLabel(status: DkppHarvestStatus | null) {
  if (status === "MEMENUHI_DAN_DIPASARKAN") return "Memenuhi kebutuhan & dipasarkan";
  if (status === "HASIL_MENCUKUPI") return "Hasil pangan mencukupi";
  return "Belum panen / tahap budidaya";
}

function StatusBadge({ status }: { status: DkppReferralStatus }) {
  const tone = status === "PERLU_DIPROSES"
    ? styles.badgeAmber
    : status === "MANDIRI_SELESAI"
      ? styles.badgeGreen
      : "";
  return <span className={`${styles.badge} ${tone}`}>{statusLabel(status)}</span>;
}

export function DkppDashboard({
  initialReferrals,
  programs,
  officers,
  summary,
  preview,
}: {
  initialReferrals: DkppReferral[];
  programs: DkppProgram[];
  officers: DkppOfficer[];
  summary: { newReferrals: number; assisted: number; independent: number };
  preview: boolean;
}) {
  const [referrals, setReferrals] = useState(initialReferrals);
  const [selected, setSelected] = useState<DkppReferral | null>(null);
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

  function open(item: DkppReferral, nextMode: Exclude<Mode, null>) {
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
    const response = await fetch(`/api/dkpp/referrals/${selected.id}/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        programId: form.get("programId"),
        penyuluhId: form.get("penyuluhId"),
        groupName: form.get("groupName"),
        foodCategory: form.get("foodCategory"),
        plotLocation: form.get("plotLocation"),
        aidPackage: form.get("aidPackage"),
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
    const selectedOfficer = officers.find((officer) => officer.id === form.get("penyuluhId"));
    setReferrals((items) => items.map((item) => item.id === selected.id ? {
      ...item,
      status: "SEDANG_DIDAMPINGI",
      participantStatus: "AKTIF_PENDAMPINGAN",
      harvestStatus: "BELUM_PANEN",
      programId: selectedProgram?.id ?? item.programId,
      program: selectedProgram?.name ?? item.program,
      penyuluhId: selectedOfficer?.id ?? item.penyuluhId,
      officerName: selectedOfficer?.name ?? item.officerName,
      groupName: String(form.get("groupName")),
      foodCategory: String(form.get("foodCategory")),
      plotLocation: String(form.get("plotLocation")),
      aidPackage: String(form.get("aidPackage")),
      actionPlan: String(form.get("actionPlan")),
      interventionId: body.interventionId,
      progress: 0,
      timeline: [...item.timeline, {
        id: crypto.randomUUID(),
        type: "STARTED",
        date: "Hari ini",
        note: "Pendampingan pangan DKPP dimulai.",
        progress: 0,
      }],
    } : item));
    setNotice("Pendampingan pangan dimulai.");
    window.setTimeout(close, 650);
  }

  async function submitProgress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected?.interventionId) return;
    const form = new FormData(event.currentTarget);
    const completing = form.get("participantStatus") === "MANDIRI_SELESAI";
    const response = completing
      ? await fetch(`/api/dkpp/interventions/${selected.interventionId}/complete`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            harvestValue: Number(form.get("harvestValue")),
            completionDate: form.get("completionDate"),
            evaluation: form.get("evaluation"),
          }),
        })
      : await fetch(`/api/dkpp/interventions/${selected.interventionId}/progress`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            participantStatus: "AKTIF_PENDAMPINGAN",
            progressPercent: Number(form.get("progressPercent")),
            harvestStatus: form.get("harvestStatus"),
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
      harvestStatus: completing ? "MEMENUHI_DAN_DIPASARKAN" : String(form.get("harvestStatus")) as DkppHarvestStatus,
      progress,
      harvestValue: completing ? Number(form.get("harvestValue")) : item.harvestValue,
      evaluation,
      timeline: [...item.timeline, {
        id: crypto.randomUUID(),
        type: completing ? "COMPLETED" : "PROGRESS_UPDATED",
        date: "Hari ini",
        note: completing ? "Pendampingan selesai dan warga mandiri pangan." : evaluation,
        progress,
      }],
    } : item));
    setNotice(completing ? "Pendampingan selesai dan hasil pangan tercatat." : "Progress pendampingan tersimpan.");
    window.setTimeout(close, 650);
  }

  const programNames = [...new Set(referrals.map((item) => item.program))];
  const activePrograms = programs.filter((program) => program.status === "AKTIF");
  const currentSummary = referrals === initialReferrals ? summary : {
    newReferrals: referrals.filter((item) => item.status === "PERLU_DIPROSES").length,
    assisted: referrals.filter((item) => item.status === "SEDANG_DIDAMPINGI").length,
    independent: referrals.filter((item) => item.status === "MANDIRI_SELESAI").length,
  };

  return <section aria-labelledby="dkpp-title">
    <div className={styles.pageHeading}>
      <div>
        <h1 id="dkpp-title">Rujukan Masuk &amp; Intervensi</h1>
        <p>Pengelolaan bantuan bibit, pelatihan urban farming (Buruan SAE), dan pendampingan usaha pangan keluarga MBI.</p>
      </div>
    </div>

    <div className={styles.summaryGrid}>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><TriangleAlert size={27} /></span><div><p>Rujukan Baru<br />(Perlu Tindak Lanjut)</p><strong>{currentSummary.newReferrals} <small>Keluarga</small></strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><UsersRound size={27} /></span><div><p>Dalam Pendampingan<br />Buruan SAE</p><strong>{currentSummary.assisted} <small>Kelompok</small></strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><BadgeCheck size={27} /></span><div><p>Mandiri Pangan &amp;<br />Usaha</p><strong>{currentSummary.independent} <small>Keluarga</small></strong></div></article>
    </div>

    <section className={styles.card} aria-label="Daftar rujukan masuk">
      {preview && <p className={styles.previewNote}>Mode pratinjau eksplisit aktif untuk pengembangan lokal.</p>}
      <div className={styles.filters}>
        <h2>Daftar Rujukan Masuk</h2>
        <div className={styles.filterControls}>
          <select aria-label="Filter status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Semua Status</option>
            <option value="PERLU_DIPROSES">Perlu Diproses</option>
            <option value="SEDANG_DIDAMPINGI">Sedang Didampingi</option>
            <option value="MANDIRI_SELESAI">Mandiri / Selesai</option>
          </select>
          <select aria-label="Filter program" value={programFilter} onChange={(event) => setProgramFilter(event.target.value)}>
            <option value="">Semua Program</option>
            {programNames.map((name) => <option key={name}>{name}</option>)}
          </select>
        </div>
      </div>
      <div className={styles.desktopTable}>
        <table>
          <thead><tr><th>ID Rujukan / Warga</th><th>Tanggal</th><th>Jenis Bantuan &amp; Wilayah</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>{filtered.map((item) => <tr key={item.id}>
            <td><strong>{item.name}</strong><span className={styles.muted}>{item.maskedNik}<br />{item.code}</span></td>
            <td>{item.date}</td>
            <td><strong>{item.program}</strong><span className={styles.muted}>{item.plotLocation ?? item.kelurahan}</span></td>
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
        <dl><div><dt>Tanggal</dt><dd>{item.date}</dd></div><div><dt>Bantuan / Wilayah</dt><dd>{item.program}<br />{item.plotLocation ?? item.kelurahan}</dd></div></dl>
        <button className={`${styles.action} ${item.status === "PERLU_DIPROSES" ? styles.actionPrimary : ""}`} onClick={() => open(item, item.status === "PERLU_DIPROSES" ? "start" : item.status === "SEDANG_DIDAMPINGI" ? "progress" : "detail")}>
          {item.status === "PERLU_DIPROSES" ? "Proses Intervensi" : item.status === "SEDANG_DIDAMPINGI" ? "Update Progress" : "Detail"}
        </button>
      </article>)}</div>
      {!filtered.length && <p className={styles.emptyState}>Belum ada rujukan pangan yang sesuai filter.</p>}
      <nav className={styles.pagination} aria-label="Halaman rujukan"><p>Menampilkan 1–{filtered.length} dari {referrals.length} data</p><div className={styles.pages}><span><ChevronLeft size={15} /></span><strong aria-current="page">1</strong><span><ChevronRight size={15} /></span></div></nav>
    </section>

    {selected && mode === "start" && <Dialog
      title={`Proses Intervensi Pangan — ${selected.code}`}
      close={close}
      footer={<><button className={styles.secondary} onClick={close}>Batal</button><button className={styles.primary} type="submit" form="start-dkpp">Simpan &amp; Mulai Pendampingan</button></>}
    >
      <form id="start-dkpp" className={styles.form} onSubmit={submitStart}>
        <div className={styles.identity}><small>Identitas Warga</small><h3>{selected.name}</h3><p>NIK: {selected.maskedNik} | Desil: Desil {selected.desil || "—"} | Kelurahan: {selected.kelurahan}</p><span className={styles.badge}>Penerima Pangan MBI</span></div>
        <div className={styles.twoColumns}><label>Nama Kelompok / Keluarga<input name="groupName" defaultValue={selected.groupName.startsWith("Keluarga / kelompok") ? "" : selected.groupName} minLength={3} maxLength={200} required /></label><label>Lokasi Unit / Demplot<input name="plotLocation" defaultValue={selected.plotLocation ?? selected.kelurahan} minLength={3} maxLength={300} required /></label></div>
        <label>Kategori Pangan<select name="foodCategory" defaultValue={selected.foodCategory === "Belum diklasifikasikan" ? "Urban Farming" : selected.foodCategory} required><option>Urban Farming</option><option>Bantuan Bibit &amp; Ternak</option><option>Pengolahan Limbah Pangan</option><option>Usaha Pangan Keluarga</option></select></label>
        <label>Program Buruan SAE<select name="programId" defaultValue={activePrograms.find((item) => item.id === selected.programId)?.id ?? activePrograms[0]?.id} required>{activePrograms.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select></label>
        <label>Penyuluh DKPP<select name="penyuluhId" defaultValue={selected.penyuluhId ?? activePrograms[0]?.penyuluhId} required>{officers.map((officer) => <option key={officer.id} value={officer.id}>{officer.name} ({officer.cluster})</option>)}</select></label>
        <label>Fasilitas &amp; Jenis Bantuan<select name="aidPackage" defaultValue="Paket Bibit, Media Tanam, & Pendampingan" required><option>Paket Bibit, Media Tanam, &amp; Pendampingan</option><option>Paket Budikdamber &amp; Benih Ikan</option><option>Pelatihan Urban Farming &amp; Hidroponik</option><option>Rumah Kompos &amp; Sarana Organik</option></select></label>
        <label>Tanggal Pelaksanaan<input type="date" name="startDate" defaultValue={today} required /></label>
        <label>Catatan Rencana Pendampingan<textarea name="actionPlan" defaultValue={selected.actionPlan} minLength={10} maxLength={2000} required /></label>
        {notice && <p role="status">{notice}</p>}
      </form>
    </Dialog>}

    {selected && mode === "progress" && <Dialog
      title={`Update Progress Intervensi — ${selected.name}`}
      close={close}
      footer={<><button className={styles.secondary} onClick={close}>Batal</button><button className={styles.primary} type="submit" form="progress-dkpp">{completionSelected ? "Simpan & Selesaikan Pendampingan" : "Simpan Progress"}</button></>}
    >
      <form id="progress-dkpp" className={styles.form} onSubmit={submitProgress}>
        <div className={styles.identity}><small>Nama Warga</small><h3>{selected.name} ({selected.maskedNik})</h3><p>Desil {selected.desil || "—"} | {selected.kelurahan}<br />{selected.program} ({selected.officerName})</p><span className={styles.badge}>{participantLabel(selected.participantStatus)}</span></div>
        <label>Status Intervensi Baru<select name="participantStatus" defaultValue="AKTIF_PENDAMPINGAN" onChange={(event) => setCompletionSelected(event.target.value === "MANDIRI_SELESAI")} required><option value="AKTIF_PENDAMPINGAN">Sedang Didampingi</option><option value="MANDIRI_SELESAI">Mandiri / Selesai (Ketahanan Pangan)</option></select></label>
        {!completionSelected && <>
          <div className={styles.twoColumns}>
            <label>Persentase Progress Pendampingan (%)<input name="progressPercent" type="number" min="0" max="99" defaultValue={selected.progress ?? 0} required /></label>
            <label>Status Hasil Pangan<select name="harvestStatus" defaultValue={selected.harvestStatus ?? "BELUM_PANEN"} required><option value="BELUM_PANEN">Belum Panen / Tahap Budidaya</option><option value="HASIL_MENCUKUPI">Hasil Pangan Mencukupi</option><option value="MEMENUHI_DAN_DIPASARKAN">Memenuhi Kebutuhan &amp; Dipasarkan</option></select></label>
          </div>
        </>}
        {completionSelected && <>
          <div className={styles.twoColumns}>
            <label>Capaian Nilai Panen (Rp)<input name="harvestValue" type="number" min="0" max="1000000000000" required /></label>
            <label>Status Hasil Pangan<select name="harvestStatus" defaultValue="MEMENUHI_DAN_DIPASARKAN" required><option value="MEMENUHI_DAN_DIPASARKAN">Memenuhi Kebutuhan &amp; Dipasarkan</option></select></label>
          </div>
          <label>Tanggal Selesai Pendampingan<input name="completionDate" type="date" defaultValue={today} required /></label>
        </>}
        <label>Catatan Evaluasi Pendamping<textarea name="evaluation" defaultValue={selected.evaluation ?? ""} minLength={10} maxLength={2000} required /></label>
        {notice && <p role="status">{notice}</p>}
      </form>
    </Dialog>}

    {selected && mode === "detail" && <Drawer
      title={`Detail Ketahanan Pangan — ${selected.code}`}
      close={close}
      footer={<><button className={styles.secondary} type="button" onClick={() => window.print()}><Printer size={16} /> Unduh Laporan</button><button className={styles.secondary} onClick={close}>Tutup</button></>}
    >
      <div className={styles.detailStack}>
        <div className={styles.identity}>
          <small>Nama Warga</small><h3>{selected.name} ({selected.maskedNik})</h3>
          <div className={styles.twoColumns}><div><small>Progress Pendampingan</small><strong>{selected.progress ?? 0}%</strong></div><div><small>Lokasi / Nilai Panen</small><strong>{selected.plotLocation ?? "—"} / {selected.harvestValue === null ? "—" : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(selected.harvestValue)}</strong></div></div>
          <span className={`${styles.badge} ${styles.badgeGreen}`}>Mandiri / Selesai</span>
        </div>
        <section><h2>Riwayat Pendampingan</h2><div className={styles.timeline}>{selected.timeline.map((event) => <div key={event.id} aria-current={event.type === "COMPLETED" ? "step" : undefined}><span className={styles.muted}>{event.date}</span><p>{event.note}{event.progress === null ? "" : ` — Progress ${event.progress}%`}</p></div>)}</div>{!selected.timeline.length && <p className={styles.muted}>Belum ada event pendampingan.</p>}</section>
        <div className={styles.detailBox}><small>Status Hasil Pangan</small><strong>{harvestLabel(selected.harvestStatus)}</strong></div>
      </div>
    </Drawer>}
  </section>;
}
