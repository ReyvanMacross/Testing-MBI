"use client";

import { BadgeCheck, ChevronLeft, ChevronRight, Printer, TriangleAlert, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";

import { Dialog, Drawer } from "@/components/disbudpar/shared/dialog";
import styles from "@/components/disbudpar/shared/disbudpar-ui.module.css";
import type {
  DisbudparCreativeResultStatus,
  DisbudparOfficer,
  DisbudparParticipantStatus,
  DisbudparProgram,
  DisbudparReferral,
  DisbudparReferralStatus,
} from "@/lib/disbudpar/data";

type Mode = "start" | "progress" | "detail" | null;

function statusLabel(status: DisbudparReferralStatus) {
  if (status === "PERLU_DIPROSES") return "Perlu Diproses";
  if (status === "SEDANG_DIDAMPINGI") return "Sedang Didampingi";
  return "Mandiri / Selesai";
}

function participantLabel(status: DisbudparParticipantStatus | null) {
  if (status === "MANDIRI_SELESAI") return "Mandiri / Selesai";
  if (status === "TIDAK_AKTIF") return "Tidak Aktif";
  return "Aktif Pendampingan";
}

function creativeResultLabel(status: DisbudparCreativeResultStatus | null) {
  if (status === "AKTIF_TAMPIL_PRODUKSI_RUTIN") return "Aktif tampil & produksi rutin";
  if (status === "AKTIF_TERBATAS") return "Aktif terbatas / tahap pembinaan";
  return "Belum aktif / tahap verifikasi";
}

function StatusBadge({ status }: { status: DisbudparReferralStatus }) {
  const tone = status === "PERLU_DIPROSES"
    ? styles.badgeAmber
    : status === "MANDIRI_SELESAI"
      ? styles.badgeGreen
      : "";
  return <span className={`${styles.badge} ${tone}`}>{statusLabel(status)}</span>;
}

export function DisbudparDashboard({
  initialReferrals,
  programs,
  officers,
  summary,
  preview,
}: {
  initialReferrals: DisbudparReferral[];
  programs: DisbudparProgram[];
  officers: DisbudparOfficer[];
  summary: { newReferrals: number; assisted: number; independent: number };
  preview: boolean;
}) {
  const [referrals, setReferrals] = useState(initialReferrals);
  const [selected, setSelected] = useState<DisbudparReferral | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [subsectorFilter, setSubsectorFilter] = useState("");
  const [notice, setNotice] = useState("");
  const [completionSelected, setCompletionSelected] = useState(false);
  const filtered = useMemo(
    () => referrals.filter((item) =>
      (!statusFilter || item.status === statusFilter)
      && (!subsectorFilter || item.creativeSubsector === subsectorFilter)),
    [referrals, statusFilter, subsectorFilter],
  );
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  function open(item: DisbudparReferral, nextMode: Exclude<Mode, null>) {
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
    const response = await fetch(`/api/disbudpar/referrals/${selected.id}/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        programId: form.get("programId"),
        pendampingId: form.get("pendampingId"),
        groupName: form.get("groupName"),
        creativeSubsector: form.get("creativeSubsector"),
        venueLocation: form.get("venueLocation"),
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
    const selectedOfficer = officers.find((officer) => officer.id === form.get("pendampingId"));
    setReferrals((items) => items.map((item) => item.id === selected.id ? {
      ...item,
      status: "SEDANG_DIDAMPINGI",
      participantStatus: "AKTIF_PENDAMPINGAN",
      creativeResultStatus: "BELUM_AKTIF",
      programId: selectedProgram?.id ?? item.programId,
      program: selectedProgram?.name ?? item.program,
      pendampingId: selectedOfficer?.id ?? item.pendampingId,
      officerName: selectedOfficer?.name ?? item.officerName,
      groupName: String(form.get("groupName")),
      creativeSubsector: String(form.get("creativeSubsector")),
      venueLocation: String(form.get("venueLocation")),
      aidPackage: String(form.get("aidPackage")),
      actionPlan: String(form.get("actionPlan")),
      interventionId: body.interventionId,
      progress: 0,
      timeline: [...item.timeline, {
        id: crypto.randomUUID(),
        type: "STARTED",
        date: "Hari ini",
        note: "Pendampingan ekraf dan seni Disbudpar dimulai.",
        progress: 0,
      }],
    } : item));
    setNotice("Pendampingan Disbudpar dimulai.");
    window.setTimeout(close, 650);
  }

  async function submitProgress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected?.interventionId) return;
    const form = new FormData(event.currentTarget);
    const completing = form.get("participantStatus") === "MANDIRI_SELESAI";
    const response = completing
      ? await fetch(`/api/disbudpar/interventions/${selected.interventionId}/complete`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            achievementValue: Number(form.get("achievementValue")),
            completionDate: form.get("completionDate"),
            evaluation: form.get("evaluation"),
          }),
        })
      : await fetch(`/api/disbudpar/interventions/${selected.interventionId}/progress`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            participantStatus: "AKTIF_PENDAMPINGAN",
            progressPercent: Number(form.get("progressPercent")),
            creativeResultStatus: form.get("creativeResultStatus"),
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
      creativeResultStatus: completing ? "AKTIF_TAMPIL_PRODUKSI_RUTIN" : String(form.get("creativeResultStatus")) as DisbudparCreativeResultStatus,
      progress,
      achievementValue: completing ? Number(form.get("achievementValue")) : item.achievementValue,
      evaluation,
      timeline: [...item.timeline, {
        id: crypto.randomUUID(),
        type: completing ? "COMPLETED" : "PROGRESS_UPDATED",
        date: "Hari ini",
        note: completing ? "Pendampingan selesai dan pelaku ekraf ditetapkan mandiri." : evaluation,
        progress,
      }],
    } : item));
    setNotice(completing ? "Pendampingan selesai dan capaian pembinaan tercatat." : "Progress pendampingan tersimpan.");
    window.setTimeout(close, 650);
  }

  const subsectors = [...new Set(referrals.map((item) => item.creativeSubsector))];
  const activePrograms = programs.filter((program) => program.status === "AKTIF");
  const currentSummary = referrals === initialReferrals ? summary : {
    newReferrals: referrals.filter((item) => item.status === "PERLU_DIPROSES").length,
    assisted: referrals.filter((item) => item.status === "SEDANG_DIDAMPINGI").length,
    independent: referrals.filter((item) => item.status === "MANDIRI_SELESAI").length,
  };

  return <section aria-labelledby="disbudpar-title">
    <div className={styles.pageHeading}>
      <div>
        <h1 id="disbudpar-title">Rujukan Masuk &amp; Intervensi</h1>
        <p>Pengelolaan bantuan fasilitas ekonomi kreatif, pelatihan sanggar seni, dan pemberdayaan pelaku budaya keluarga MBI.</p>
      </div>
    </div>

    <div className={styles.summaryGrid}>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><TriangleAlert size={27} /></span><div><p>Rujukan Baru<br />(Perlu Tindak Lanjut)</p><strong>{currentSummary.newReferrals} <small>Pelaku Ekraf/Seni</small></strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><UsersRound size={27} /></span><div><p>Dalam Pendampingan<br />Ekraf</p><strong>{currentSummary.assisted} <small>Sanggar/Keluarga</small></strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><BadgeCheck size={27} /></span><div><p>Mandiri Karya &amp; Seni</p><strong>{currentSummary.independent} <small>Pelaku Ekraf</small></strong></div></article>
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
          <select aria-label="Filter subsektor" value={subsectorFilter} onChange={(event) => setSubsectorFilter(event.target.value)}>
            <option value="">Semua Subsektor</option>
            {subsectors.map((subsector) => <option key={subsector}>{subsector}</option>)}
          </select>
        </div>
      </div>
      <div className={styles.desktopTable}>
        <table>
          <thead><tr><th>ID Rujukan / Warga</th><th>Tanggal</th><th>Subsektor &amp; Kelurahan</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>{filtered.map((item) => <tr key={item.id}>
            <td><strong>{item.name}</strong><span className={styles.muted}>{item.maskedNik}<br />{item.code}</span></td>
            <td>{item.date}</td>
            <td><strong>{item.creativeSubsector}</strong><span className={styles.muted}>{item.kelurahan}</span></td>
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
        <dl><div><dt>Tanggal</dt><dd>{item.date}</dd></div><div><dt>Subsektor / Kelurahan</dt><dd>{item.creativeSubsector}<br />{item.kelurahan}</dd></div></dl>
        <button className={`${styles.action} ${item.status === "PERLU_DIPROSES" ? styles.actionPrimary : ""}`} onClick={() => open(item, item.status === "PERLU_DIPROSES" ? "start" : item.status === "SEDANG_DIDAMPINGI" ? "progress" : "detail")}>
          {item.status === "PERLU_DIPROSES" ? "Proses Intervensi" : item.status === "SEDANG_DIDAMPINGI" ? "Update Progress" : "Detail"}
        </button>
      </article>)}</div>
      {!filtered.length && <p className={styles.emptyState}>Belum ada rujukan Disbudpar yang sesuai filter.</p>}
      <nav className={styles.pagination} aria-label="Halaman rujukan"><p>Menampilkan 1–{filtered.length} dari {referrals.length} data</p><div className={styles.pages}><span><ChevronLeft size={15} /></span><strong aria-current="page">1</strong><span><ChevronRight size={15} /></span></div></nav>
    </section>

    {selected && mode === "start" && <Dialog
      title={`Proses Intervensi Budpar — ${selected.code}`}
      close={close}
      footer={<><button className={styles.secondary} onClick={close}>Batal</button><button className={styles.primary} type="submit" form="start-disbudpar">Simpan &amp; Mulai Pendampingan</button></>}
    >
      <form id="start-disbudpar" className={styles.form} onSubmit={submitStart}>
        <div className={styles.identity}><small>Identitas Warga</small><h3>{selected.name}</h3><p>NIK: {selected.maskedNik} | Desil: Desil {selected.desil || "—"} | Kelurahan: {selected.kelurahan}</p><span className={styles.badge}>Pelaku Ekraf / Seni MBI</span></div>
        <div className={styles.twoColumns}><label>Nama Kelompok / Sanggar<input name="groupName" defaultValue={selected.groupName.startsWith("Kelompok / sanggar") ? "" : selected.groupName} minLength={3} maxLength={200} required /></label><label>Lokasi Sanggar / Galeri<input name="venueLocation" defaultValue={selected.venueLocation ?? selected.kelurahan} minLength={3} maxLength={300} required /></label></div>
        <label>Subsektor Ekraf &amp; Seni<select name="creativeSubsector" defaultValue={selected.creativeSubsector === "Belum diklasifikasikan" ? "Kriya & Seni Pertunjukan" : selected.creativeSubsector} required><option>Kriya &amp; Seni Pertunjukan</option><option>Seni Musik &amp; Seni Tari</option><option>Kuliner &amp; Desain Grafis</option><option>Film, Fotografi, &amp; Animasi</option></select></label>
        <label>Program Ekraf &amp; Sanggar Seni<select name="programId" defaultValue={activePrograms.find((item) => item.id === selected.programId)?.id ?? activePrograms[0]?.id} required>{activePrograms.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select></label>
        <label>Pendamping DISBUDPAR<select name="pendampingId" defaultValue={selected.pendampingId ?? activePrograms[0]?.pendampingId} required>{officers.map((officer) => <option key={officer.id} value={officer.id}>{officer.name} ({officer.cluster})</option>)}</select></label>
        <label>Fasilitas &amp; Jenis Bantuan<select name="aidPackage" defaultValue="Set Peralatan Kriya & Pendampingan" required><option>Set Peralatan Kriya &amp; Pendampingan</option><option>Set Alat Musik Tradisional</option><option>Pelatihan Sanggar Seni &amp; Produksi</option><option>Fasilitasi Galeri &amp; Ruang Pamer</option></select></label>
        <label>Tanggal Pelaksanaan<input type="date" name="startDate" defaultValue={today} required /></label>
        <label>Catatan Rencana Pendampingan<textarea name="actionPlan" defaultValue={selected.actionPlan} minLength={10} maxLength={2000} required /></label>
        {notice && <p role="status">{notice}</p>}
      </form>
    </Dialog>}

    {selected && mode === "progress" && <Dialog
      title={`Update Progress Intervensi — ${selected.code}`}
      close={close}
      footer={<><button className={styles.secondary} onClick={close}>Batal</button><button className={styles.primary} type="submit" form="progress-disbudpar">{completionSelected ? "Simpan & Selesaikan Pendampingan" : "Simpan Progress"}</button></>}
    >
      <form id="progress-disbudpar" className={styles.form} onSubmit={submitProgress}>
        <div className={styles.identity}><small>Nama Warga</small><h3>{selected.name} ({selected.maskedNik})</h3><p>Desil {selected.desil || "—"} | {selected.kelurahan}<br />{selected.program} ({selected.officerName})</p><span className={styles.badge}>{participantLabel(selected.participantStatus)}</span></div>
        <label>Status Intervensi Baru<select name="participantStatus" defaultValue="AKTIF_PENDAMPINGAN" onChange={(event) => setCompletionSelected(event.target.value === "MANDIRI_SELESAI")} required><option value="AKTIF_PENDAMPINGAN">Sedang Didampingi</option><option value="MANDIRI_SELESAI">Mandiri / Selesai (Ekraf &amp; Seni)</option></select></label>
        {!completionSelected && <>
          <div className={styles.twoColumns}>
            <label>Persentase Progress Pendampingan (%)<input name="progressPercent" type="number" min="0" max="99" defaultValue={selected.progress ?? 0} required /></label>
            <label>Status Hasil Ekraf &amp; Seni<select name="creativeResultStatus" defaultValue={selected.creativeResultStatus ?? "BELUM_AKTIF"} required><option value="BELUM_AKTIF">Belum Aktif / Tahap Verifikasi</option><option value="AKTIF_TERBATAS">Aktif Terbatas / Tahap Pembinaan</option><option value="AKTIF_TAMPIL_PRODUKSI_RUTIN">Aktif Tampil &amp; Produksi Rutin</option></select></label>
          </div>
        </>}
        {completionSelected && <>
          <div className={styles.twoColumns}>
            <label>Capaian Omzet / Nilai Tampil (Rp)<input name="achievementValue" type="number" min="0" max="1000000000000" required /></label>
            <label>Status Hasil Ekraf &amp; Seni<select name="creativeResultStatus" defaultValue="AKTIF_TAMPIL_PRODUKSI_RUTIN" required><option value="AKTIF_TAMPIL_PRODUKSI_RUTIN">Aktif Tampil &amp; Produksi Rutin</option></select></label>
          </div>
          <label>Tanggal Selesai Pendampingan<input name="completionDate" type="date" defaultValue={today} required /></label>
        </>}
        <label>Catatan Evaluasi Pendamping<textarea name="evaluation" defaultValue={selected.evaluation ?? ""} minLength={10} maxLength={2000} required /></label>
        {notice && <p role="status">{notice}</p>}
      </form>
    </Dialog>}

    {selected && mode === "detail" && <Drawer
      title={`Detail Intervensi Budpar — ${selected.code}`}
      close={close}
      footer={<><button className={styles.secondary} type="button" onClick={() => window.print()}><Printer size={16} /> Unduh Laporan</button><button className={styles.secondary} onClick={close}>Tutup</button></>}
    >
      <div className={styles.detailStack}>
        <div className={styles.identity}>
          <small>Nama Warga</small><h3>{selected.name} ({selected.maskedNik})</h3>
          <div className={styles.twoColumns}><div><small>Program</small><strong>{selected.program}</strong></div><div><small>Desil &amp; Kelurahan</small><strong>Desil {selected.desil || "—"} | {selected.kelurahan}</strong></div></div>
          <span className={`${styles.badge} ${styles.badgeGreen}`}>Mandiri / Selesai</span>
        </div>
        <section><h2>Riwayat Pendampingan Disbudpar</h2><div className={styles.timeline}>{selected.timeline.map((event) => <div key={event.id} aria-current={event.type === "COMPLETED" ? "step" : undefined}><span className={styles.muted}>{event.date}</span><p>{event.note}{event.progress === null ? "" : ` — Progress ${event.progress}%`}</p></div>)}</div>{!selected.timeline.length && <p className={styles.muted}>Belum ada event pendampingan.</p>}</section>
        <div className={styles.twoColumns}><div className={styles.detailBox}><small>Jenis Bantuan / Sarana</small><strong>{selected.aidPackage}</strong></div><div className={styles.detailBox}><small>Capaian Omzet / Nilai Tampil</small><strong>{selected.achievementValue === null ? "—" : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(selected.achievementValue)}</strong></div></div>
        <div className={styles.detailBox}><small>Status Hasil Ekraf &amp; Seni</small><strong>{creativeResultLabel(selected.creativeResultStatus)}</strong></div>
      </div>
    </Drawer>}
  </section>;
}
