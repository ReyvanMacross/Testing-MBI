"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import type { AssessmentDetail } from "@/lib/dinsos/assessments";

import styles from "./assessment-drawer.module.css";

const date = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTime = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function pathLabel(value: string | null) {
  return value?.replaceAll("_", " ") ?? "—";
}

export function AssessmentDetailDrawer({
  assessment,
  closeHref,
  reviewHref,
  reassessmentHref,
}: {
  assessment: AssessmentDetail;
  closeHref: string;
  reviewHref?: string;
  reassessmentHref?: string;
}) {
  const router = useRouter();
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") router.push(closeHref);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [closeHref, router]);

  return (
    <div className={styles.overlay}>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Tutup detail asesmen melalui latar belakang"
        onClick={() => router.push(closeHref)}
      />
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assessment-detail-title"
      >
        <header>
          <div>
            <p>Detail Asesmen</p>
            <h2 id="assessment-detail-title">{assessment.assessmentCode}</h2>
          </div>
          <Link href={closeHref} aria-label="Tutup detail asesmen">×</Link>
        </header>
        <div className={styles.content}>
          {!assessment.locationResolved && (
            <p className={styles.warning}>Wilayah warga belum terhubung ke master wilayah terverifikasi.</p>
          )}
          <section>
            <h3>Warga</h3>
            <dl className={styles.grid}>
              <div><dt>Nama</dt><dd>{assessment.namaLengkap}</dd></div>
              <div><dt>NIK</dt><dd>{assessment.maskedNik}</dd></div>
              <div><dt>Desil</dt><dd>{assessment.desil ? `Desil ${assessment.desil}` : "—"}</dd></div>
              <div><dt>Kelurahan</dt><dd>{assessment.kelurahan ?? "—"}</dd></div>
            </dl>
          </section>
          <section>
            <h3>Informasi Asesmen</h3>
            <dl className={styles.grid}>
              <div><dt>Status Asesmen</dt><dd><span className={styles.status}>{assessment.status.replaceAll("_", " ")}</span></dd></div>
              <div><dt>Jenis</dt><dd>{assessment.assessmentTypeLabel}</dd></div>
              <div><dt>Petugas Lapangan</dt><dd>{assessment.createdByName}<small>{assessment.createdByRole}</small></dd></div>
              <div><dt>Tanggal Asesmen</dt><dd>{date.format(new Date(`${assessment.assessmentDate}T00:00:00+07:00`))}</dd></div>
            </dl>
          </section>
          <section>
            <h3>Catatan Observasi &amp; Temuan</h3>
            <p className={styles.longText}>{assessment.observation ?? "Belum ada catatan observasi."}</p>
          </section>
          <section>
            <h3>Keputusan Jalur</h3>
            <dl className={styles.grid}>
              <div><dt>Rekomendasi Petugas</dt><dd>{pathLabel(assessment.fieldRecommendation)}</dd></div>
              <div><dt>Jalur Intervensi Disetujui</dt><dd>{pathLabel(assessment.review?.approvedPath ?? null)}</dd></div>
              <div><dt>Rencana Rujukan</dt><dd>{assessment.review?.targetOpd ?? "—"}</dd></div>
              <div><dt>Waktu Review</dt><dd>{assessment.review ? dateTime.format(new Date(assessment.review.reviewedAt)) : "—"}</dd></div>
            </dl>
            {assessment.review && (
              <div className={styles.reviewNote}>
                <strong>{assessment.review.reviewerName}</strong>
                <span>{assessment.review.reviewerRole}</span>
                <p>{assessment.review.note}</p>
              </div>
            )}
          </section>
        </div>
        <footer>
          <Link
            href={`/dinsos/asesmen/${assessment.assessmentId}/print`}
            target="_blank"
            className={styles.secondary}
          >
            Cetak Laporan (PDF)
          </Link>
          {reassessmentHref && <Link href={reassessmentHref} className={styles.secondary}>Buat Re-Asesmen</Link>}
          {reviewHref && <Link href={reviewHref} className={styles.primary}>Review Asesmen</Link>}
        </footer>
      </aside>
    </div>
  );
}
