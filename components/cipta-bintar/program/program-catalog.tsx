"use client";

import { Building2, CalendarDays, ChevronLeft, ChevronRight, Download, Eye, House, Printer } from "lucide-react";
import { useMemo, useState } from "react";

import { Dialog, Drawer } from "@/components/cipta-bintar/shared/dialog";
import styles from "@/components/cipta-bintar/shared/cipta-bintar-ui.module.css";
import type { CiptaBintarFeasibilityStatus, CiptaBintarOfficer, CiptaBintarParticipantStatus, CiptaBintarProgram, CiptaBintarReferral } from "@/lib/cipta-bintar/data";

type Modal = "add" | "manage" | "allocate" | "participant" | "participantDetail" | "programDetail" | null;

function participantLabel(status: CiptaBintarParticipantStatus | null) {
  if (status === "HUNIAN_LAYAK_SELESAI") return "Rehabilitasi Selesai / Layak Huni";
  if (status === "TIDAK_AKTIF") return "Tidak Aktif";
  return "Dalam Pengerjaan";
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
  initialPrograms: CiptaBintarProgram[];
  referrals: CiptaBintarReferral[];
  officers: CiptaBintarOfficer[];
}) {
  const [programs, setPrograms] = useState(initialPrograms);
  const [referrals, setReferrals] = useState(initialReferrals);
  const [modal, setModal] = useState<Modal>(null);
  const [selectedProgram, setSelectedProgram] = useState<CiptaBintarProgram | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<CiptaBintarReferral | null>(null);
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

  function openProgram(program: CiptaBintarProgram, next: Modal) {
    setSelectedProgram(program);
    setSelectedParticipant(null);
    setNotice("");
    setModal(next);
  }

  function openParticipant(participant: CiptaBintarReferral, next: Modal) {
    setSelectedParticipant(participant);
    setCompletionSelected(false);
    setNotice("");
    setModal(next);
  }

  async function addProgram(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/cipta-bintar/programs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: form.get("code"),
        name: form.get("name"),
        category: form.get("category"),
        petugasId: form.get("petugasId"),
        startDate: form.get("startDate"),
        duration: Number(form.get("duration")),
        durationUnit: String(form.get("durationUnit")).toUpperCase(),
        capacity: Number(form.get("capacity")),
        budgetPerUnit: Number(form.get("budgetPerUnit")),
        description: form.get("description"),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(body.error ?? "Program tidak dapat disimpan.");
      return;
    }
    const officer = officers.find((item) => item.id === form.get("petugasId"));
    setPrograms((items) => [{
      id: body.programId,
      code: String(form.get("code")),
      name: String(form.get("name")),
      category: String(form.get("category")),
      petugasId: String(form.get("petugasId")),
      officerName: officer?.name ?? "â€”",
      serviceArea: officer?.serviceArea ?? "â€”",
      duration: String(form.get("startDate")),
      filled: 0,
      capacity: Number(form.get("capacity")),
      status: "AKTIF",
      location: officer?.location ?? "Kota Bandung",
      facilitation: String(form.get("description")),
      budgetPerUnit: Number(form.get("budgetPerUnit")),
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
    const response = await fetch(`/api/cipta-bintar/referrals/${candidate.id}/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        programId: selectedProgram.id,
        petugasId: selectedProgram.petugasId,
        objectAddress: candidate.objectAddress,
        infrastructureCategory: selectedProgram.category,
        objectLocation: candidate.objectLocation ?? candidate.kelurahan,
        aidPackage: selectedProgram.facilitation,
        allocatedBudget: selectedProgram.budgetPerUnit,
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
      petugasId: selectedProgram.petugasId,
      officerName: selectedProgram.officerName,
      objectAddress: candidate.objectAddress,
      infrastructureCategory: selectedProgram.category,
      objectLocation: candidate.objectLocation ?? candidate.kelurahan,
      aidPackage: selectedProgram.facilitation,
      actionPlan: String(form.get("actionPlan")),
      status: "SEDANG_REHABILITASI",
      participantStatus: "DALAM_PENGERJAAN",
      feasibilityStatus: "BELUM_DIVERIFIKASI",
      progress: 0,
      allocatedBudget: selectedProgram.budgetPerUnit,
      timeline: [...item.timeline, {
        id: crypto.randomUUID(),
        type: "STARTED",
        date: "Hari ini",
        note: "Penerima dialokasikan ke program rehabilitasi infrastruktur.",
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
    const isCompletion = form.get("participantStatus") === "HUNIAN_LAYAK_SELESAI";
    const endpoint = isCompletion
      ? `/api/cipta-bintar/interventions/${selectedParticipant.interventionId}/complete`
      : `/api/cipta-bintar/interventions/${selectedParticipant.interventionId}/progress`;
    const payload = isCompletion
      ? {
          realizationValue: Number(form.get("realizationValue")),
          completionDate: form.get("completionDate"),
          evaluation: form.get("evaluation"),
        }
      : {
          participantStatus: "DALAM_PENGERJAAN",
          progressPercent: Number(form.get("progressPercent")),
          feasibilityStatus: form.get("feasibilityStatus"),
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
    const feasibilityStatus = isCompletion
      ? "LAYAK_HUNI_BERFUNGSI"
      : String(form.get("feasibilityStatus")) as CiptaBintarFeasibilityStatus;
    const participantStatus = isCompletion ? "HUNIAN_LAYAK_SELESAI" : "DALAM_PENGERJAAN";
    const evaluation = String(form.get("evaluation"));
    setReferrals((items) => items.map((item) => item.id === selectedParticipant.id ? {
      ...item,
      status: isCompletion ? "HUNIAN_LAYAK_SELESAI" : item.status,
      participantStatus,
      progress,
      feasibilityStatus,
      evaluation,
      realizationValue: isCompletion ? Number(form.get("realizationValue")) : item.realizationValue,
      timeline: [...item.timeline, {
        id: crypto.randomUUID(),
        type: isCompletion ? "COMPLETED" : "PROGRESS_UPDATED",
        date: "Hari ini",
        note: evaluation,
        progress,
      }],
    } : item));
    setNotice(isCompletion ? "Rehabilitasi berhasil diselesaikan." : "Progres fisik berhasil disimpan.");
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
        <h1 id="program-title">Katalog Program Infrastruktur</h1>
        <p>Daftar program bantuan perbaikan Rutilahu, fasilitasi sanitasi/MCK komunal, dan alokasi kuota unit infrastruktur permukiman MBI.</p>
      </div>
      <button className={styles.primary} onClick={() => setModal("add")} disabled={!officers.length}>+ Tambah Program / Bantuan</button>
    </div>

    <div className={styles.summaryGrid}>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><CalendarDays size={27} /></span><div><p>Program Aktif</p><strong>{programs.filter((program) => program.status === "AKTIF").length} <small>Program</small></strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><Building2 size={27} /></span><div><p>Total Kuota Teralokasi</p><strong>{programs.reduce((sum, program) => sum + program.capacity, 0)} <small>Unit / Lokasi</small></strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><House size={27} /></span><div><p>Hunian Layak / Terpeta</p><strong>{referrals.filter((item) => item.status === "HUNIAN_LAYAK_SELESAI").length} <small>Permukiman</small></strong></div></article>
    </div>

    <section className={styles.card} aria-label="Katalog program infrastruktur">
      <div className={styles.filters}>
        <input style={{ minWidth: 420 }} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari kode, nama program, atau jenis bantuan..." aria-label="Cari program" />
        <div className={styles.filterControls}>
          <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Kategori"><option value="">Semua Program</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status"><option value="">Semua Status</option><option>AKTIF</option><option>PENUH</option><option>NONAKTIF</option></select>
        </div>
      </div>
      <div className={styles.desktopTable}>
        <table>
          <thead><tr><th>Kode &amp; Nama Program</th><th>Kategori &amp; Jadwal</th><th>Kuota &amp; Alokasi</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>{filtered.map((program) => {
            const percent = program.capacity ? Math.round(Math.min(100, program.filled / program.capacity * 100) * 100) / 100 : 0;
            return <tr key={program.id}>
              <td><strong>{program.name}</strong><span className={styles.muted}>{program.code}</span></td>
              <td><strong>{program.category}</strong><span className={styles.muted}>{program.duration}</span></td>
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
      {!filtered.length && <p className={styles.emptyState}>Belum ada program Cipta Bintar yang sesuai filter.</p>}
      <nav className={styles.pagination}><p>Menampilkan 1â€“{filtered.length} dari {programs.length} data</p><div className={styles.pages}><span><ChevronLeft size={15} /></span><strong>1</strong><span><ChevronRight size={15} /></span></div></nav>
    </section>

    {modal === "add" && <Dialog title="Tambah Program / Bantuan Baru" close={close} footer={<><button className={styles.secondary} onClick={close}>Batal</button><button type="submit" form="add-program" className={styles.primary}>Simpan &amp; Terbitkan Program</button></>}>
      <form id="add-program" className={styles.form} onSubmit={addProgram}>
        <div className={styles.twoColumns}><label>Kode Program<input name="code" defaultValue={`PRG-INF-${String(programs.length + 1).padStart(2, "0")}`} pattern="PRG-INF-[0-9]{2}" required /></label><label>Nama Program / Bantuan<input name="name" placeholder="Program Rehabilitasi Rumah Swadaya MBI 2026" minLength={5} required /></label></div>
        <label>Kategori Program<select name="category" defaultValue="Rehabilitasi Rutilahu (Atap, Dinding, & Lantai)" required><option>Rehabilitasi Rutilahu (Atap, Dinding, &amp; Lantai)</option><option>Sanitasi &amp; Pengolahan Limbah</option><option>Sambungan Rumah (SR) Air Bersih</option><option>Penataan Lingkungan Permukiman</option></select></label>
        <input type="hidden" name="petugasId" value={officers[0]?.id ?? ""} />
        <div className={styles.twoColumns}><label>Durasi / Target Waktu<span className={styles.inlineFields}><input name="duration" type="number" min="1" max="60" defaultValue="3" required /><select name="durationUnit"><option>Bulan</option><option>Minggu</option><option>Hari</option></select></span></label><label>Tanggal Pelaksanaan<input name="startDate" type="date" defaultValue={today} required /></label></div>
        <div className={styles.twoColumns}><label>Pagu Anggaran per Unit<input name="budgetPerUnit" type="number" min="0" max="1000000000000" defaultValue="25000000" required /></label><label>Total Kuota (Unit Rumah / Lokasi)<input name="capacity" type="number" min="1" max="10000" defaultValue="40" required /></label></div>
        <label>Deskripsi Jenis Bantuan / Sarana<textarea name="description" placeholder="Jelaskan lingkup pekerjaan, sarana, target kelayakan, dan dukungan teknis." minLength={10} required /></label>
        {notice && <p role="status">{notice}</p>}
      </form>
    </Dialog>}

    {modal === "manage" && selectedProgram && <Dialog wide title={`Kelola Penerima Program â€” ${selectedProgram.code}`} close={close} footer={<><button className={styles.secondary} onClick={() => window.print()}><Printer size={16} /> Unduh Daftar Penerima</button><button className={styles.secondary} onClick={close}>Tutup</button></>}>
      <div className={styles.detailStack}>
        <div className={styles.identity}><small>Nama Program</small><h3>{selectedProgram.name}</h3><p>{selectedProgram.officerName} | {selectedProgram.location}</p><span className={`${styles.badge} ${styles.badgeGreen}`}>AKTIF ({selectedProgram.filled} / {selectedProgram.capacity} TERISI)</span></div>
        <div className={styles.filters}><h3>Daftar Penerima Manfaat</h3>{selectedProgram.filled < selectedProgram.capacity && <button className={styles.primary} onClick={() => setModal("allocate")}>+ Alokasikan Penerima Baru</button>}</div>
        <div className={styles.desktopTable}><table><thead><tr><th>NIK &amp; Nama Warga</th><th>Kelurahan &amp; Lokasi</th><th>Status Pelaksanaan</th><th>Aksi</th></tr></thead><tbody>{participants.map((person) => <tr key={person.id}><td><strong>{person.name}</strong><span className={styles.muted}>{person.maskedNik}</span></td><td><strong>{person.kelurahan}</strong><span className={styles.muted}>{person.objectAddress}</span></td><td><span className={`${styles.badge} ${person.participantStatus === "HUNIAN_LAYAK_SELESAI" ? styles.badgeGreen : ""}`}>{participantLabel(person.participantStatus)}</span></td><td><button className={styles.action} onClick={() => openParticipant(person, person.participantStatus === "HUNIAN_LAYAK_SELESAI" ? "participantDetail" : "participant")}>{person.participantStatus === "HUNIAN_LAYAK_SELESAI" ? <><Eye size={15} /> Detail</> : "Update Status"}</button></td></tr>)}</tbody></table></div>
        {!participants.length && <p className={styles.emptyState}>Belum ada penerima pada program ini.</p>}
      </div>
    </Dialog>}

    {modal === "allocate" && selectedProgram && <Dialog title="Alokasikan Penerima Baru" close={() => setModal("manage")} footer={<><button className={styles.secondary} onClick={() => setModal("manage")}>Batal</button><button className={styles.primary} type="submit" form="allocate-form">Simpan Alokasi</button></>}>
      <form id="allocate-form" className={styles.form} onSubmit={allocateParticipant}>
        <div className={styles.identity}><div className={styles.twoColumns}><div><small>Program</small><h3>{selectedProgram.name}</h3></div><div><small>Sisa Kuota Program</small><h3>{Math.max(0, selectedProgram.capacity - selectedProgram.filled)} Unit Rumah</h3></div></div></div>
        <label>Pilih Warga Rujukan MBI<select name="referralId" required><option value="">Pilih warga</option>{candidates.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.maskedNik}) â€” {item.kelurahan}</option>)}</select></label>
        <label>Status Alokasi Awal<select defaultValue="VERIFIKASI"><option value="VERIFIKASI">Tahap Verifikasi Lapangan</option></select></label>
        <label>Catatan Verifikasi &amp; Instruksi Pengerjaan<textarea name="actionPlan" defaultValue="Alokasi bantuan rehabilitasi fisik dan survei kelayakan oleh tim teknis Cipta Bintar." minLength={10} required /></label>
        {notice && <p role="status">{notice}</p>}
      </form>
    </Dialog>}

    {modal === "participant" && selectedParticipant && selectedProgram && <Dialog title={`Update Status Pelaksanaan â€” ${selectedParticipant.name}`} close={() => setModal("manage")} footer={<><button className={styles.secondary} onClick={() => setModal("manage")}>Batal</button><button className={styles.primary} type="submit" form="participant-form">{completionSelected ? "Simpan & Selesaikan Rehabilitasi" : "Simpan Progress"}</button></>}>
      <form id="participant-form" className={styles.form} onSubmit={updateParticipant}>
        <div className={styles.identity}><div className={styles.twoColumns}><div><small>Nama Warga</small><h3>{selectedParticipant.name}</h3><span className={styles.muted}>{selectedParticipant.maskedNik}</span></div><div><small>Alamat &amp; Kelurahan</small><p>{selectedParticipant.objectAddress}<br />{selectedParticipant.kelurahan}</p></div></div><small>Status Saat Ini</small><span className={styles.badge}>{participantLabel(selectedParticipant.participantStatus)}</span></div>
        <label>Status Pelaksanaan Baru<select name="participantStatus" defaultValue="DALAM_PENGERJAAN" onChange={(event) => setCompletionSelected(event.target.value === "HUNIAN_LAYAK_SELESAI")} required><option value="DALAM_PENGERJAAN">Sedang Pengerjaan Fisik</option><option value="HUNIAN_LAYAK_SELESAI">Rehabilitasi Selesai / Layak Huni</option></select></label>
        {!completionSelected && <div className={styles.twoColumns}><label>Progres Fisik Bangunan (%)<input name="progressPercent" type="number" min="0" max="99" defaultValue={selectedParticipant.progress ?? 0} required /></label><label>Status Hasil Kelayakan<select name="feasibilityStatus" defaultValue={selectedParticipant.feasibilityStatus ?? "BELUM_DIVERIFIKASI"} required><option value="BELUM_DIVERIFIKASI">Tahap Verifikasi Lapangan</option><option value="PROGRES_FISIK">Dalam Pengerjaan Fisik</option><option value="LAYAK_HUNI_BERFUNGSI">Hunian Layak &amp; Fasilitas Berfungsi</option></select></label></div>}
        {completionSelected && <><div className={styles.twoColumns}><label>Titik Objek / Lokasi<input value={selectedParticipant.objectLocation ?? "Belum ditentukan"} readOnly /></label><label>Nilai Realisasi Anggaran (Rp)<input name="realizationValue" type="number" min="0" max="1000000000000" required /></label></div><label>Tanggal Selesai Rehabilitasi<input name="completionDate" type="date" defaultValue={today} required /></label></>}
        <label>Catatan Progres Cipta Bintar<textarea name="evaluation" defaultValue={selectedParticipant.evaluation ?? ""} minLength={10} required /></label>
        {notice && <p role="status">{notice}</p>}
      </form>
    </Dialog>}

    {modal === "participantDetail" && selectedParticipant && <Dialog title={`Detail Penerima â€” ${selectedParticipant.code}`} close={() => setModal("manage")} footer={<><button className={styles.secondary} onClick={() => window.print()}><Printer size={16} /> Unduh Rekap Program</button><button className={styles.secondary} onClick={() => setModal("manage")}>Tutup</button></>}>
      <div className={styles.detailStack}><div className={styles.identity}><small>Nama Warga</small><h3>{selectedParticipant.name} ({selectedParticipant.maskedNik})</h3><div className={styles.twoColumns}><div><small>Titik Objek / Lokasi</small><strong>{selectedParticipant.objectLocation ?? "â€”"}</strong></div><div><small>Realisasi Anggaran</small><strong>{selectedParticipant.realizationValue === null ? "â€”" : rupiah.format(selectedParticipant.realizationValue)}</strong></div></div><span className={`${styles.badge} ${styles.badgeGreen}`}>Hunian Layak / Selesai</span></div><section><h2>Riwayat Pelaksanaan</h2><div className={styles.timeline}>{selectedParticipant.timeline.map((entry) => <div key={entry.id}><span className={styles.muted}>{entry.date}</span><p>{entry.note}{entry.progress === null ? "" : ` â€” Progress ${entry.progress}%`}</p></div>)}</div></section></div>
    </Dialog>}

    {modal === "programDetail" && selectedProgram && <Drawer title={`Detail Program â€” ${selectedProgram.code}`} close={close} footer={<><button className={styles.secondary} onClick={() => window.print()}><Download size={16} /> Unduh Rekap Program</button><button className={styles.secondary} onClick={close}>Tutup</button></>}>
      <div className={styles.detailStack}><div className={styles.identity}><small>Nama Program</small><h3>{selectedProgram.name}</h3><p>{selectedProgram.category} | {selectedProgram.duration}</p><span className={`${styles.badge} ${selectedProgram.status === "PENUH" ? styles.badgeAmber : styles.badgeGreen}`}>{selectedProgram.status} ({selectedProgram.filled}/{selectedProgram.capacity} UNIT TERISI)</span></div><div className={styles.twoColumns}><div className={styles.detailBox}><small>Fasilitas Utama</small><strong>{selectedProgram.facilitation}</strong></div><div className={styles.detailBox}><small>Penerima Manfaat</small><strong>{selectedProgram.capacity} Unit Rumah / Lokasi</strong></div></div><section><h2>Riwayat Tahapan Program</h2>{referrals.filter((item) => item.programId === selectedProgram.id).map((item) => <div className={styles.detailBox} key={item.id}><Building2 size={20} /><strong>{item.name}</strong><span className={styles.muted}>{item.maskedNik}<br />{item.objectLocation ?? item.kelurahan}</span></div>)}</section></div>
    </Drawer>}
  </section>;
}
