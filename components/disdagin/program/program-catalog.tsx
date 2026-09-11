"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Download, Eye, Printer, Store, UserRoundCheck, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";

import { Dialog, Drawer } from "@/components/disdagin/shared/dialog";
import styles from "@/components/disdagin/shared/disdagin-ui.module.css";
import type { DisdaginLegalStatus, DisdaginMentor, DisdaginParticipantStatus, DisdaginProgram, DisdaginReferral } from "@/lib/disdagin/data";

type Modal = "add" | "manage" | "participant" | "participantDetail" | "programDetail" | null;

function participantLabel(status: DisdaginParticipantStatus | null) {
  if (status === "MANDIRI_SELESAI") return "Mitra Retail / Selesai";
  if (status === "TIDAK_AKTIF") return "Tidak Aktif";
  return "Aktif Pendampingan";
}

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export function ProgramCatalog({ initialPrograms, referrals: initialReferrals, mentors }: {
  initialPrograms: DisdaginProgram[];
  referrals: DisdaginReferral[];
  mentors: DisdaginMentor[];
}) {
  const [programs, setPrograms] = useState(initialPrograms);
  const [referrals, setReferrals] = useState(initialReferrals);
  const [modal, setModal] = useState<Modal>(null);
  const [selectedProgram, setSelectedProgram] = useState<DisdaginProgram | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<DisdaginReferral | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState("");
  const [completionSelected, setCompletionSelected] = useState(false);
  const participants = selectedProgram ? referrals.filter((item) => item.programId === selectedProgram.id && item.interventionId) : [];
  const completed = participants.filter((item) => item.participantStatus === "MANDIRI_SELESAI").length;
  const graduationRate = participants.length ? Math.round((completed / participants.length) * 100) : null;
  const categories = [...new Set(programs.map((program) => program.category))];
  const filtered = useMemo(() => programs.filter((program) => {
    const haystack = `${program.name} ${program.code} ${program.consultant} ${program.cluster}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase())) && (!category || program.category === category) && (!status || program.status === status);
  }), [category, programs, query, status]);

  function close() {
    setModal(null); setSelectedProgram(null); setSelectedParticipant(null); setNotice(""); setCompletionSelected(false);
  }
  function openProgram(program: DisdaginProgram, next: Modal) {
    setSelectedProgram(program); setSelectedParticipant(null); setNotice(""); setModal(next);
  }
  function openParticipant(participant: DisdaginReferral, next: Modal) {
    setSelectedParticipant(participant); setCompletionSelected(false); setNotice(""); setModal(next);
  }

  async function addProgram(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/disdagin/programs", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: form.get("code"), name: form.get("name"), category: form.get("category"), pendampingId: form.get("pendampingId"), duration: Number(form.get("duration")), durationUnit: String(form.get("durationUnit")).toUpperCase(), capacity: Number(form.get("capacity")), description: form.get("description") }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setNotice(body.error ?? "Program tidak dapat disimpan."); return; }
    const mentor = mentors.find((item) => item.id === form.get("pendampingId"));
    setPrograms((items) => [{ id: body.programId, code: String(form.get("code")), name: String(form.get("name")), category: String(form.get("category")), pendampingId: String(form.get("pendampingId")), consultant: mentor?.name ?? "—", cluster: mentor?.cluster ?? "—", duration: `${form.get("duration")} ${form.get("durationUnit")}`, filled: 0, capacity: Number(form.get("capacity")), status: "AKTIF", location: mentor?.location ?? "Kota Bandung", facilitation: String(form.get("description")) }, ...items]);
    setNotice("Program berhasil diterbitkan."); window.setTimeout(close, 650);
  }

  async function updateParticipant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedParticipant?.interventionId) return;
    const form = new FormData(event.currentTarget);
    const isCompletion = form.get("participantStatus") === "MANDIRI_SELESAI";
    const endpoint = isCompletion ? `/api/disdagin/interventions/${selectedParticipant.interventionId}/complete` : `/api/disdagin/interventions/${selectedParticipant.interventionId}/progress`;
    const payload = isCompletion
      ? { nib: form.get("nib"), monthlyRevenue: Number(form.get("monthlyRevenue")), completionDate: form.get("completionDate"), evaluation: form.get("evaluation") }
      : { participantStatus: "AKTIF_PENDAMPINGAN", progressPercent: Number(form.get("progressPercent")), legalStatus: form.get("legalStatus"), evaluation: form.get("evaluation") };
    const response = await fetch(endpoint, { method: isCompletion ? "POST" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setNotice(body.error ?? "Progress peserta tidak dapat disimpan."); return; }
    const progress = isCompletion ? 100 : Number(form.get("progressPercent"));
    const legalStatus = isCompletion ? "LEGAL" : String(form.get("legalStatus")) as DisdaginLegalStatus;
    const participantStatus = isCompletion ? "MANDIRI_SELESAI" : "AKTIF_PENDAMPINGAN";
    const evaluation = String(form.get("evaluation"));
    setReferrals((items) => items.map((item) => item.id === selectedParticipant.id ? { ...item, status: isCompletion ? "MANDIRI_SELESAI" : item.status, participantStatus, progress, legalStatus, evaluation, nib: isCompletion ? String(form.get("nib")) : item.nib, monthlyRevenue: isCompletion ? Number(form.get("monthlyRevenue")) : item.monthlyRevenue, timeline: [...item.timeline, { id: crypto.randomUUID(), type: isCompletion ? "COMPLETED" : "PROGRESS_UPDATED", date: "Hari ini", note: evaluation, progress }] } : item));
    setNotice(isCompletion ? "Pendampingan berhasil diselesaikan." : "Progress peserta berhasil disimpan.");
    window.setTimeout(() => { setSelectedParticipant(null); setModal("manage"); setNotice(""); setCompletionSelected(false); }, 650);
  }

  return <section aria-labelledby="program-title">
    <div className={styles.pageHeading}><div><h1 id="program-title">Katalog Kemitraan & Pameran Dagang</h1><p>Pengelolaan agenda pameran, fasilitasi display retail, dan temu bisnis untuk UMKM MBI.</p></div><button className={styles.primary} onClick={() => setModal("add")} disabled={!mentors.length}>+ Tambah Agenda / Pameran</button></div>
    <div className={styles.summaryGrid}>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><CalendarDays size={27} /></span><div><p>Agenda Aktif</p><strong>{programs.filter((program) => program.status === "AKTIF").length} <small>Agenda</small></strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><UsersRound size={27} /></span><div><p>Total Kuota Booth/Fasilitasi</p><strong>{programs.reduce((sum, program) => sum + program.capacity, 0)} <small>Usaha</small></strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><UserRoundCheck size={27} /></span><div><p>UMKM MBI Terfasilitasi</p><strong>{programs.reduce((sum, program) => sum + program.filled, 0)} <small>Peserta</small></strong></div></article>
    </div>
    <section className={styles.card} aria-label="Katalog agenda fasilitasi">
      <div className={styles.filters}><input style={{ minWidth: 420 }} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama program, kode, atau pendamping..." aria-label="Cari program" /><div className={styles.filterControls}><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Kategori"><option value="">Semua Kategori</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status"><option value="">Semua Status</option><option>AKTIF</option><option>PENUH</option><option>NONAKTIF</option></select></div></div>
      <div className={styles.desktopTable}><table><thead><tr><th>Kode &amp; Nama Agenda</th><th>Mitra / Penyelenggara</th><th>Durasi</th><th>Kuota Terisi</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{filtered.map((program) => { const percent = program.capacity ? Math.min(100, program.filled / program.capacity * 100) : 0; return <tr key={program.id}><td><strong>{program.name}</strong><span className={styles.muted}>{program.code}</span></td><td><strong>{program.consultant}</strong><span className={styles.muted}>{program.cluster}</span></td><td>{program.duration}</td><td><span className={styles.progressTrack}><span style={{ width: `${percent}%`, background: program.status === "PENUH" ? "#9b7600" : percent > 80 ? "#236b39" : "#1457ad" }} /></span>{program.filled} / {program.capacity}</td><td><span className={`${styles.badge} ${program.status === "PENUH" ? styles.badgeAmber : program.status === "AKTIF" ? styles.badgeGreen : ""}`}>{program.status}</span></td><td>{program.status === "AKTIF" ? <button className={`${styles.action} ${styles.actionPrimary}`} onClick={() => openProgram(program, "manage")}>Kelola Agenda</button> : <button className={styles.action} onClick={() => openProgram(program, "programDetail")}><Eye size={16} /> Detail</button>}</td></tr>; })}</tbody></table></div>
      <div className={styles.mobileCards}>{filtered.map((program) => <article key={program.id}><header><div><h3>{program.name}</h3><span className={styles.muted}>{program.code}</span></div><span className={`${styles.badge} ${program.status === "PENUH" ? styles.badgeAmber : styles.badgeGreen}`}>{program.status}</span></header><dl><div><dt>Pendamping</dt><dd>{program.consultant}</dd></div><div><dt>Kuota</dt><dd>{program.filled} / {program.capacity}</dd></div></dl><button className={`${styles.action} ${program.status === "AKTIF" ? styles.actionPrimary : ""}`} onClick={() => openProgram(program, program.status === "AKTIF" ? "manage" : "programDetail")}>{program.status === "AKTIF" ? "Kelola Agenda" : "Detail"}</button></article>)}</div>
      {!filtered.length && <p className={styles.emptyState}>Belum ada agenda fasilitasi yang sesuai filter.</p>}
      <nav className={styles.pagination}><p>Menampilkan 1–{filtered.length} dari {programs.length} data</p><div className={styles.pages}><span><ChevronLeft size={15} /></span><strong>1</strong><span><ChevronRight size={15} /></span></div></nav>
    </section>

    {modal === "add" && <Dialog title="Tambah Agenda Kemitraan & Pameran Baru" close={close} footer={<><button className={styles.secondary} onClick={close}>Batal</button><button type="submit" form="add-program" className={styles.primary}>Simpan &amp; Terbitkan Agenda</button></>}><form id="add-program" className={styles.form} onSubmit={addProgram}><div className={styles.twoColumns}><label>Kode Program<input name="code" defaultValue={`PRG-DAG-${String(programs.length + 1).padStart(2, "0")}`} pattern="PRG-[A-Z]{3}-[0-9]{2}" required /></label><label>Kategori Usaha<select name="category" defaultValue="Kuliner & Olahan Pangan" required><option>Kuliner &amp; Olahan Pangan</option><option>Fashion &amp; Kriya</option><option>Jasa &amp; Teknik</option><option>Digital &amp; Kreatif</option></select></label></div><label>Nama Agenda / Pameran<input name="name" placeholder="misal: Inkubasi Digital & E-Commerce UMKM" minLength={5} required /></label><label>Mitra / Penyelenggara Target<select name="pendampingId" required><option value="">Pilih mitra</option>{mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.name} ({mentor.cluster})</option>)}</select></label><div className={styles.twoColumns}><label>Durasi Event<span className={styles.inlineFields}><input name="duration" type="number" min="1" max="60" defaultValue="3" required /><select name="durationUnit"><option>Bulan</option><option>Minggu</option><option>Hari</option></select></span></label><label>Total Kuota Booth (Stand)<input name="capacity" type="number" min="1" max="10000" defaultValue="25" required /></label></div><label>Deskripsi &amp; Fasilitasi Program<textarea name="description" placeholder="Tuliskan fasilitas bantuan stimulan, sertifikasi halal, dan target omzet..." minLength={10} required /></label>{notice && <p role="status">{notice}</p>}</form></Dialog>}

    {modal === "manage" && selectedProgram && <Dialog wide title={`Kelola Agenda — ${selectedProgram.code}`} close={close} footer={<><button className={styles.secondary} onClick={() => window.print()}><Printer size={16} /> Unduh Daftar Peserta</button><button className={styles.secondary} onClick={close}>Tutup</button></>}><div className={styles.detailStack}><p className={styles.muted} style={{ marginTop: -17 }}>{selectedProgram.name}</p><div className={styles.summaryGrid} style={{ marginBottom: 8 }}><div className={styles.detailBox}><small>Kuota Terisi</small><strong>{selectedProgram.filled} / {selectedProgram.capacity} Peserta</strong></div><div className={styles.detailBox}><small>Mitra / Penyelenggara</small><strong>{selectedProgram.consultant}</strong></div><div className={styles.detailBox}><small>Peserta Selesai</small><strong>{graduationRate === null ? "Belum tersedia" : `${graduationRate}%`}</strong></div></div><h3>Peserta Terdaftar</h3><div className={styles.desktopTable}><table><thead><tr><th>NIK &amp; Nama Warga</th><th>ID Referral</th><th>Tanggal Masuk</th><th>Progress</th><th>Status Peserta</th><th>Aksi</th></tr></thead><tbody>{participants.map((person) => <tr key={person.id}><td><strong>{person.name}</strong><span className={styles.muted}>{person.maskedNik}</span></td><td>{person.code}</td><td>{person.date}</td><td>{person.progress ?? 0}%</td><td><span className={`${styles.badge} ${person.participantStatus === "MANDIRI_SELESAI" ? styles.badgeGreen : ""}`}>{participantLabel(person.participantStatus)}</span></td><td><button className={styles.action} onClick={() => openParticipant(person, person.participantStatus === "MANDIRI_SELESAI" ? "participantDetail" : "participant")}>{person.participantStatus === "MANDIRI_SELESAI" ? <><Eye size={15} /> Detail</> : "Update Status"}</button></td></tr>)}</tbody></table></div>{!participants.length && <p className={styles.emptyState}>Belum ada peserta pada program ini.</p>}</div></Dialog>}

    {modal === "participant" && selectedParticipant && selectedProgram && <Dialog title={`Update Status Peserta — ${selectedParticipant.code}`} close={() => setModal("manage")} footer={<><button className={styles.secondary} onClick={() => setModal("manage")}>Batal</button><button className={styles.primary} type="submit" form="participant-form">{completionSelected ? "Simpan & Selesaikan Pendampingan" : "Simpan Progress Fasilitasi"}</button></>}><form id="participant-form" className={styles.form} onSubmit={updateParticipant}><div className={styles.identity}><div className={styles.twoColumns}><div><small>Nama / NIK</small><h3>{selectedParticipant.name} <span className={styles.muted}>({selectedParticipant.maskedNik})</span></h3></div><div><small>Agenda</small><p>{selectedProgram.name}<br />({selectedProgram.code})</p></div></div><hr /><small>Status Saat Ini</small><span className={styles.badge}>{participantLabel(selectedParticipant.participantStatus)}</span></div><label>Status Keikutsertaan / Intervensi<select name="participantStatus" defaultValue="AKTIF_PENDAMPINGAN" onChange={(event) => setCompletionSelected(event.target.value === "MANDIRI_SELESAI")} required><option value="AKTIF_PENDAMPINGAN">Aktif Pendampingan</option><option value="MANDIRI_SELESAI">Mitra Retail / Selesai</option></select></label>{!completionSelected && <div className={styles.twoColumns}><label>Persentase Progress Usaha (%)<input name="progressPercent" type="number" min="0" max="99" defaultValue={selectedParticipant.progress ?? 0} required /></label><label>Status Penetrasi Pasar<select name="legalStatus" defaultValue={selectedParticipant.legalStatus ?? "BELUM"} required><option value="BELUM">Tahap Kurasi</option><option value="PROSES_NIB_HALAL">Stand Teralokasi / Fasilitasi Pameran</option><option value="LEGAL">Mitra Retail</option></select></label></div>}{completionSelected && <><div className={styles.twoColumns}><label>Nomor NIB / Izin Usaha<input name="nib" inputMode="numeric" pattern="\d{13}" maxLength={13} required /></label><label>Estimasi Omzet Bulanan (Rp)<input name="monthlyRevenue" type="number" min="0" max="1000000000000" required /></label></div><label>Tanggal Selesai Pendampingan<input name="completionDate" type="date" defaultValue={today} required /></label></>}<label>Catatan Progress Disdagin<textarea name="evaluation" defaultValue={selectedParticipant.evaluation ?? ""} minLength={10} required /></label>{notice && <p role="status">{notice}</p>}</form></Dialog>}

    {modal === "participantDetail" && selectedParticipant && <Dialog title={`Detail Progress Peserta — ${selectedParticipant.code}`} close={() => setModal("manage")} footer={<><button className={styles.secondary} onClick={() => window.print()}><Printer size={16} /> Unduh Rekap Fasilitasi</button><button className={styles.secondary} onClick={() => setModal("manage")}>Tutup</button></>}><div className={styles.detailStack}><div className={styles.identity}><small>Nama Warga</small><h3>{selectedParticipant.name} ({selectedParticipant.maskedNik})</h3><div className={styles.twoColumns}><div><small>Progress Usaha</small><strong>{selectedParticipant.progress ?? 0}%</strong></div><div><small>NIB / Omzet Bulanan</small><strong>{selectedParticipant.nib ?? "—"} / {selectedParticipant.monthlyRevenue === null ? "—" : rupiah.format(selectedParticipant.monthlyRevenue)}</strong></div></div><span className={`${styles.badge} ${styles.badgeGreen}`}>Mitra Retail / Selesai</span></div><section><h2>Riwayat Pendampingan</h2><div className={styles.timeline}>{selectedParticipant.timeline.map((entry) => <div key={entry.id}><span className={styles.muted}>{entry.date}</span><p>{entry.note}{entry.progress === null ? "" : ` — Progress ${entry.progress}%`}</p></div>)}</div></section></div></Dialog>}

    {modal === "programDetail" && selectedProgram && <Drawer title={`Detail Agenda & Kemitraan ${selectedProgram.code}`} close={close} footer={<><button className={styles.secondary} onClick={() => window.print()}><Download size={16} /> Unduh Rekap Agenda</button><button className={styles.secondary} onClick={close}>Tutup</button></>}><div className={styles.detailStack}><div className={styles.identity}><small>Profil Agenda Kemitraan</small><h3>{selectedProgram.name}</h3><p>{selectedProgram.consultant} ({selectedProgram.cluster})</p><span className={`${styles.badge} ${selectedProgram.status === "PENUH" ? styles.badgeAmber : styles.badgeGreen}`}>{selectedProgram.status} ({selectedProgram.filled}/{selectedProgram.capacity})</span></div><div className={styles.detailBox}><small>Durasi Program</small><strong>{selectedProgram.duration}</strong></div><div className={styles.detailBox}><small>Fasilitasi Pasar</small><strong>{selectedProgram.facilitation}</strong></div><div className={styles.detailBox}><small>Lokasi Agenda</small><strong>{selectedProgram.location}</strong></div>{referrals.filter((item) => item.programId === selectedProgram.id && item.participantStatus === "MANDIRI_SELESAI").map((item) => <div className={styles.detailBox} key={item.id}><Store size={20} /><strong>{item.name}</strong><span className={styles.muted}>{item.maskedNik}<br />NIB: {item.nib ?? "—"}</span></div>)}</div></Drawer>}
  </section>;
}
