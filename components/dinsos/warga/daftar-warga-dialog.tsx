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

export function DaftarWargaDialog({
  closeHref,
  kelurahanOptions,
  maritalStatuses,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/dinsos/warga", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nik: form.get("nik"),
          nomorKk: form.get("nomorKk") || null,
          namaLengkap: form.get("namaLengkap"),
          tempatLahir: form.get("tempatLahir") || null,
          tanggalLahir: form.get("tanggalLahir") || null,
          jenisKelamin: form.get("jenisKelamin") || null,
          statusPerkawinan: form.get("statusPerkawinan") || null,
          nomorHp: form.get("nomorHp") || null,
          email: form.get("email") || null,
          alamatLengkap: form.get("alamatLengkap"),
          kelurahanId: form.get("kelurahanId"),
          pendidikanTerakhir: form.get("pendidikanTerakhir") || null,
          pekerjaan: form.get("pekerjaan") || null,
          jumlahAnggotaKk: form.get("jumlahAnggotaKk") || null,
          statusRumah: form.get("statusRumah") || null,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        wargaId?: string;
      };
      if (!response.ok || !body.wargaId) {
        throw new Error(body.error ?? "Warga baru tidak dapat didaftarkan.");
      }
      router.push(`/dinsos/warga?warga=${body.wargaId}`);
      router.refresh();
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
            <p>Lengkapi identitas dasar warga untuk ditambahkan ke basis data MBI.</p>
          </div>
          <button
            type="button"
            onClick={() => router.push(closeHref)}
            aria-label="Tutup Daftarkan Warga Baru"
            disabled={busy}
          >×</button>
        </header>
        <form onSubmit={submit}>
          <div className={styles.fields}>
            <h3 className={styles.sectionTitle}>Identitas Pribadi</h3>
            <label>Nomor Induk Kependudukan (NIK) *<input name="nik" inputMode="numeric" pattern="[0-9]{16}" minLength={16} maxLength={16} required /></label>
            <label>Nomor Kartu Keluarga *<input name="nomorKk" inputMode="numeric" pattern="[0-9]{16}" minLength={16} maxLength={16} required /></label>
            <label className={styles.full}>Nama Lengkap *<input name="namaLengkap" autoComplete="name" required maxLength={200} /></label>
            <label>Tempat Lahir *<input name="tempatLahir" maxLength={100} required /></label>
            <label>Tanggal Lahir *<input name="tanggalLahir" type="date" min="1900-01-01" required /></label>
            <label>Jenis Kelamin *<select name="jenisKelamin" defaultValue="" required><option value="" disabled>Pilih jenis kelamin</option><option value="Laki-laki">Laki-laki</option><option value="Perempuan">Perempuan</option></select></label>
            <label>Status Perkawinan *<select name="statusPerkawinan" defaultValue="" required><option value="" disabled>Pilih status</option>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>Nomor Telepon *<input name="nomorHp" type="tel" autoComplete="tel" maxLength={25} required /></label>
            <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} /></label>

            <h3 className={styles.sectionTitle}>Domisili</h3>
            <label className={styles.full}>Kelurahan *<select name="kelurahanId" defaultValue="" required><option value="" disabled>Pilih kelurahan</option>{kelurahanOptions.map((item) => <option key={item.id} value={item.id}>{item.nama} — {item.kecamatan}</option>)}</select></label>
            <label className={styles.full}>Alamat Domisili *<textarea name="alamatLengkap" autoComplete="street-address" maxLength={3000} rows={3} required /></label>

            <h3 className={styles.sectionTitle}>Data Sosial Ekonomi</h3>
            <label>Pendidikan Terakhir *<input name="pendidikanTerakhir" maxLength={150} placeholder="Contoh: SMA/SMK sederajat" required /></label>
            <label>Pekerjaan Utama *<input name="pekerjaan" maxLength={200} required /></label>
            <label>Jumlah Anggota Keluarga *<input name="jumlahAnggotaKk" type="number" inputMode="numeric" min={1} max={50} required /></label>
            <label>Status Kepemilikan Rumah *<input name="statusRumah" maxLength={150} placeholder="Contoh: Milik sendiri" required /></label>
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
