"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Eye, Plus, Search, UsersRound, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";

import { Dialog, Drawer } from "@/components/dp3a/shared/dialog";
import styles from "@/components/dp3a/shared/dp3a-ui.module.css";
import type { Dp3aProgram, Dp3aReferral, Dp3aServiceUnit } from "@/lib/dp3a/data";

type Modal = "add" | "manage" | "allocate" | "detail" | null;

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

export function ProgramCatalog({ initialPrograms, initialReferrals, units, preview }: { initialPrograms: Dp3aProgram[]; initialReferrals: Dp3aReferral[]; units: Dp3aServiceUnit[]; preview: boolean }) {
  const [programs, setPrograms] = useState(initialPrograms);
  const [referrals, setReferrals] = useState(initialReferrals);
  const [selected, setSelected] = useState<Dp3aProgram | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState("");
  const filtered = useMemo(() => programs.filter((item) => (!query || `${item.code} ${item.name} ${item.serviceType}`.toLowerCase().includes(query.toLowerCase())) && (!category || item.category === category) && (!status || item.status === status)), [programs, query, category, status]);
  const categories = [...new Set(programs.map((item) => item.category))];
  const participants = selected ? referrals.filter((item) => item.programId === selected.id && item.caseId) : [];
  const available = referrals.filter((item) => !item.caseId);
  const totalCapacity = programs.reduce((sum, item) => sum + item.capacity, 0);
  const completed = referrals.filter((item) => item.status === "SELESAI").length;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  function open(next: Exclude<Modal, null>, item?: Dp3aProgram) { setSelected(item ?? null); setModal(next); setNotice(""); }
  function close() { setSelected(null); setModal(null); setNotice(""); }

  async function addProgram(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let body: { programId?: string; error?: string } = {};
    if (!preview) {
      const response = await fetch("/api/dp3a/programs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
      body = await response.json().catch(() => ({}));
      if (!response.ok) return setNotice(body.error ?? "Program tidak dapat disimpan.");
    }
    const unit = units.find((item) => item.id === form.get("unitId"));
    setPrograms((items) => [...items, {
      id: body.programId ?? crypto.randomUUID(), code: String(form.get("code")), name: String(form.get("name")), category: String(form.get("category")), serviceType: String(form.get("serviceType")), unitId: unit?.id ?? "", unit: unit?.name ?? "DP3A Kota Bandung", duration: `${form.get("duration")} ${String(form.get("durationUnit")).toLowerCase()}`, executionDate: String(form.get("executionDate")), budgetPerBeneficiary: Number(form.get("budgetPerBeneficiary")), filled: 0, capacity: Number(form.get("capacity")), status: "AKTIF", location: unit?.kelurahan ?? "Kota Bandung", description: String(form.get("description")),
    }]);
    setNotice(preview ? "Program pratinjau ditambahkan untuk sesi ini." : "Program layanan berhasil diterbitkan.");
    window.setTimeout(close, 500);
  }

  async function allocate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const referral = referrals.find((item) => item.id === form.get("referralId"));
    if (!referral) return setNotice("Pilih warga yang akan dialokasikan.");
    const unitId = String(form.get("unitId"));
    const unit = units.find((item) => item.id === unitId);
    const payload = { programId: selected.id, unitId, startDate: today, caseType: referral.serviceType, supportItem: selected.serviceType, actionPlan: form.get("actionPlan") };
    let body: { caseId?: string; error?: string } = {};
    if (!preview) {
      const response = await fetch(`/api/dp3a/referrals/${referral.id}/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      body = await response.json().catch(() => ({}));
      if (!response.ok) return setNotice(body.error ?? "Warga tidak dapat dialokasikan.");
    }
    setReferrals((items) => items.map((item) => item.id === referral.id ? { ...item, caseId: body.caseId ?? crypto.randomUUID(), programId: selected.id, program: selected.name, unitId, unit: unit?.name ?? selected.unit, status: "DALAM_PROSES", caseStatus: "VERIFIKASI", verificationStatus: "MENUNGGU", progress: 0, plannedBudget: selected.budgetPerBeneficiary, notes: String(form.get("actionPlan")), timeline: [...item.timeline, { id: crypto.randomUUID(), type: "STARTED", date: "Hari ini", note: String(form.get("actionPlan")), progress: 0 }] } : item));
    setPrograms((items) => items.map((item) => item.id === selected.id ? { ...item, filled: item.filled + 1, status: item.filled + 1 >= item.capacity ? "PENUH" : item.status } : item));
    setNotice("Warga berhasil dialokasikan ke program.");
    window.setTimeout(() => setModal("manage"), 500);
  }

  return <section aria-labelledby="program-title">
    <div className={styles.pageHeading}><div><h1 id="program-title">Katalog Program Layanan Perlindungan &amp; Pemberdayaan</h1><p>Daftar program pendampingan hukum, konseling psikologis, perlindungan anak, rumah aman, dan pemberdayaan ekonomi perempuan MBI.</p></div><button className={styles.primary} onClick={() => open("add")}><Plus size={18} /> Tambah Program Layanan</button></div>
    <div className={styles.summaryGrid}><article className={styles.summaryCard}><span className={styles.summaryIcon}><CalendarDays size={27} /></span><div><p>Program Aktif</p><strong>{programs.filter((item) => item.status === "AKTIF").length}</strong></div></article><article className={styles.summaryCard}><span className={styles.summaryIcon}><WalletCards size={27} /></span><div><p>Total Kuota Teralokasi</p><strong>{totalCapacity}</strong></div></article><article className={styles.summaryCard}><span className={styles.summaryIcon}><UsersRound size={27} /></span><div><p>Warga Terpendamping / Selesai</p><strong>{completed}</strong></div></article></div>
    <section className={styles.card}>{preview && <p className={styles.previewNote}>Mode pratinjau DP3A aktif untuk pengembangan lokal.</p>}<div className={styles.filters}><label style={{ position: "relative" }}><Search size={17} style={{ position: "absolute", left: 12, top: 12 }} /><input style={{ paddingLeft: 40, minWidth: 440 }} aria-label="Cari program" placeholder="Cari kode, nama program, atau jenis layanan..." value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className={styles.filterControls}><select aria-label="Filter kategori" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Semua Kategori</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Semua Status</option><option value="AKTIF">Aktif</option><option value="PENUH">Penuh</option><option value="NONAKTIF">Nonaktif</option></select></div></div>
      <div className={styles.desktopTable}><table><thead><tr><th>Kode &amp; Nama Program</th><th>Kategori &amp; Jadwal</th><th>Kuota &amp; Alokasi</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><span className={styles.muted}>{item.code}</span></td><td>{item.category}<br /><span className={styles.muted}>{item.executionDate}</span></td><td><span className={styles.progressTrack}><span style={{ width: `${Math.min(100, item.filled / item.capacity * 100)}%`, background: item.status === "PENUH" ? "#9a7600" : "#23713d" }} /></span>{item.filled} / {item.capacity} Warga</td><td><span className={`${styles.badge} ${item.status === "AKTIF" ? styles.badgeGreen : item.status === "PENUH" ? styles.badgeAmber : ""}`}>{item.status}</span></td><td><button className={`${styles.action} ${item.status === "AKTIF" ? styles.actionPrimary : ""}`} onClick={() => open(item.status === "AKTIF" ? "manage" : "detail", item)}>{item.status === "AKTIF" ? "Kelola Program" : <><Eye size={16} /> Detail</>}</button></td></tr>)}</tbody></table></div>
      <div className={styles.mobileCards}>{filtered.map((item) => <article key={item.id}><header><div><h3>{item.name}</h3><span className={styles.muted}>{item.code}</span></div><span className={`${styles.badge} ${item.status === "AKTIF" ? styles.badgeGreen : styles.badgeAmber}`}>{item.status}</span></header><dl><div><dt>Kategori</dt><dd>{item.category}</dd></div><div><dt>Kuota</dt><dd>{item.filled}/{item.capacity}</dd></div></dl><button className={styles.action} onClick={() => open(item.status === "AKTIF" ? "manage" : "detail", item)}>Buka Program</button></article>)}</div>
      {!filtered.length && <p className={styles.emptyState}>Belum ada program yang sesuai filter.</p>}<nav className={styles.pagination} aria-label="Halaman program"><p>Menampilkan 1–{filtered.length} dari {programs.length} data</p><div className={styles.pages}><span><ChevronLeft size={15} /></span><strong aria-current="page">1</strong><span><ChevronRight size={15} /></span></div></nav>
    </section>

    {modal === "add" && <Dialog title="Tambah Program Layanan Baru" close={close} footer={<><button className={styles.secondary} onClick={close}>Batal</button><button className={styles.primary} type="submit" form="add-program">Simpan &amp; Terbitkan Program</button></>}><form id="add-program" className={styles.form} onSubmit={addProgram}><div className={styles.twoColumns}><label>Kode Program<input name="code" placeholder="PRG-PPA-04" pattern="PRG-PPA-[0-9]{2}" required /></label><label>Nama Program / Layanan<input name="name" minLength={5} maxLength={200} required /></label></div><div className={styles.twoColumns}><label>Kategori Target<input name="category" placeholder="Perlindungan Anak & Safe House" minLength={3} maxLength={120} required /></label><label>Jenis Layanan<input name="serviceType" placeholder="Pendampingan & Shelter Safe House" minLength={3} maxLength={200} required /></label></div><label>Unit Pelaksana<select name="unitId" required>{units.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className={styles.twoColumns}><label>Durasi<input name="duration" type="number" min="1" max="60" defaultValue="3" required /></label><label>Satuan<select name="durationUnit" defaultValue="BULAN"><option value="HARI">Hari</option><option value="MINGGU">Minggu</option><option value="BULAN">Bulan</option></select></label></div><label>Tanggal Pelaksanaan<input name="executionDate" type="date" required /></label><div className={styles.twoColumns}><label>Pagu Anggaran per Warga / Anak<input name="budgetPerBeneficiary" type="number" min="0" max="1000000000000" required /></label><label>Total Kuota (Warga / Anak)<input name="capacity" type="number" min="1" max="10000" required /></label></div><label>Deskripsi &amp; Kriteria Kelayakan Layanan<textarea name="description" minLength={10} maxLength={3000} required /></label>{notice && <p role="status">{notice}</p>}</form></Dialog>}

    {selected && modal === "manage" && <Dialog wide title={`Kelola Penerima Program — ${selected.code}`} close={close} footer={<><button className={styles.secondary} onClick={() => setModal("allocate")} disabled={selected.filled >= selected.capacity || !available.length}><Plus size={17} /> Alokasikan Warga Baru</button><button className={styles.secondary} onClick={close}>Tutup</button></>}><div className={styles.detailStack}><div className={styles.identity}><small>Nama Program</small><h3>{selected.name}</h3><p>{selected.unit} · {selected.executionDate} · {rupiah(selected.budgetPerBeneficiary)} / warga</p><span className={`${styles.badge} ${styles.badgeGreen}`}>Aktif ({selected.filled}/{selected.capacity})</span></div><section><h2>Daftar Penerima Layanan DP3A</h2><div className={styles.desktopTable}><table><thead><tr><th>NIK &amp; Nama Warga</th><th>Kelurahan &amp; Kecamatan</th><th>Status Pendampingan</th></tr></thead><tbody>{participants.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><span className={styles.muted}>{item.maskedNik}</span></td><td>{item.kelurahan}<br /><span className={styles.muted}>Kec. {item.kecamatan}</span></td><td><span className={`${styles.badge} ${item.status === "SELESAI" ? styles.badgeGreen : ""}`}>{item.status === "SELESAI" ? "Selesai" : "Dalam Penanganan"}</span></td></tr>)}</tbody></table></div>{!participants.length && <p className={styles.emptyState}>Belum ada penerima pada program ini.</p>}</section></div></Dialog>}

    {selected && modal === "allocate" && <Dialog title={`Alokasikan Warga Baru — ${selected.code}`} close={() => setModal("manage")} footer={<><button className={styles.secondary} onClick={() => setModal("manage")}>Batal</button><button className={styles.primary} type="submit" form="allocate-citizen">Simpan &amp; Alokasikan</button></>}><form id="allocate-citizen" className={styles.form} onSubmit={allocate}><div className={styles.identity}><small>Program</small><h3>{selected.name}</h3><p>Sisa kuota: {selected.capacity - selected.filled} warga / anak ({selected.filled}/{selected.capacity} terisi)</p></div><label>Pilih Warga / Subjek Rujukan DP3A<select name="referralId" required>{available.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.maskedNik}) — {item.kelurahan}</option>)}</select></label><label>Unit Pelaksana<select name="unitId" defaultValue={selected.unitId} required>{units.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Catatan Verifikasi &amp; Instruksi Pengerjaan<textarea name="actionPlan" defaultValue="Berkas rujukan telah diverifikasi. Lakukan asesmen awal dan jadwalkan pendampingan sesuai standar layanan DP3A." minLength={10} maxLength={2000} required /></label>{notice && <p role="status">{notice}</p>}</form></Dialog>}

    {selected && modal === "detail" && <Drawer title={`Detail Program — ${selected.code}`} close={close} footer={<button className={styles.secondary} onClick={close}>Tutup</button>}><div className={styles.detailStack}><div className={styles.identity}><small>Nama Program</small><h3>{selected.name}</h3><p>{selected.category} · {selected.executionDate}</p><span className={`${styles.badge} ${selected.status === "PENUH" ? styles.badgeAmber : styles.badgeGreen}`}>{selected.status} ({selected.filled}/{selected.capacity} warga terisi)</span></div><div className={styles.twoColumns}><div className={styles.detailBox}><small>Fasilitas Utama</small><strong>{selected.serviceType}</strong></div><div className={styles.detailBox}><small>Penerima Manfaat</small><strong>{selected.capacity} Warga &amp; Anak Rentan</strong></div></div><div className={styles.detailBox}><small>Unit Pelaksana &amp; Pagu</small><strong>{selected.unit}<br />{rupiah(selected.budgetPerBeneficiary)} per penerima</strong></div><p>{selected.description}</p><section><h2>Riwayat Tahapan Program</h2><div className={styles.timeline}><div><span className={styles.muted}>{selected.executionDate}</span><p>Pembukaan alokasi program dan pendataan usulan rujukan DP3A.</p></div><div><span className={styles.muted}>Status terkini</span><p>{selected.filled} dari {selected.capacity} penerima telah teralokasi.</p></div></div></section></div></Drawer>}
  </section>;
}
