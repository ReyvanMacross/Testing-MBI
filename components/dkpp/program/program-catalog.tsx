"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Download, Eye, Printer, Sprout, UserRoundCheck, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";

import { Dialog, Drawer } from "@/components/dkpp/shared/dialog";
import styles from "@/components/dkpp/shared/dkpp-ui.module.css";
import type { DkppHarvestStatus, DkppOfficer, DkppParticipantStatus, DkppProgram, DkppReferral } from "@/lib/dkpp/data";

type Modal = "add" | "manage" | "allocate" | "participant" | "participantDetail" | "programDetail" | null;

function participantLabel(status: DkppParticipantStatus | null) {
  if (status === "MANDIRI_SELESAI") return "Bantuan Diserahkan & Pelatihan Selesai";
  if (status === "TIDAK_AKTIF") return "Tidak Aktif";
  return "Penerima Bantuan";
}

const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function ProgramCatalog({
  initialPrograms,
  referrals: initialReferrals,
  officers,
}: {
  initialPrograms: DkppProgram[];
  referrals: DkppReferral[];
  officers: DkppOfficer[];
}) {
  const [programs, setPrograms] = useState(initialPrograms);
  const [referrals, setReferrals] = useState(initialReferrals);
  const [modal, setModal] = useState<Modal>(null);
  const [selectedProgram, setSelectedProgram] = useState<DkppProgram | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<DkppReferral | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState("");
  const [completionSelected, setCompletionSelected] = useState(false);

  const participants = selectedProgram
    ? referrals.filter((item) => item.programId === selectedProgram.id && item.interventionId)
    : [];
  const candidates = referrals.filter((item) => item.status === "PERLU_DIPROSES");
  const categories = [...new Set(programs.map((program) => program.category))];
  const filtered = useMemo(() => programs.filter((program) => {
    const haystack = `${program.name} ${program.code} ${program.category} ${program.officerName}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase()))
      && (!category || program.category === category)
      && (!status || program.status === status);
  }), [category, programs, query, status]);

  function close() {
    setModal(null);
    setSelectedProgram(null);
    setSelectedParticipant(null);
    setNotice("");
    setCompletionSelected(false);
  }

  function openProgram(program: DkppProgram, next: Modal) {
    setSelectedProgram(program);
    setSelectedParticipant(null);
    setNotice("");
    setModal(next);
  }

  function openParticipant(participant: DkppReferral, next: Modal) {
    setSelectedParticipant(participant);
    setCompletionSelected(false);
    setNotice("");
    setModal(next);
  }

  async function addProgram(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/dkpp/programs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: form.get("code"),
        name: form.get("name"),
        category: form.get("category"),
        penyuluhId: form.get("penyuluhId"),
        duration: Number(form.get("duration")),
        durationUnit: String(form.get("durationUnit")).toUpperCase(),
        capacity: Number(form.get("capacity")),
        description: form.get("description"),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(body.error ?? "Program tidak dapat disimpan.");
      return;
    }
    const officer = officers.find((item) => item.id === form.get("penyuluhId"));
    setPrograms((items) => [{
      id: body.programId,
      code: String(form.get("code")),
      name: String(form.get("name")),
      category: String(form.get("category")),
      penyuluhId: String(form.get("penyuluhId")),
      officerName: officer?.name ?? "—",
      cluster: officer?.cluster ?? "—",
      duration: `${form.get("duration")} ${form.get("durationUnit")}`,
      filled: 0,
      capacity: Number(form.get("capacity")),
      status: "AKTIF",
      location: officer?.location ?? "Kota Bandung",
      facilitation: String(form.get("description")),
    }, ...items]);
    setNotice("Program berhasil diterbitkan.");
    window.setTimeout(close, 650);
  }

  async function allocateParticipant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProgram) return;
    const form = new FormData(event.currentTarget);
    const candidate = referrals.find((item) => item.id === form.get("referralId"));
    if (!candidate) {
      setNotice("Warga rujukan wajib dipilih.");
      return;
    }
    const response = await fetch(`/api/dkpp/referrals/${candidate.id}/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        programId: selectedProgram.id,
        penyuluhId: selectedProgram.penyuluhId,
        groupName: form.get("groupName"),
        foodCategory: selectedProgram.category,
        plotLocation: form.get("plotLocation"),
        aidPackage: form.get("aidPackage"),
        startDate: today,
        actionPlan: form.get("actionPlan"),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(body.error ?? "Penerima tidak dapat dialokasikan.");
      return;
    }
    setReferrals((items) => items.map((item) => item.id === candidate.id ? {
      ...item,
      interventionId: body.interventionId,
      programId: selectedProgram.id,
      program: selectedProgram.name,
      penyuluhId: selectedProgram.penyuluhId,
      officerName: selectedProgram.officerName,
      groupName: String(form.get("groupName")),
      foodCategory: selectedProgram.category,
      plotLocation: String(form.get("plotLocation")),
      aidPackage: String(form.get("aidPackage")),
      actionPlan: String(form.get("actionPlan")),
      status: "SEDANG_DIDAMPINGI",
      participantStatus: "AKTIF_PENDAMPINGAN",
      harvestStatus: "BELUM_PANEN",
      progress: 0,
      timeline: [...item.timeline, {
        id: crypto.randomUUID(),
        type: "STARTED",
        date: "Hari ini",
        note: "Penerima dialokasikan ke program Buruan SAE.",
        progress: 0,
      }],
    } : item));
    setPrograms((items) => items.map((item) => item.id === selectedProgram.id
      ? { ...item, filled: item.filled + 1 }
      : item));
    setNotice("Penerima berhasil dialokasikan.");
    window.setTimeout(() => setModal("manage"), 650);
  }

  async function updateParticipant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedParticipant?.interventionId) return;
    const form = new FormData(event.currentTarget);
    const isCompletion = form.get("participantStatus") === "MANDIRI_SELESAI";
    const endpoint = isCompletion
      ? `/api/dkpp/interventions/${selectedParticipant.interventionId}/complete`
      : `/api/dkpp/interventions/${selectedParticipant.interventionId}/progress`;
    const payload = isCompletion
      ? {
          harvestValue: Number(form.get("harvestValue")),
          completionDate: form.get("completionDate"),
          evaluation: form.get("evaluation"),
        }
      : {
          participantStatus: "AKTIF_PENDAMPINGAN",
          progressPercent: Number(form.get("progressPercent")),
          harvestStatus: form.get("harvestStatus"),
          evaluation: form.get("evaluation"),
        };
    const response = await fetch(endpoint, {
      method: isCompletion ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(body.error ?? "Progress peserta tidak dapat disimpan.");
      return;
    }
    const progress = isCompletion ? 100 : Number(form.get("progressPercent"));
    const harvestStatus = isCompletion
      ? "MEMENUHI_DAN_DIPASARKAN"
      : String(form.get("harvestStatus")) as DkppHarvestStatus;
    const participantStatus = isCompletion ? "MANDIRI_SELESAI" : "AKTIF_PENDAMPINGAN";
    const evaluation = String(form.get("evaluation"));
    setReferrals((items) => items.map((item) => item.id === selectedParticipant.id ? {
      ...item,
      status: isCompletion ? "MANDIRI_SELESAI" : item.status,
      participantStatus,
      progress,
      harvestStatus,
      evaluation,
      harvestValue: isCompletion ? Number(form.get("harvestValue")) : item.harvestValue,
      timeline: [...item.timeline, {
        id: crypto.randomUUID(),
        type: isCompletion ? "COMPLETED" : "PROGRESS_UPDATED",
        date: "Hari ini",
        note: evaluation,
        progress,
      }],
    } : item));
    setNotice(isCompletion ? "Pendampingan berhasil diselesaikan." : "Progress peserta berhasil disimpan.");
    window.setTimeout(() => {
      setSelectedParticipant(null);
      setModal("manage");
      setNotice("");
      setCompletionSelected(false);
    }, 650);
  }

  return <section aria-labelledby="program-title">
    <div className={styles.pageHeading}>
      <div>
        <h1 id="program-title">Katalog Program Buruan SAE</h1>
        <p>Pengelolaan alokasi program urban farming, bantuan bibit/pakan, dan pelatihan ketahanan pangan untuk keluarga MBI.</p>
      </div>
      <button className={styles.primary} onClick={() => setModal("add")} disabled={!officers.length}>+ Tambah Program / Bantuan</button>
    </div>

    <div className={styles.summaryGrid}>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><CalendarDays size={27} /></span><div><p>Program Aktif</p><strong>{programs.filter((program) => program.status === "AKTIF").length} <small>Program</small></strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><UsersRound size={27} /></span><div><p>Total Kuota Penerima Manfaat</p><strong>{programs.reduce((sum, program) => sum + program.capacity, 0)} <small>Keluarga</small></strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><UserRoundCheck size={27} /></span><div><p>Terfasilitasi MBI</p><strong>{programs.reduce((sum, program) => sum + program.filled, 0)} <small>Keluarga</small></strong></div></article>
    </div>

    <section className={styles.card} aria-label="Katalog program Buruan SAE">
      <div className={styles.filters}>
        <input style={{ minWidth: 420 }} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari kode, nama program, atau jenis bantuan..." aria-label="Cari program" />
        <div className={styles.filterControls}>
          <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Kategori"><option value="">Semua Program</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status"><option value="">Semua Status</option><option>AKTIF</option><option>PENUH</option><option>NONAKTIF</option></select>
        </div>
      </div>
      <div className={styles.desktopTable}>
        <table>
          <thead><tr><th>Kode &amp; Nama Program</th><th>Kategori &amp; Jadwal</th><th>Penyuluh / Lokasi</th><th>Kuota &amp; Alokasi</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>{filtered.map((program) => {
            const percent = program.capacity ? Math.round(Math.min(100, program.filled / program.capacity * 100) * 100) / 100 : 0;
            return <tr key={program.id}>
              <td><strong>{program.name}</strong><span className={styles.muted}>{program.code}</span></td>
              <td><strong>{program.category}</strong><span className={styles.muted}>{program.duration}</span></td>
              <td><strong>{program.officerName}</strong><span className={styles.muted}>{program.location}</span></td>
              <td><span className={styles.progressTrack}><span style={{ width: `${percent}%`, background: program.status === "PENUH" ? "#9b7600" : percent > 80 ? "#236b39" : "#1457ad" }} /></span>{program.filled} / {program.capacity}</td>
              <td><span className={`${styles.badge} ${program.status === "PENUH" ? styles.badgeAmber : program.status === "AKTIF" ? styles.badgeGreen : ""}`}>{program.status}</span></td>
              <td>{program.status === "AKTIF"
                ? <button className={`${styles.action} ${styles.actionPrimary}`} onClick={() => openProgram(program, "manage")}>Kelola Program</button>
                : <button className={styles.action} onClick={() => openProgram(program, "programDetail")}><Eye size={16} /> Detail</button>}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <div className={styles.mobileCards}>{filtered.map((program) => <article key={program.id}>
        <header><div><h3>{program.name}</h3><span className={styles.muted}>{program.code}</span></div><span className={`${styles.badge} ${program.status === "PENUH" ? styles.badgeAmber : styles.badgeGreen}`}>{program.status}</span></header>
        <dl><div><dt>Kategori</dt><dd>{program.category}</dd></div><div><dt>Kuota</dt><dd>{program.filled} / {program.capacity}</dd></div></dl>
        <button className={`${styles.action} ${program.status === "AKTIF" ? styles.actionPrimary : ""}`} onClick={() => openProgram(program, program.status === "AKTIF" ? "manage" : "programDetail")}>{program.status === "AKTIF" ? "Kelola Program" : "Detail"}</button>
      </article>)}</div>
      {!filtered.length && <p className={styles.emptyState}>Belum ada program pangan yang sesuai filter.</p>}
      <nav className={styles.pagination}><p>Menampilkan 1–{filtered.length} dari {programs.length} data</p><div className={styles.pages}><span><ChevronLeft size={15} /></span><strong>1</strong><span><ChevronRight size={15} /></span></div></nav>
    </section>

    {modal === "add" && <Dialog title="Tambah Program / Bantuan Baru" close={close} footer={<><button className={styles.secondary} onClick={close}>Batal</button><button type="submit" form="add-program" className={styles.primary}>Simpan &amp; Terbitkan Program</button></>}>
      <form id="add-program" className={styles.form} onSubmit={addProgram}>
        <div className={styles.twoColumns}><label>Kode Program<input name="code" defaultValue={`PRG-SAE-${String(programs.length + 1).padStart(2, "0")}`} pattern="PRG-SAE-[0-9]{2}" required /></label><label>Nama Program / Bantuan<input name="name" placeholder="Pelatihan Budidaya Ikan Bioflok 2026" minLength={5} required /></label></div>
        <label>Kategori Program<select name="category" defaultValue="Bantuan Bibit & Ternak" required><option>Urban Farming</option><option>Bantuan Bibit &amp; Ternak</option><option>Pengolahan Limbah Pangan</option><option>Usaha Pangan Keluarga</option></select></label>
        <label>Penyuluh DKPP<select name="penyuluhId" required><option value="">Pilih penyuluh</option>{officers.map((officer) => <option key={officer.id} value={officer.id}>{officer.name} ({officer.cluster})</option>)}</select></label>
        <div className={styles.twoColumns}><label>Durasi / Target Waktu<span className={styles.inlineFields}><input name="duration" type="number" min="1" max="60" defaultValue="2" required /><select name="durationUnit"><option>Bulan</option><option>Minggu</option><option>Hari</option></select></span></label><label>Total Kuota (Kelompok/Keluarga)<input name="capacity" type="number" min="1" max="10000" defaultValue="20" required /></label></div>
        <label>Deskripsi Fasilitas &amp; Jenis Bantuan<textarea name="description" placeholder="Jelaskan bantuan bibit, sarana budidaya, dan pendampingan teknis." minLength={10} required /></label>
        {notice && <p role="status">{notice}</p>}
      </form>
    </Dialog>}

    {modal === "manage" && selectedProgram && <Dialog wide title={`Kelola Peserta Program — ${selectedProgram.code}`} close={close} footer={<><button className={styles.secondary} onClick={() => window.print()}><Printer size={16} /> Unduh Daftar Penerima</button><button className={styles.secondary} onClick={close}>Tutup</button></>}>
      <div className={styles.detailStack}>
        <div className={styles.identity}><small>Nama Program</small><h3>{selectedProgram.name}</h3><p>{selectedProgram.officerName} | {selectedProgram.location}</p><span className={`${styles.badge} ${styles.badgeGreen}`}>AKTIF ({selectedProgram.filled} / {selectedProgram.capacity} TERISI)</span></div>
        <div className={styles.filters}><h3>Peserta Terdaftar</h3>{selectedProgram.filled < selectedProgram.capacity && <button className={styles.primary} onClick={() => setModal("allocate")}>+ Alokasikan Penerima Baru</button>}</div>
        <div className={styles.desktopTable}><table><thead><tr><th>NIK &amp; Nama Warga</th><th>Kelurahan &amp; Kelompok</th><th>Status Keikutsertaan</th><th>Aksi</th></tr></thead><tbody>{participants.map((person) => <tr key={person.id}><td><strong>{person.name}</strong><span className={styles.muted}>{person.maskedNik}</span></td><td><strong>{person.kelurahan}</strong><span className={styles.muted}>{person.groupName}</span></td><td><span className={`${styles.badge} ${person.participantStatus === "MANDIRI_SELESAI" ? styles.badgeGreen : ""}`}>{participantLabel(person.participantStatus)}</span></td><td><button className={styles.action} onClick={() => openParticipant(person, person.participantStatus === "MANDIRI_SELESAI" ? "participantDetail" : "participant")}>{person.participantStatus === "MANDIRI_SELESAI" ? <><Eye size={15} /> Detail</> : "Update Status"}</button></td></tr>)}</tbody></table></div>
        {!participants.length && <p className={styles.emptyState}>Belum ada penerima pada program ini.</p>}
      </div>
    </Dialog>}

    {modal === "allocate" && selectedProgram && <Dialog title="Alokasikan Penerima Program" close={() => setModal("manage")} footer={<><button className={styles.secondary} onClick={() => setModal("manage")}>Batal</button><button className={styles.primary} type="submit" form="allocate-form">Simpan Alokasi</button></>}>
      <form id="allocate-form" className={styles.form} onSubmit={allocateParticipant}>
        <div className={styles.identity}><div className={styles.twoColumns}><div><small>Program</small><h3>{selectedProgram.name}</h3></div><div><small>Sisa Kuota Program</small><h3>{Math.max(0, selectedProgram.capacity - selectedProgram.filled)} Kelompok Tersedia</h3></div></div></div>
        <label>Pilih Warga / Kelompok Rujukan MBI<select name="referralId" required><option value="">Pilih warga</option>{candidates.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.maskedNik}) — {item.kelurahan}</option>)}</select></label>
        <label>Nama Kelompok / Keluarga<input name="groupName" placeholder="KWT Buruan SAE" minLength={3} required /></label>
        <label>Lokasi Unit / Demplot<input name="plotLocation" placeholder="Demplot KWT Sukajadi Blok C" minLength={3} required /></label>
        <label>Fasilitas &amp; Jenis Bantuan<input name="aidPackage" defaultValue={selectedProgram.facilitation} minLength={3} required /></label>
        <label>Catatan Penempatan Program<textarea name="actionPlan" defaultValue="Alokasi bantuan dan pendampingan teknis program Buruan SAE." minLength={10} required /></label>
        {notice && <p role="status">{notice}</p>}
      </form>
    </Dialog>}

    {modal === "participant" && selectedParticipant && selectedProgram && <Dialog title={`Update Status Keikutsertaan — ${selectedParticipant.name}`} close={() => setModal("manage")} footer={<><button className={styles.secondary} onClick={() => setModal("manage")}>Batal</button><button className={styles.primary} type="submit" form="participant-form">{completionSelected ? "Simpan & Selesaikan Pendampingan" : "Simpan Progress"}</button></>}>
      <form id="participant-form" className={styles.form} onSubmit={updateParticipant}>
        <div className={styles.identity}><div className={styles.twoColumns}><div><small>Nama Warga</small><h3>{selectedParticipant.name}</h3><span className={styles.muted}>{selectedParticipant.maskedNik}</span></div><div><small>Kelompok &amp; Kelurahan</small><p>{selectedParticipant.groupName}<br />{selectedParticipant.kelurahan}</p></div></div><small>Status Saat Ini</small><span className={styles.badge}>{participantLabel(selectedParticipant.participantStatus)}</span></div>
        <label>Status Keikutsertaan Baru<select name="participantStatus" defaultValue="AKTIF_PENDAMPINGAN" onChange={(event) => setCompletionSelected(event.target.value === "MANDIRI_SELESAI")} required><option value="AKTIF_PENDAMPINGAN">Penerima Bantuan</option><option value="MANDIRI_SELESAI">Bantuan Diserahkan &amp; Pelatihan Selesai</option></select></label>
        {!completionSelected && <div className={styles.twoColumns}><label>Progress Pendampingan (%)<input name="progressPercent" type="number" min="0" max="99" defaultValue={selectedParticipant.progress ?? 0} required /></label><label>Status Hasil Pangan<select name="harvestStatus" defaultValue={selectedParticipant.harvestStatus ?? "BELUM_PANEN"} required><option value="BELUM_PANEN">Tahap Verifikasi</option><option value="HASIL_MENCUKUPI">Penerima Bantuan</option><option value="MEMENUHI_DAN_DIPASARKAN">Mandiri Pangan</option></select></label></div>}
        {completionSelected && <><div className={styles.twoColumns}><label>Lokasi Unit / Demplot<input value={selectedParticipant.plotLocation ?? "Belum ditentukan"} readOnly /></label><label>Capaian Nilai Panen (Rp)<input name="harvestValue" type="number" min="0" max="1000000000000" required /></label></div><label>Tanggal Selesai Pendampingan<input name="completionDate" type="date" defaultValue={today} required /></label></>}
        <label>Catatan Progress DKPP<textarea name="evaluation" defaultValue={selectedParticipant.evaluation ?? ""} minLength={10} required /></label>
        {notice && <p role="status">{notice}</p>}
      </form>
    </Dialog>}

    {modal === "participantDetail" && selectedParticipant && <Dialog title={`Detail Penerima — ${selectedParticipant.code}`} close={() => setModal("manage")} footer={<><button className={styles.secondary} onClick={() => window.print()}><Printer size={16} /> Unduh Rekap Program</button><button className={styles.secondary} onClick={() => setModal("manage")}>Tutup</button></>}>
      <div className={styles.detailStack}><div className={styles.identity}><small>Nama Warga</small><h3>{selectedParticipant.name} ({selectedParticipant.maskedNik})</h3><div className={styles.twoColumns}><div><small>Lokasi Unit / Demplot</small><strong>{selectedParticipant.plotLocation ?? "—"}</strong></div><div><small>Nilai Panen</small><strong>{selectedParticipant.harvestValue === null ? "—" : rupiah.format(selectedParticipant.harvestValue)}</strong></div></div><span className={`${styles.badge} ${styles.badgeGreen}`}>Mandiri / Selesai</span></div><section><h2>Riwayat Pendampingan</h2><div className={styles.timeline}>{selectedParticipant.timeline.map((entry) => <div key={entry.id}><span className={styles.muted}>{entry.date}</span><p>{entry.note}{entry.progress === null ? "" : ` — Progress ${entry.progress}%`}</p></div>)}</div></section></div>
    </Dialog>}

    {modal === "programDetail" && selectedProgram && <Drawer title={`Detail Program — ${selectedProgram.code}`} close={close} footer={<><button className={styles.secondary} onClick={() => window.print()}><Download size={16} /> Unduh Rekap Program</button><button className={styles.secondary} onClick={close}>Tutup</button></>}>
      <div className={styles.detailStack}><div className={styles.identity}><small>Profil Program Buruan SAE</small><h3>{selectedProgram.name}</h3><p>{selectedProgram.officerName} ({selectedProgram.cluster})</p><span className={`${styles.badge} ${selectedProgram.status === "PENUH" ? styles.badgeAmber : styles.badgeGreen}`}>{selectedProgram.status} ({selectedProgram.filled}/{selectedProgram.capacity})</span></div><div className={styles.detailBox}><small>Durasi Program</small><strong>{selectedProgram.duration}</strong></div><div className={styles.detailBox}><small>Fasilitas Utama</small><strong>{selectedProgram.facilitation}</strong></div><div className={styles.detailBox}><small>Lokasi Program</small><strong>{selectedProgram.location}</strong></div>{referrals.filter((item) => item.programId === selectedProgram.id).map((item) => <div className={styles.detailBox} key={item.id}><Sprout size={20} /><strong>{item.name}</strong><span className={styles.muted}>{item.maskedNik}<br />{item.plotLocation ?? item.kelurahan}</span></div>)}</div>
    </Drawer>}
  </section>;
}
