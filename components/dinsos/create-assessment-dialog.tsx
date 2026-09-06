"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { WargaProfile } from "@/lib/dinsos/warga";

import styles from "./create-assessment-dialog.module.css";

type AssessmentType = {
  code: string;
  name: string;
  requiresRecommendation: boolean;
};

export function CreateAssessmentDialog({
  profile,
  types,
  closeHref,
  reassessmentOf,
}: {
  profile: WargaProfile;
  types: AssessmentType[];
  closeHref: string;
  reassessmentOf?: string;
}) {
  const router = useRouter();
  const [typeCode, setTypeCode] = useState(types[0]?.code ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedType = types.find((type) => type.code === typeCode);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) router.push(closeHref);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [busy, closeHref, router]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/dinsos/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wargaId: profile.wargaId,
          assessmentTypeCode: typeCode,
          assessmentDate: form.get("assessmentDate"),
          observation: form.get("observation"),
          recommendation: form.get("recommendation") || null,
          reassessmentOf: reassessmentOf ?? null,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        assessmentId?: string;
      };
      if (!response.ok || !data.assessmentId) {
        throw new Error(data.error ?? "Asesmen tidak dapat disimpan.");
      }
      router.push(`/dinsos/asesmen?assessment=${data.assessmentId}`);
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Asesmen tidak dapat disimpan.",
      );
    } finally {
      setBusy(false);
    }
  }

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return (
    <div className={styles.overlay}>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Tutup Buat Asesmen Baru melalui latar belakang"
        onClick={() => !busy && router.push(closeHref)}
      />
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-assessment-title"
      >
        <header>
          <div>
            <h2 id="create-assessment-title">
              {reassessmentOf ? "Buat Re-Asesmen" : "Buat Asesmen Baru"}
            </h2>
            <p>Catat hasil observasi lapangan untuk proses review supervisor.</p>
          </div>
          <Link href={closeHref} aria-label="Tutup Buat Asesmen Baru">×</Link>
        </header>
        <form onSubmit={submit}>
          <label>
            <span>Warga</span>
            <input value={`${profile.namaLengkap} · ${profile.maskedNik}`} readOnly />
          </label>
          <label>
            <span>Jenis Asesmen *</span>
            <select
              value={typeCode}
              onChange={(event) => setTypeCode(event.target.value)}
              required
            >
              {types.map((type) => (
                <option key={type.code} value={type.code}>{type.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Tanggal Asesmen *</span>
            <input name="assessmentDate" type="date" max={today} defaultValue={today} required />
          </label>
          <label className={styles.full}>
            <span>Catatan/Hasil Observasi *</span>
            <textarea name="observation" minLength={20} maxLength={5000} rows={6} required />
          </label>
          <label className={styles.full}>
            <span>Rekomendasi Jalur Intervensi{selectedType?.requiresRecommendation ? " *" : ""}</span>
            <select name="recommendation" required={selectedType?.requiresRecommendation}>
              <option value="">Belum ditentukan</option>
              <option value="PEKERJA">Pekerja</option>
              <option value="WIRAUSAHA">Wirausaha</option>
              <option value="PENGUATAN_DASAR">Penguatan Dasar</option>
            </select>
          </label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <footer>
            <Link href={closeHref} aria-disabled={busy}>Batal</Link>
            <button type="submit" disabled={busy} aria-busy={busy}>
              {busy ? "Menyimpan…" : "Simpan Asesmen"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
