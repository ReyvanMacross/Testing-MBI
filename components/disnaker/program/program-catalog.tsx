"use client";

import { ChevronLeft, ChevronRight, Download, Eye, GraduationCap, Printer, TrendingUp, UserRoundCheck, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";

import { Dialog, Drawer } from "@/components/disnaker/shared/dialog";
import styles from "@/components/disnaker/shared/disnaker-ui.module.css";
import type { DisnakerProgram, DisnakerReferral } from "@/lib/disnaker/data";

type Modal = "add" | "manage" | "participant" | "participantDetail" | "programDetail" | null;

export function ProgramCatalog({ initialPrograms, referrals }: { initialPrograms: DisnakerProgram[]; referrals: DisnakerReferral[] }) {
  const [programs, setPrograms] = useState(initialPrograms);
  const [modal, setModal] = useState<Modal>(null);
  const [selectedProgram, setSelectedProgram] = useState<DisnakerProgram | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<DisnakerReferral | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState("");
  const trainingParticipants = referrals.filter((item) => item.status !== "PERLU_DIPROSES").slice(0, 2);
  const filtered = useMemo(() => programs.filter((program) => {
    const q = query.toLowerCase();
    return (!q || `${program.name} ${program.code} ${program.institution}`.toLowerCase().includes(q)) && (!category || program.category === category) && (!status || program.status === status);
  }), [programs, query, category, status]);
  const categories = [...new Set(programs.map((program) => program.category))];
  const isPreview = programs.every((program) => program.isPreview);

  function openProgram(program: DisnakerProgram, next: Modal) { setSelectedProgram(program); setModal(next); setNotice(""); }
  function close() { setModal(null); setSelectedProgram(null); setSelectedParticipant(null); setNotice(""); }
  function openParticipant(participant: DisnakerReferral, next: Modal) { setSelectedParticipant(participant); setModal(next); }

  async function addProgram(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const capacity = Number(form.get("capacity"));
    let createdId = `preview-${crypto.randomUUID()}`;
    if (!isPreview) {
      const response = await fetch("/api/disnaker/programs", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: form.get("code"), name: form.get("name"), category: form.get("category"), institution: form.get("institution"), duration: Number(form.get("duration")), durationUnit: String(form.get("durationUnit")).toUpperCase(), capacity, description: form.get("description") }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setNotice(body.error ?? "Program tidak dapat disimpan."); return; }
      createdId = body.programId;
    }
    const program: DisnakerProgram = {
      id: createdId, code: String(form.get("code")), name: String(form.get("name")), category: String(form.get("category")),
      institution: String(form.get("institution")), duration: `${form.get("duration")} ${form.get("durationUnit")}`,
      filled: 0, capacity, status: "AKTIF", location: String(form.get("institution")), qualification: String(form.get("description")), isPreview: true,
    };
    setPrograms((items) => [program, ...items]); setNotice(isPreview ? "Program baru berhasil ditambahkan pada pratinjau." : "Program baru berhasil diterbitkan."); window.setTimeout(close, 700);
  }

  function updateParticipant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice("Progress peserta berhasil disimpan."); window.setTimeout(() => setModal("manage"), 650);
  }

  return <section aria-labelledby="program-title">
    <div className={styles.pageHeading}><div><h1 id="program-title">Katalog Program Pelatihan Vokasi</h1><p>Pengelolaan modul pelatihan, kapasitas kuota warga MBI, dan kemitraan LPK/BLK</p></div><button className={styles.primary} onClick={() => setModal("add")}>＋ Tambah Program</button></div>
    <div className={styles.summaryGrid}>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><GraduationCap size={27} /></span><div><p>Program Aktif</p><strong>{isPreview ? 14 : programs.filter((program) => program.status === "AKTIF").length} <small>Program</small></strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><UsersRound size={27} /></span><div><p>Total Kuota Tersedia</p><strong>{isPreview ? 150 : programs.reduce((sum, program) => sum + program.capacity, 0)} <small>Peserta</small></strong></div></article>
      <article className={styles.summaryCard}><span className={styles.summaryIcon}><UserRoundCheck size={27} /></span><div><p>Peserta MBI Terdaftar</p><strong>{isPreview ? 48 : programs.reduce((sum, program) => sum + program.filled, 0)} <small>Peserta</small></strong></div></article>
    </div>
    <section className={styles.card} aria-label="Katalog program">
      <div className={styles.filters}><input style={{minWidth:420}} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama program, kode, atau mitra BLK..." aria-label="Cari program" /><div className={styles.filterControls}><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Kategori"><option value="">Semua Kategori</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status"><option value="">Semua Status</option><option>AKTIF</option><option>PENUH</option></select></div></div>
      <div className={styles.desktopTable}><table><thead><tr><th>Kode &amp; Nama Program</th><th>Mitra Pelaksana</th><th>Durasi</th><th>Kuota Terisi</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{filtered.map((program) => { const percent = program.capacity ? Math.min(100, program.filled / program.capacity * 100) : 0; return <tr key={program.id}><td><strong>{program.name}</strong><span className={styles.muted}>{program.code}</span></td><td>{program.institution}</td><td>{program.duration}</td><td><span style={{display:"inline-block",width:80,height:7,marginRight:10,borderRadius:9,background:"#e3e5e8"}}><span style={{display:"block",width:`${percent}%`,height:"100%",borderRadius:9,background:program.status === "PENUH" ? "#9b7600" : percent > 80 ? "#236b39" : "#1457ad"}} /></span>{program.filled} / {program.capacity}</td><td><span className={`${styles.badge} ${program.status === "PENUH" ? styles.badgeAmber : styles.badgeGreen}`}>{program.status}</span></td><td>{program.status === "AKTIF" ? <button className={`${styles.action} ${styles.actionPrimary}`} onClick={() => openProgram(program, "manage")}>Kelola Kelas</button> : <button className={styles.action} onClick={() => openProgram(program, "programDetail")}><Eye size={16} /> Detail</button>}</td></tr>; })}</tbody></table></div>
      <div className={styles.mobileCards}>{filtered.map((program) => <article key={program.id}><header><div><h3>{program.name}</h3><span className={styles.muted}>{program.code}</span></div><span className={`${styles.badge} ${program.status === "PENUH" ? styles.badgeAmber : styles.badgeGreen}`}>{program.status}</span></header><dl><div><dt>Mitra</dt><dd>{program.institution}</dd></div><div><dt>Kuota</dt><dd>{program.filled} / {program.capacity}</dd></div></dl><button className={`${styles.action} ${program.status === "AKTIF" ? styles.actionPrimary : ""}`} onClick={() => openProgram(program, program.status === "AKTIF" ? "manage" : "programDetail")}>{program.status === "AKTIF" ? "Kelola Kelas" : "Detail"}</button></article>)}</div>
      <nav className={styles.pagination}><p>Menampilkan 1–{filtered.length} dari {programs.length} data</p><div className={styles.pages}><span><ChevronLeft size={15} /></span><strong>1</strong><span>2</span><span>3</span><span>…</span><span>13</span><span><ChevronRight size={15} /></span></div></nav>
    </section>

    {modal === "add" && <Dialog title="Tambah Program Pelatihan Baru" close={close} footer={<><button className={styles.secondary} onClick={close}>Batal</button><button type="submit" form="add-program" className={styles.primary}>Simpan &amp; Terbitkan Program</button></>}><form id="add-program" className={styles.form} onSubmit={addProgram}><div className={styles.twoColumns}><label>Kode Program<input name="code" defaultValue={`PRG-DIG-${String(programs.length + 1).padStart(2,"0")}`} pattern="PRG-[A-Z]{3}-[0-9]{2}" required /></label><label>Kategori Vokasi<select name="category" defaultValue="Teknologi & Informasi" required><option>Teknologi &amp; Informasi</option><option>Teknik &amp; Manufaktur</option><option>Jasa &amp; Transportasi</option></select></label></div><label>Nama Program Pelatihan<input name="name" placeholder="misal: Pelatihan Digital Marketing & E-Commerce" minLength={5} required /></label><label>Mitra Pelaksana / BLK Target<select name="institution" required><option>BLK Kota Bandung (Bidang IT &amp; Kreatif)</option><option>BLK Kota Bandung (Teknik)</option><option>LPK Otomotif Mandiri</option></select></label><div className={styles.twoColumns}><label>Durasi Pelatihan<span style={{display:"grid",gridTemplateColumns:"100px 1fr",gap:10}}><input name="duration" type="number" min="1" max="24" defaultValue="2" required /><select name="durationUnit"><option>Bulan</option><option>Minggu</option></select></span></label><label>Kapasitas Kuota Peserta<input name="capacity" type="number" min="1" max="1000" defaultValue="30" required /></label></div><label>Deskripsi &amp; Modul Pelatihan<textarea name="description" placeholder="Tuliskan modul utama dan kualifikasi lulusan..." minLength={10} required /></label>{notice && <p role="status">{notice}</p>}</form></Dialog>}

    {modal === "manage" && selectedProgram && <Dialog wide title={`Kelola Kelas — ${selectedProgram.code}`} close={close} footer={<><button className={styles.secondary} onClick={() => window.print()}><Printer size={16} /> Cetak Presensi Kelas</button><button className={styles.secondary} onClick={close}>Tutup</button></>}><div className={styles.detailStack}><p className={styles.muted} style={{marginTop:-17}}>{selectedProgram.name}</p><div className={styles.summaryGrid} style={{marginBottom:8}}><div className={styles.detailBox}><small>Kuota Terisi</small><strong>{selectedProgram.filled} / {selectedProgram.capacity} Peserta</strong></div><div className={styles.detailBox}><small>Mitra Pelaksana</small><strong>{selectedProgram.institution}</strong></div><div className={styles.detailBox}><small>Tingkat Kehadiran Rata-rata</small><strong>94% <span className={`${styles.badge} ${styles.badgeGreen}`}><TrendingUp size={13} /> Good</span></strong></div></div><div className={styles.toolbar}><h3>Peserta Terdaftar</h3><div><input placeholder="Cari NIK atau Nama..." /><select><option>Semua Status</option></select></div></div><div className={styles.desktopTable}><table><thead><tr><th>NIK &amp; Nama Warga</th><th>ID Referral</th><th>Tanggal Masuk</th><th>Progress</th><th>Status Peserta</th><th>Aksi</th></tr></thead><tbody>{trainingParticipants.map((person, index) => <tr key={person.id}><td><strong>{person.name}</strong><span className={styles.muted}>{person.maskedNik}</span></td><td>{person.code}</td><td>{person.date}</td><td>{person.attendance ?? (index ? 100 : 85)}%</td><td><span className={`${styles.badge} ${index ? styles.badgeGreen : ""}`}>{index ? "Lulus / Magang" : "Aktif Pelatihan"}</span></td><td><button className={styles.action} onClick={() => openParticipant(person,index ? "participantDetail" : "participant")}>{index ? <><Eye size={15} /> Detail</> : "Update Status"}</button></td></tr>)}</tbody></table></div></div></Dialog>}

    {modal === "participant" && selectedParticipant && selectedProgram && <Dialog title={`Update Status Peserta — ${selectedParticipant.code}`} close={() => setModal("manage")} footer={<><button className={styles.secondary} onClick={() => setModal("manage")}>Batal</button><button className={styles.primary} type="submit" form="participant-form">Simpan Progress Peserta</button></>}><form id="participant-form" className={styles.form} onSubmit={updateParticipant}><div className={styles.identity}><div className={styles.twoColumns}><div><small>Nama / NIK</small><h3>{selectedParticipant.name} <span className={styles.muted}>({selectedParticipant.maskedNik})</span></h3></div><div><small>Program</small><p>{selectedProgram.name}<br />({selectedProgram.code})</p></div></div><hr /><small>Status Saat Ini</small><span className={styles.badge}>Aktif Pelatihan</span></div><label>Status Kehadiran / Keikutsertaan<select required><option>Aktif Pelatihan</option><option>Lulus / Magang</option><option>Tidak Aktif</option></select></label><label>Persentase Kehadiran (%)<input type="number" min="0" max="100" defaultValue="85" required /></label><label>Catatan Evaluasi Instruktur BLK<textarea defaultValue="Peserta aktif mengikuti modul praktik teknik dan siap masuk tahap magang." minLength={10} required /></label>{notice && <p role="status">{notice}</p>}</form></Dialog>}

    {modal === "participantDetail" && selectedParticipant && <Dialog title={`Detail Progress Peserta — ${selectedParticipant.code}`} close={() => setModal("manage")} footer={<><button className={styles.secondary} onClick={() => window.print()}><Printer size={16} /> Cetak Sertifikat Kelulusan</button><button className={styles.secondary} onClick={() => setModal("manage")}>Tutup</button></>}><div className={styles.detailStack}><div className={styles.identity}><small>Nama / NIK</small><h3>{selectedParticipant.name}</h3><p>{selectedParticipant.maskedNik}</p><span className={`${styles.badge} ${styles.badgeGreen}`}>Lulus / Magang</span><p style={{marginTop:10,textAlign:"right"}}>Kehadiran: <strong>100%</strong></p></div><section><h2>Riwayat Pelatihan</h2><div className={styles.timeline}><div><span className={styles.muted}>10 Feb 2026</span><p>Masuk Kelas Vokasi</p></div><div><span className={styles.muted}>15 Mar 2026</span><p>Lulus Uji Kompetensi</p></div><div><span className={styles.muted}>01 Apr 2026</span><p>Penempatan Magang Kerja</p></div></div></section></div></Dialog>}

    {modal === "programDetail" && selectedProgram && <Drawer title="Detail Program Pelatihan" close={close} footer={<><button className={styles.secondary} onClick={() => window.print()}><Download size={16} /> Unduh Silabus (PDF)</button><button className={styles.secondary} onClick={close}>Tutup</button></>}><div className={styles.detailStack}><div className={styles.identity}><strong style={{color:"#0d4fa3"}}>{selectedProgram.code}</strong><h3>{selectedProgram.name}</h3><p>{selectedProgram.category}</p><span className={`${styles.badge} ${styles.badgeAmber}`}>Penuh ({selectedProgram.filled}/{selectedProgram.capacity})</span></div><div><small className={styles.muted}>Mitra Pelaksana</small><h3>{selectedProgram.institution}</h3></div><div><small className={styles.muted}>Durasi</small><h3>{selectedProgram.duration}</h3></div><div><small className={styles.muted}>Lokasi</small><h3>{selectedProgram.location}</h3></div><div><small className={styles.muted}>Kualifikasi</small><h3>{selectedProgram.qualification}</h3></div><section><h3>Lulusan Program Terakhir</h3><div className={styles.detailBox}><strong>Dedi Kurnia</strong><p className={styles.muted}>NIK: 32730514xxxx9012</p><span className={`${styles.badge} ${styles.badgeGreen}`}>Bekerja / Selesai</span></div></section></div></Drawer>}
  </section>;
}
