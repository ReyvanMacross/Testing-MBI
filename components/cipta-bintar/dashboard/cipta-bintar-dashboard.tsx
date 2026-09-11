"use client";

import { ChevronLeft, ChevronRight, HardHat, House, Printer, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { Dialog, Drawer } from "@/components/cipta-bintar/shared/dialog";
import styles from "@/components/cipta-bintar/shared/cipta-bintar-ui.module.css";
import type {
  CiptaBintarFeasibilityStatus,
  CiptaBintarOfficer,
  CiptaBintarProgram,
  CiptaBintarReferral,
  CiptaBintarReferralStatus,
} from "@/lib/cipta-bintar/data";

type Mode = "start" | "progress" | "detail" | null;

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function statusLabel(status: CiptaBintarReferralStatus) {
  if (status === "PERLU_DIPROSES") return "Perlu Diproses";
  if (status === "SEDANG_REHABILITASI") return "Sedang Rehabilitasi";
  return "Mandiri / Selesai";
}

function feasibilityLabel(status: CiptaBintarFeasibilityStatus | null) {
  if (status === "LAYAK_HUNI_BERFUNGSI") return "Hunian layak / fasilitas berfungsi";
  if (status === "PROGRES_FISIK") return "Dalam pengerjaan fisik";
  return "Tahap verifikasi lapangan";
}

function StatusBadge({ status }: { status: CiptaBintarReferralStatus }) {
  const tone = status === "PERLU_DIPROSES"
    ? styles.badgeAmber
    : status === "HUNIAN_LAYAK_SELESAI"
      ? styles.badgeGreen
      : "";
  return <span className={`${styles.badge} ${tone}`}>{statusLabel(status)}</span>;
}

export function CiptaBintarDashboard({
  initialReferrals,
  programs,
  officers,
  summary,
  preview,
}: {
  initialReferrals: CiptaBintarReferral[];
  programs: CiptaBintarProgram[];
  officers: CiptaBintarOfficer[];
  summary: { newReferrals: number; assisted: number; independent: number };
  preview: boolean;
}) {
  const [referrals, setReferrals] = useState(initialReferrals);
  const [selected, setSelected] = useState<CiptaBintarReferral | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [notice, setNotice] = useState("");
  const [completionSelected, setCompletionSelected] = useState(false);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

  const categories = [...new Set(referrals.map((item) => item.infrastructureCategory))];
  const filtered = useMemo(() => referrals.filter((item) =>
    (!statusFilter || item.status === statusFilter)
    && (!categoryFilter || item.infrastructureCategory === categoryFilter)
  ), [categoryFilter, referrals, statusFilter]);

  const currentSummary = referrals === initialReferrals ? summary : {
    newReferrals: referrals.filter((item) => item.status === "PERLU_DIPROSES").length,
    assisted: referrals.filter((item) => item.status === "SEDANG_REHABILITASI").length,
    independent: referrals.filter((item) => item.status === "HUNIAN_LAYAK_SELESAI").length,
  };

  function open(item: CiptaBintarReferral, nextMode: Exclude<Mode, null>) {
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
    const program = programs.find((item) => item.id === form.get("programId"));
    const petugas = officers.find((item) => item.id === program?.petugasId);
    if (!program || !petugas) {
      setNotice("Program atau petugas teknis belum tersedia.");
      return;
    }
    const category = String(form.get("infrastructureCategory"));
    const response = await fetch(`/api/cipta-bintar/referrals/${selected.id}/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        programId: program.id,
        petugasId: petugas.id,
        objectAddress: selected.objectAddress,
        infrastructureCategory: category,
        objectLocation: selected.objectLocation ?? selected.kelurahan,
        aidPackage: program.facilitation,
        allocatedBudget: Number(form.get("allocatedBudget")),
        startDate: form.get("startDate"),
        actionPlan: form.get("actionPlan"),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(body.error ?? "Pengerjaan fisik tidak dapat dimulai.");
      return;
    }
    setReferrals((items) => items.map((item) => item.id === selected.id ? {
      ...item,
      status: "SEDANG_REHABILITASI",
      participantStatus: "DALAM_PENGERJAAN",
      feasibilityStatus: "BELUM_DIVERIFIKASI",
      programId: program.id,
      program: program.name,
      petugasId: petugas.id,
      officerName: petugas.name,
      infrastructureCategory: category,
      aidPackage: program.facilitation,
      allocatedBudget: Number(form.get("allocatedBudget")),
      actionPlan: String(form.get("actionPlan")),
      interventionId: body.interventionId,
      progress: 0,
      timeline: [...item.timeline, {
        id: crypto.randomUUID(), type: "STARTED", date: "Hari ini",
        note: "Survei kelayakan selesai dan pengerjaan fisik dimulai.", progress: 0,
      }],
    } : item));
    setNotice("Pengerjaan fisik berhasil dimulai.");
    window.setTimeout(close, 650);
  }

  async function submitProgress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected?.interventionId) return;
    const form = new FormData(event.currentTarget);
    const completing = form.get("participantStatus") === "HUNIAN_LAYAK_SELESAI";
    const progress = completing ? 100 : Number(form.get("progressPercent"));
    const evaluation = String(form.get("evaluation"));
    const response = completing
      ? await fetch(`/api/cipta-bintar/interventions/${selected.interventionId}/complete`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            realizationValue: Number(form.get("realizationValue")),
            completionDate: form.get("completionDate"),
            evaluation,
          }),
        })
      : await fetch(`/api/cipta-bintar/interventions/${selected.interventionId}/progress`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            participantStatus: "DALAM_PENGERJAAN",
            progressPercent: progress,
            feasibilityStatus: "PROGRES_FISIK",
            evaluation,
          }),
        });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(body.error ?? "Progres fisik tidak dapat disimpan.");
      return;
    }
    setReferrals((items) => items.map((item) => item.id === selected.id ? {
      ...item,
      status: completing ? "HUNIAN_LAYAK_SELESAI" : "SEDANG_REHABILITASI",
      participantStatus: completing ? "HUNIAN_LAYAK_SELESAI" : "DALAM_PENGERJAAN",
      feasibilityStatus: completing ? "LAYAK_HUNI_BERFUNGSI" : "PROGRES_FISIK",
      progress,
      realizationValue: completing ? Number(form.get("realizationValue")) : item.realizationValue,
      evaluation,
      timeline: [...item.timeline, {
        id: crypto.randomUUID(), type: completing ? "COMPLETED" : "PROGRESS_UPDATED", date: "Hari ini",
        note: completing ? "Pengerjaan fisik selesai dan fasilitas dinyatakan layak." : evaluation,
        progress,
      }],
    } : item));
    setNotice(completing ? "Rehabilitasi selesai dan realisasi tercatat." : "Progres fisik tersimpan.");
    window.setTimeout(close, 650);
  }

  return <section aria-labelledby="cipta-bintar-title">
    <div className={styles.pageHeading}>
      <div>
        <h1 id="cipta-bintar-title">Rujukan Masuk &amp; Intervensi</h1>
        <p>Pengelolaan bantuan perbaikan Rutilahu, fasilitasi sanitasi/MCK komunal, dan penyediaan akses air bersih keluarga MBI.</p>
      </div>
    </div>

    <div className={styles.summaryGrid}>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><TriangleAlert size={27} /></span><div><p>Rujukan Baru<br />(Perlu Tindak Lanjut)</p><strong>{currentSummary.newReferrals} <small>Unit Rumah / Warga</small></strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><HardHat size={27} /></span><div><p>Dalam Pengerjaan Fisik</p><strong>{currentSummary.assisted} <small>Unit / Lokasi</small></strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><House size={27} /></span><div><p>Hunian Layak / Selesai</p><strong>{currentSummary.independent} <small>Unit Rumah</small></strong></div></article>
    </div>

    <section className={styles.card} aria-label="Daftar rujukan masuk">
      {preview && <p className={styles.previewNote}>Mode pratinjau eksplisit aktif untuk pengembangan lokal.</p>}
      <div className={styles.filters}>
        <h2>Daftar Rujukan Masuk</h2>
        <div className={styles.filterControls}>
          <select aria-label="Filter status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Semua Status</option>
            <option value="PERLU_DIPROSES">Perlu Diproses</option>
            <option value="SEDANG_REHABILITASI">Sedang Rehabilitasi</option>
            <option value="HUNIAN_LAYAK_SELESAI">Mandiri / Selesai</option>
          </select>
          <select aria-label="Filter kategori" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="">Semua Kategori</option>
            {categories.map((category) => <option key={category}>{category}</option>)}
          </select>
        </div>
      </div>
      <div className={styles.desktopTable}>
        <table>
          <thead><tr><th>ID Rujukan / Warga</th><th>Tanggal</th><th>Kategori &amp; Kelurahan</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>{filtered.map((item) => <tr key={item.id}>
            <td><strong>{item.name}</strong><span className={styles.muted}>{item.maskedNik}<br />{item.code}</span></td>
            <td>{item.date}</td>
            <td><strong>{item.infrastructureCategory}</strong><span className={styles.muted}>{item.kelurahan}</span></td>
            <td><StatusBadge status={item.status} /></td>
            <td>{item.status === "PERLU_DIPROSES"
              ? <button className={`${styles.action} ${styles.actionPrimary}`} onClick={() => open(item, "start")}>Proses Intervensi</button>
              : item.status === "SEDANG_REHABILITASI"
                ? <button className={styles.action} onClick={() => open(item, "progress")}>Update Progress</button>
                : <button className={styles.action} onClick={() => open(item, "detail")}>Detail</button>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className={styles.mobileCards}>{filtered.map((item) => <article key={item.id}>
        <header><div><h3>{item.name}</h3><span className={styles.muted}>{item.maskedNik}<br />{item.code}</span></div><StatusBadge status={item.status} /></header>
        <dl><div><dt>Tanggal</dt><dd>{item.date}</dd></div><div><dt>Kategori / Kelurahan</dt><dd>{item.infrastructureCategory}<br />{item.kelurahan}</dd></div></dl>
        <button className={`${styles.action} ${item.status === "PERLU_DIPROSES" ? styles.actionPrimary : ""}`} onClick={() => open(item, item.status === "PERLU_DIPROSES" ? "start" : item.status === "SEDANG_REHABILITASI" ? "progress" : "detail")}>
          {item.status === "PERLU_DIPROSES" ? "Proses Intervensi" : item.status === "SEDANG_REHABILITASI" ? "Update Progress" : "Detail"}
        </button>
      </article>)}</div>
      {!filtered.length && <p className={styles.emptyState}>Belum ada rujukan Cipta Bintar yang sesuai filter.</p>}
      <nav className={styles.pagination} aria-label="Halaman rujukan"><p>Menampilkan 1â€“{filtered.length} dari {referrals.length} data</p><div className={styles.pages}><span><ChevronLeft size={15} /></span><strong aria-current="page">1</strong><span><ChevronRight size={15} /></span></div></nav>
    </section>

    {selected && mode === "start" && <Dialog
      title={`Proses Intervensi Cipta Bintar â€” ${selected.code}`}
      close={close}
      footer={<><button className={styles.secondary} onClick={close}>Batal</button><button className={styles.primary} type="submit" form="start-cipta-bintar">Simpan &amp; Mulai Pengerjaan Fisik</button></>}
    >
      <form id="start-cipta-bintar" className={styles.form} onSubmit={submitStart}>
        <div className={styles.identity}><small>Identitas Warga</small><h3>{selected.name}</h3><p>NIK: {selected.maskedNik} | Desil: Desil {selected.desil || "â€”"} | Kelurahan: {selected.kelurahan}</p><span className={styles.badge}>Infrastruktur &amp; Permukiman</span></div>
        <label>Jenis Program Intervensi Cipta Bintar<select name="infrastructureCategory" defaultValue={selected.infrastructureCategory || "Rehabilitasi Rutilahu"} required><option>Rehabilitasi Rutilahu</option><option>Sanitasi Komunal &amp; MCK</option><option>Sambungan Air Bersih</option></select></label>
        <label>Program Rehabilitasi Target<select name="programId" defaultValue={programs.find((item) => item.id === selected.programId)?.id ?? programs.find((item) => item.status === "AKTIF")?.id} required>{programs.filter((item) => item.status !== "PENUH").map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select></label>
        <div className={styles.twoColumns}><label>Alokasi Pagu Anggaran Rehabilitasi<input name="allocatedBudget" type="number" min="0" max="1000000000000" defaultValue={programs.find((item) => item.id === selected.programId)?.budgetPerUnit ?? 25000000} required /></label><label>Tanggal Mulai Pengerjaan Fisik<input type="date" name="startDate" defaultValue={today} required /></label></div>
        <label>Rencana Rincian Perbaikan &amp; Catatan Verifikasi Lapangan<textarea name="actionPlan" defaultValue={selected.actionPlan} minLength={10} maxLength={2000} required /></label>
        {notice && <p role="status">{notice}</p>}
      </form>
    </Dialog>}

    {selected && mode === "progress" && <Dialog
      title={`Update Progress Intervensi â€” ${selected.code}`}
      close={close}
      footer={<><button className={styles.secondary} onClick={close}>Batal</button><button className={styles.primary} type="submit" form="progress-cipta-bintar">{completionSelected ? "Simpan & Selesaikan Rehabilitasi" : "Simpan Status"}</button></>}
    >
      <form id="progress-cipta-bintar" className={styles.form} onSubmit={submitProgress}>
        <div className={styles.identity}><small>Nama Warga</small><h3>{selected.name} ({selected.maskedNik})</h3><div className={styles.twoColumns}><div><small>Desil &amp; Kelurahan</small><p>Desil {selected.desil || "â€”"} | {selected.kelurahan}</p></div><div><small>Program</small><p>{selected.program}</p></div></div><span className={styles.badge}>Sedang Rehabilitasi</span></div>
        <label>Status Intervensi Baru<select name="participantStatus" defaultValue="DALAM_PENGERJAAN" onChange={(event) => setCompletionSelected(event.target.value === "HUNIAN_LAYAK_SELESAI")} required><option value="DALAM_PENGERJAAN">Sedang Pengerjaan Fisik</option><option value="HUNIAN_LAYAK_SELESAI">Rehabilitasi Selesai / Layak Huni</option></select></label>
        {!completionSelected && <label>Progres Fisik Bangunan (%)<input name="progressPercent" type="number" min="0" max="99" defaultValue={selected.progress ?? 0} required /></label>}
        {completionSelected && <><label>Progres Fisik Bangunan (%)<input value="100%" readOnly /></label><label>Status Hasil Kelayakan<select defaultValue="LAYAK_HUNI_BERFUNGSI"><option value="LAYAK_HUNI_BERFUNGSI">Fasilitas MCK &amp; Sanitasi Berfungsi 100%</option></select></label><label>Nilai Realisasi Anggaran (Rp)<input name="realizationValue" type="number" min="0" max="1000000000000" defaultValue={selected.allocatedBudget ?? 0} required /></label><label>Tanggal Selesai Rehabilitasi<input name="completionDate" type="date" defaultValue={today} required /></label></>}
        <label>Catatan Evaluasi &amp; Lapangan<textarea name="evaluation" defaultValue={selected.evaluation ?? ""} minLength={10} maxLength={2000} required /></label>
        {notice && <p role="status">{notice}</p>}
      </form>
    </Dialog>}

    {selected && mode === "detail" && <Drawer
      title={`Detail Intervensi Cipta Bintar â€” ${selected.code}`}
      close={close}
      footer={<><button className={styles.secondary} type="button" onClick={() => window.print()}><Printer size={16} /> Unduh Rekap (PDF)</button><button className={styles.secondary} onClick={close}>Tutup</button></>}
    >
      <div className={styles.detailStack}>
        <div className={styles.identity}><small>Nama Warga</small><h3>{selected.name}</h3><p>({selected.maskedNik})</p><span className={`${styles.badge} ${styles.badgeGreen}`}>Mandiri / Selesai</span><div className={styles.twoColumns}><div><small>Desil &amp; Kelurahan</small><strong>Desil {selected.desil || "â€”"} | {selected.kelurahan}</strong></div><div><small>Program</small><strong>{selected.program}</strong></div></div></div>
        <div className={styles.twoColumns}><div className={styles.detailBox}><small>Jenis Bantuan / Sarana</small><strong>{selected.aidPackage}</strong></div><div className={styles.detailBox}><small>Alokasi Pagu Anggaran</small><strong>{rupiah.format(selected.realizationValue ?? selected.allocatedBudget ?? 0)}</strong></div></div>
        <section><h2>Riwayat Pelaksanaan &amp; Realisasi Fisik</h2><div className={styles.timeline}>{selected.timeline.map((event) => <div key={event.id} aria-current={event.type === "COMPLETED" ? "step" : undefined}><span className={styles.muted}>{event.date}</span><p>{event.note}{event.progress === null ? "" : ` â€” Progress ${event.progress}%`}</p></div>)}</div>{!selected.timeline.length && <p className={styles.muted}>Belum ada riwayat pelaksanaan.</p>}</section>
        <div className={styles.detailBox}><small>Status Hasil Kelayakan</small><strong>{feasibilityLabel(selected.feasibilityStatus)}</strong></div>
      </div>
    </Drawer>}
  </section>;
}
