"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { useFokusDialog } from "@/components/dinsos/shared/use-fokus-dialog";

import styles from "./edit-warga-dialog.module.css";

type Props = {
  closeHref: string;
  kelurahanOptions: Array<{ id: string; nama: string; kecamatan: string }>;
  maritalStatuses: string[];
};

type NamaKolom =
  | "nik"
  | "nomorKk"
  | "namaLengkap"
  | "tempatLahir"
  | "tanggalLahir"
  | "jenisKelamin"
  | "statusPerkawinan"
  | "nomorHp"
  | "email"
  | "kelurahanId"
  | "alamatLengkap"
  | "pendidikanTerakhir"
  | "pekerjaan"
  | "jumlahAnggotaKk"
  | "statusRumah";

const KOLOM_WAJIB: Array<[NamaKolom, string]> = [
  ["nik", "NIK"],
  ["nomorKk", "Nomor KK"],
  ["namaLengkap", "Nama lengkap"],
  ["tempatLahir", "Tempat lahir"],
  ["tanggalLahir", "Tanggal lahir"],
  ["jenisKelamin", "Jenis kelamin"],
  ["statusPerkawinan", "Status perkawinan"],
  ["nomorHp", "Nomor telepon"],
  ["email", "Email"],
  ["kelurahanId", "Kelurahan"],
  ["alamatLengkap", "Alamat domisili"],
  ["pendidikanTerakhir", "Pendidikan terakhir"],
  ["pekerjaan", "Pekerjaan utama"],
  ["jumlahAnggotaKk", "Jumlah anggota keluarga"],
  ["statusRumah", "Status kepemilikan rumah"],
];

function teksForm(form: FormData, nama: NamaKolom) {
  const nilai = form.get(nama);
  return typeof nilai === "string" ? nilai.trim() : "";
}

function hanyaAngka(nilai: string, panjang: number) {
  return nilai.replace(/\D/g, "").slice(0, panjang);
}

function nomorTeleponLokal(nilai: string) {
  let angka = nilai.replace(/\D/g, "");
  if (angka.startsWith("62")) angka = angka.slice(2);
  if (angka.startsWith("0")) angka = angka.slice(1);
  return angka.slice(0, 13);
}

function validasiForm(form: FormData) {
  const kesalahan: Partial<Record<NamaKolom, string>> = {};
  for (const [nama, label] of KOLOM_WAJIB) {
    if (!teksForm(form, nama)) kesalahan[nama] = `${label} wajib diisi.`;
  }

  const nik = teksForm(form, "nik");
  if (nik && !/^\d{16}$/.test(nik)) {
    kesalahan.nik = "NIK harus terdiri dari tepat 16 digit.";
  }
  const nomorKk = teksForm(form, "nomorKk");
  if (nomorKk && !/^\d{16}$/.test(nomorKk)) {
    kesalahan.nomorKk = "Nomor KK harus terdiri dari tepat 16 digit.";
  }
  const nomorHp = teksForm(form, "nomorHp");
  if (nomorHp && !/^8\d{7,12}$/.test(nomorHp)) {
    kesalahan.nomorHp = "Nomor telepon setelah +62 harus diawali angka 8 dan berisi 8–13 digit.";
  }
  const email = teksForm(form, "email");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    kesalahan.email = "Email wajib memakai format yang benar, misalnya nama@example.invalid.";
  }
  const tanggalLahir = teksForm(form, "tanggalLahir");
  if (tanggalLahir && new Date(`${tanggalLahir}T00:00:00`).getTime() > Date.now()) {
    kesalahan.tanggalLahir = "Tanggal lahir tidak boleh melewati hari ini.";
  }
  const jumlahAnggotaText = teksForm(form, "jumlahAnggotaKk");
  const jumlahAnggota = Number(jumlahAnggotaText);
  if (jumlahAnggotaText && (!Number.isInteger(jumlahAnggota) || jumlahAnggota < 1 || jumlahAnggota > 50)) {
    kesalahan.jumlahAnggotaKk = "Jumlah anggota keluarga harus antara 1 dan 50.";
  }
  return kesalahan;
}

function PesanKolom({ pesan, id }: { pesan?: string; id: string }) {
  return pesan ? <small id={id} className={styles.fieldError}>{pesan}</small> : null;
}

