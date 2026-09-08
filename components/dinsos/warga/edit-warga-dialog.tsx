"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import type { WargaProfile } from "@/lib/dinsos/warga";

import styles from "./edit-warga-dialog.module.css";

type Props = {
  profile: WargaProfile;
  closeHref: string;
  kelurahanOptions: Array<{ id: string; nama: string; kecamatan: string }>;
  maritalStatuses: string[];
};

export function EditWargaDialog({ profile, closeHref, kelurahanOptions, maritalStatuses }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
      const response = await fetch(`/api/dinsos/warga/${profile.wargaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          namaLengkap: form.get("namaLengkap"),
          kelurahanId: form.get("kelurahanId") || null,
          statusPerkawinan: form.get("statusPerkawinan") || null,
          alamatLengkap: form.get("alamatLengkap") || null,
          pekerjaan: form.get("pekerjaan") || null,
          expectedUpdatedAt: profile.updatedAt,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Data warga tidak dapat diperbarui.");
      router.push(closeHref);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Data warga tidak dapat diperbarui.");
    } finally {
      setBusy(false);
    }
  }

  const statuses = Array.from(new Set([
    ...(profile.statusPerkawinan ? [profile.statusPerkawinan] : []),
    ...maritalStatuses,
  ]));

  return (
    <div className={styles.overlay}>
      <button type="button" className={styles.backdrop} aria-label="Tutup dialog edit melalui latar belakang" onClick={() => router.push(closeHref)} />
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="edit-warga-title">
        <header><h2 id="edit-warga-title">Edit Data Warga</h2><button type="button" onClick={() => router.push(closeHref)} aria-label="Tutup Edit Data Warga">×</button></header>
        <form onSubmit={submit}>
          <div className={styles.fields}>
            <label className={styles.full}>Nomor Induk Kependudukan (NIK)<input value={profile.maskedNik} readOnly aria-readonly="true" /><small>NIK terintegrasi Disdukcapil (read-only)</small></label>
            <label className={styles.full}>Nama Lengkap<input name="namaLengkap" defaultValue={profile.namaLengkap} required maxLength={200} /></label>
            <label>Kelurahan<select name="kelurahanId" defaultValue={profile.kelurahanId ?? ""}><option value="">{profile.locationResolved ? "Pilih Kelurahan" : "Belum terpetakan"}</option>{kelurahanOptions.map((item) => <option key={item.id} value={item.id}>{item.nama} — {item.kecamatan}</option>)}</select></label>
            <label>Status Perkawinan<select name="statusPerkawinan" defaultValue={profile.statusPerkawinan ?? ""}><option value="">Belum tersedia</option>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className={styles.full}>Alamat Domisili<textarea name="alamatLengkap" defaultValue={profile.alamatLengkap ?? ""} maxLength={3000} rows={3} /></label>
            <label className={styles.full}>Pekerjaan<input name="pekerjaan" defaultValue={profile.pekerjaan ?? ""} maxLength={200} /></label>
          </div>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <footer><button type="button" className={styles.cancel} onClick={() => router.push(closeHref)} disabled={busy}>Batal</button><button type="submit" className={styles.save} disabled={busy} aria-busy={busy}>{busy ? "Menyimpan…" : "Simpan Perubahan"}</button></footer>
        </form>
      </section>
    </div>
  );
}
