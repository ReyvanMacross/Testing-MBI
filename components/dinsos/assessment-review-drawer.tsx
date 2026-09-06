"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { AssessmentDetail } from "@/lib/dinsos/assessments";
import type { DinsosPath } from "@/lib/dinsos/path-values";

import styles from "./assessment-drawer.module.css";

type OpdOption = {
  id: string;
  name: string;
  allowedPaths: DinsosPath[];
};

export function AssessmentReviewDrawer({
  assessment,
  closeHref,
  detailHref,
  opds,
}: {
  assessment: AssessmentDetail;
  closeHref: string;
  detailHref: string;
  opds: OpdOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedPath, setSelectedPath] = useState<DinsosPath | "">(
    assessment.fieldRecommendation ?? "",
  );
  const allowedOpds = opds.filter(
    (opd) => selectedPath && opd.allowedPaths.includes(selectedPath),
  );

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) router.push(detailHref);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [busy, detailHref, router]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nativeEvent = event.nativeEvent as SubmitEvent;
    const form = new FormData(event.currentTarget, nativeEvent.submitter);
    const decision = String(form.get("decision") ?? "");
    const note = String(form.get("note") ?? "").trim();
    if (decision === "REQUEST_REASSESSMENT" && note.length < 20) {
      setError("Alasan re-asesmen minimal 20 karakter.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/dinsos/assessments/${assessment.assessmentId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            decision === "APPROVED"
              ? {
                  decision,
                  path: form.get("path"),
                  targetOpdId: form.get("targetOpdId"),
                  note,
                }
              : { decision, note },
          ),
        },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Review asesmen gagal disimpan.");
      window.location.assign(detailHref);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Review asesmen gagal disimpan.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.overlay}>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Tutup review asesmen melalui latar belakang"
        onClick={() => !busy && router.push(detailHref)}
      />
      <aside
        className={`${styles.drawer} ${styles.reviewDrawer}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assessment-review-title"
      >
        <header>
          <div>
            <p>Review Asesmen</p>
            <h2 id="assessment-review-title">{assessment.assessmentCode}</h2>
          </div>
          <Link href={detailHref} aria-label="Tutup review asesmen">×</Link>
        </header>
        <form className={styles.reviewForm} onSubmit={submit}>
          <section>
            <h3>Ringkasan Warga</h3>
            <dl className={styles.grid}>
              <div><dt>Nama Warga</dt><dd>{assessment.namaLengkap}</dd></div>
              <div><dt>NIK</dt><dd>{assessment.maskedNik}</dd></div>
              <div><dt>Desil</dt><dd>{assessment.desil ? `Desil ${assessment.desil}` : "—"}</dd></div>
              <div><dt>Kelurahan</dt><dd>{assessment.kelurahan ?? "—"}</dd></div>
            </dl>
          </section>
          <section>
            <h3>Catatan Field Surveyor</h3>
            <p className={styles.longText}>{assessment.observation ?? "Belum ada catatan observasi."}</p>
            <p className={styles.surveyor}>{assessment.createdByName} · {assessment.createdByRole}</p>
          </section>
          <section className={styles.controls}>
            <h3>Keputusan Supervisor / Reviewer</h3>
            <label>
              <span>Tetapkan Jalur MBI *</span>
              <select
                name="path"
                required
                value={selectedPath}
                onChange={(event) =>
                  setSelectedPath(event.target.value as DinsosPath | "")
                }
              >
                <option value="" disabled>Pilih jalur</option>
                <option value="PEKERJA">Pekerja</option>
                <option value="WIRAUSAHA">Wirausaha</option>
                <option value="PENGUATAN_DASAR">Penguatan Dasar</option>
              </select>
            </label>
            <label>
              <span>Rencana OPD Rujukan *</span>
              <select key={selectedPath} name="targetOpdId" required defaultValue="">
                <option value="" disabled>Pilih OPD</option>
                {allowedOpds.map((opd) => <option key={opd.id} value={opd.id}>{opd.name}</option>)}
              </select>
            </label>
            <label>
              <span>Catatan Persetujuan *</span>
              <textarea name="note" minLength={10} maxLength={2000} rows={5} required />
            </label>
          </section>
          {error && <p className={styles.formError} role="alert">{error}</p>}
          <footer>
            <button
              type="submit"
              name="decision"
              value="REQUEST_REASSESSMENT"
              className={styles.reject}
              disabled={busy}
              formNoValidate
            >
              Tolak / Minta Re-Asesmen
            </button>
            <button
              type="submit"
              name="decision"
              value="APPROVED"
              className={styles.primaryButton}
              disabled={busy}
              aria-busy={busy}
            >
              {busy ? "Menyimpan…" : "Setujui & Terbitkan Jalur"}
            </button>
          </footer>
        </form>
        <Link href={closeHref} className={styles.hiddenClose}>Kembali ke daftar</Link>
      </aside>
    </div>
  );
}
