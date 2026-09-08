"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { ReferralDetail } from "@/lib/dinsos/referrals";
import { dinsosPathLabel } from "@/lib/dinsos/path-values";

import styles from "./referral-registry.module.css";

export function ProcessReferralDialog({
  referral,
  programs,
  today,
  closeHref,
}: {
  referral: ReferralDetail;
  programs: { id: string; name: string }[];
  today: string;
  closeHref: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) router.push(closeHref);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, closeHref, router]);

  async function submit(formData: FormData) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/dinsos/referrals/${referral.referralId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId: formData.get("programId"),
          referralDate: formData.get("referralDate"),
          instruction: formData.get("instruction"),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Referral tidak dapat dikirim.");
      router.push(`${closeHref}${closeHref.includes("?") ? "&" : "?"}referral=${referral.referralId}&mode=progress`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Referral tidak dapat dikirim.");
      setBusy(false);
    }
  }

  return (
    <div className={`${styles.overlay} ${styles.centered}`}>
      <button className={styles.backdrop} type="button" aria-label="Tutup proses rujukan" onClick={() => !busy && router.push(closeHref)} />
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="process-referral-title">
        <header className={styles.dialogHeader}>
          <h2 id="process-referral-title">Proses Rujukan Warga — {referral.referralCode}</h2>
          <Link href={closeHref} aria-label="Tutup proses rujukan">×</Link>
        </header>
        <div className={styles.dialogContent}>
          <section className={styles.identity}>
            <h3>Identitas Warga</h3>
            <dl>
              <div><dt>Nama Warga</dt><dd>{referral.nama}</dd></div>
              <div><dt>NIK</dt><dd>{referral.maskedNik}</dd></div>
              <div><dt>Desil</dt><dd>{referral.desil ? `Desil ${referral.desil}` : "—"}</dd></div>
              <div><dt>Kelurahan</dt><dd>{referral.kelurahan}</dd></div>
              <div><dt>Jalur Terpilih</dt><dd>{dinsosPathLabel(referral.jalur)}</dd></div>
              <div><dt>OPD Target</dt><dd>{referral.targetOpd}</dd></div>
            </dl>
            {!referral.locationResolved && <p className={styles.warning}>Wilayah warga belum terhubung ke master wilayah terverifikasi.</p>}
          </section>
          {programs.length ? (
            <form action={submit} className={styles.processForm}>
              <label><span>Program Intervensi Spesifik *</span><select name="programId" required defaultValue=""><option value="" disabled>Pilih program intervensi</option>{programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select></label>
              <label><span>Tanggal Pengiriman Rujukan *</span><input type="date" name="referralDate" required max={today} defaultValue={today} /></label>
              <label><span>Catatan Instruksi untuk OPD</span><textarea name="instruction" maxLength={3000} rows={5} placeholder="Tuliskan hanya informasi yang diperlukan OPD tujuan." /></label>
              {error && <p role="alert" className={styles.error}>{error}</p>}
              <button type="submit" disabled={busy} aria-busy={busy}>{busy ? "Mengirim…" : "Kirim Rujukan ke OPD"}</button>
            </form>
          ) : (
            <div className={styles.configWarning} role="status">
              <strong>Belum ada program intervensi aktif</strong>
              <p>Program untuk OPD dan jalur ini perlu dikonfigurasi sebelum referral dapat dikirim.</p>
              <button type="button" disabled aria-disabled="true">Kirim Rujukan ke OPD</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