export function DaftarWargaDialog({
  closeHref,
  kelurahanOptions,
  maritalStatuses,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [kesalahanKolom, setKesalahanKolom] = useState<Partial<Record<NamaKolom, string>>>({});
  const [nik, setNik] = useState("");
  const [nomorKk, setNomorKk] = useState("");
  const [nomorHp, setNomorHp] = useState("");
  const dialogRef = useFokusDialog<HTMLElement>('a[href*="mode=register"]');

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) router.push(closeHref);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [busy, closeHref, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formulir = event.currentTarget;
    const form = new FormData(formulir);
    const hasilValidasi = validasiForm(form);
    setKesalahanKolom(hasilValidasi);
    const kolomPertama = Object.keys(hasilValidasi)[0] as NamaKolom | undefined;
    if (kolomPertama) {
      setError("Periksa kembali kolom yang ditandai sebelum mendaftarkan warga.");
      requestAnimationFrame(() => {
        const kolom = formulir.elements.namedItem(kolomPertama);
        if (kolom instanceof HTMLElement) kolom.focus();
      });
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/dinsos/warga", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nik: form.get("nik"),
          nomorKk: form.get("nomorKk"),
          namaLengkap: form.get("namaLengkap"),
          tempatLahir: form.get("tempatLahir"),
          tanggalLahir: form.get("tanggalLahir"),
          jenisKelamin: form.get("jenisKelamin"),
          statusPerkawinan: form.get("statusPerkawinan"),
          nomorHp: `+62${teksForm(form, "nomorHp")}`,
          email: form.get("email"),
          alamatLengkap: form.get("alamatLengkap"),
          kelurahanId: form.get("kelurahanId"),
          pendidikanTerakhir: form.get("pendidikanTerakhir"),
          pekerjaan: form.get("pekerjaan"),
          jumlahAnggotaKk: form.get("jumlahAnggotaKk"),
          statusRumah: form.get("statusRumah"),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        wargaId?: string;
      };
      if (!response.ok || !body.wargaId) {
        throw new Error(body.error ?? "Warga baru tidak dapat didaftarkan.");
      }
      router.replace(`/dinsos/warga?warga=${body.wargaId}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Warga baru tidak dapat didaftarkan.",
      );
    } finally {
      setBusy(false);
    }
  }

  const statuses = Array.from(
    new Set(["Belum Menikah", "Menikah", "Cerai Hidup", "Cerai Mati", ...maritalStatuses]),
  );

  return (
    <div className={styles.overlay}>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Tutup dialog pendaftaran melalui latar belakang"
        onClick={() => !busy && router.push(closeHref)}
      />
      <section
        ref={dialogRef}
        tabIndex={-1}
        className={`${styles.dialog} ${styles.registrationDialog}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="daftar-warga-title"
      >
        <header>
          <div>
            <h2 id="daftar-warga-title">Daftarkan Warga Baru</h2>
            <p>Lengkapi seluruh data warga untuk ditambahkan ke basis data MBI.</p>
          </div>
          <button type="button" onClick={() => router.push(closeHref)} aria-label="Tutup Daftarkan Warga Baru" disabled={busy}>×</button>
        </header>
        <form
          onSubmit={submit}
          noValidate
          onInput={(event) => {
            const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
            if (!target.name) return;
            setKesalahanKolom((current) => ({ ...current, [target.name]: undefined }));
            setError("");
          }}
        >
          <div className={styles.fields}>
            <h3 className={styles.sectionTitle}>Identitas Pribadi</h3>
            <label>
              Nomor Induk Kependudukan (NIK) *
              <input name="nik" value={nik} onChange={(event) => setNik(hanyaAngka(event.target.value, 16))} inputMode="numeric" autoComplete="off" maxLength={16} required aria-invalid={Boolean(kesalahanKolom.nik)} aria-describedby="nik-hint nik-error" />
              <small id="nik-hint">{nik.length}/16 digit</small>
              <PesanKolom id="nik-error" pesan={kesalahanKolom.nik} />
            </label>
            <label>
              Nomor Kartu Keluarga *
              <input name="nomorKk" value={nomorKk} onChange={(event) => setNomorKk(hanyaAngka(event.target.value, 16))} inputMode="numeric" autoComplete="off" maxLength={16} required aria-invalid={Boolean(kesalahanKolom.nomorKk)} aria-describedby="kk-hint kk-error" />
              <small id="kk-hint">{nomorKk.length}/16 digit</small>
              <PesanKolom id="kk-error" pesan={kesalahanKolom.nomorKk} />
            </label>
            <label className={styles.full}>Nama Lengkap *<input name="namaLengkap" autoComplete="name" required maxLength={200} aria-invalid={Boolean(kesalahanKolom.namaLengkap)} /><PesanKolom id="nama-error" pesan={kesalahanKolom.namaLengkap} /></label>
            <label>Tempat Lahir *<input name="tempatLahir" maxLength={100} required aria-invalid={Boolean(kesalahanKolom.tempatLahir)} /><PesanKolom id="tempat-lahir-error" pesan={kesalahanKolom.tempatLahir} /></label>
            <label>Tanggal Lahir *<input name="tanggalLahir" type="date" min="1900-01-01" max={new Date().toISOString().slice(0, 10)} required aria-invalid={Boolean(kesalahanKolom.tanggalLahir)} /><PesanKolom id="tanggal-lahir-error" pesan={kesalahanKolom.tanggalLahir} /></label>
            <label>Jenis Kelamin *<select name="jenisKelamin" defaultValue="" required aria-invalid={Boolean(kesalahanKolom.jenisKelamin)}><option value="" disabled>Pilih jenis kelamin</option><option value="Laki-laki">Laki-laki</option><option value="Perempuan">Perempuan</option></select><PesanKolom id="jenis-kelamin-error" pesan={kesalahanKolom.jenisKelamin} /></label>
            <label>Status Perkawinan *<select name="statusPerkawinan" defaultValue="" required aria-invalid={Boolean(kesalahanKolom.statusPerkawinan)}><option value="" disabled>Pilih status</option>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select><PesanKolom id="status-perkawinan-error" pesan={kesalahanKolom.statusPerkawinan} /></label>
            <label>
              Nomor Telepon *
              <span className={`${styles.phoneInput} ${kesalahanKolom.nomorHp ? styles.invalid : ""}`}>
                <span aria-hidden="true">+62</span>
                <input name="nomorHp" type="tel" inputMode="numeric" autoComplete="tel-national" value={nomorHp} onChange={(event) => setNomorHp(nomorTeleponLokal(event.target.value))} maxLength={13} placeholder="81234567890" required aria-invalid={Boolean(kesalahanKolom.nomorHp)} aria-describedby="telepon-hint telepon-error" />
              </span>
              <small id="telepon-hint">Awalan +62 ditambahkan otomatis.</small>
              <PesanKolom id="telepon-error" pesan={kesalahanKolom.nomorHp} />
            </label>
            <label>Email *<input name="email" type="email" autoComplete="email" maxLength={254} placeholder="nama@example.invalid" required aria-invalid={Boolean(kesalahanKolom.email)} aria-describedby="email-error" /><PesanKolom id="email-error" pesan={kesalahanKolom.email} /></label>

            <h3 className={styles.sectionTitle}>Domisili</h3>
            <label className={styles.full}>Kelurahan *<select name="kelurahanId" defaultValue="" required aria-invalid={Boolean(kesalahanKolom.kelurahanId)}><option value="" disabled>Pilih kelurahan</option>{kelurahanOptions.map((item) => <option key={item.id} value={item.id}>{item.nama} — {item.kecamatan}</option>)}</select><PesanKolom id="kelurahan-error" pesan={kesalahanKolom.kelurahanId} /></label>
            <label className={styles.full}>Alamat Domisili *<textarea name="alamatLengkap" autoComplete="street-address" maxLength={3000} rows={3} required aria-invalid={Boolean(kesalahanKolom.alamatLengkap)} /><PesanKolom id="alamat-error" pesan={kesalahanKolom.alamatLengkap} /></label>

            <h3 className={styles.sectionTitle}>Data Sosial Ekonomi</h3>
            <label>Pendidikan Terakhir *<input name="pendidikanTerakhir" maxLength={150} placeholder="Contoh: SMA/SMK sederajat" required aria-invalid={Boolean(kesalahanKolom.pendidikanTerakhir)} /><PesanKolom id="pendidikan-error" pesan={kesalahanKolom.pendidikanTerakhir} /></label>
            <label>Pekerjaan Utama *<input name="pekerjaan" maxLength={200} required aria-invalid={Boolean(kesalahanKolom.pekerjaan)} /><PesanKolom id="pekerjaan-error" pesan={kesalahanKolom.pekerjaan} /></label>
            <label>Jumlah Anggota Keluarga *<input name="jumlahAnggotaKk" type="number" inputMode="numeric" min={1} max={50} required aria-invalid={Boolean(kesalahanKolom.jumlahAnggotaKk)} /><PesanKolom id="jumlah-keluarga-error" pesan={kesalahanKolom.jumlahAnggotaKk} /></label>
            <label>Status Kepemilikan Rumah *<input name="statusRumah" maxLength={150} placeholder="Contoh: Milik sendiri" required aria-invalid={Boolean(kesalahanKolom.statusRumah)} /><PesanKolom id="status-rumah-error" pesan={kesalahanKolom.statusRumah} /></label>
          </div>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <footer>
            <button type="button" className={styles.cancel} onClick={() => router.push(closeHref)} disabled={busy}>Batal</button>
            <button type="submit" className={styles.save} disabled={busy} aria-busy={busy}>{busy ? "Menyimpan…" : "Daftarkan Warga"}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
