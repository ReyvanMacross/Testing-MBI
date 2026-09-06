import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintButton, PrintOnLoad } from "@/components/dinsos/print-on-load";
import { assertAssessmentId } from "@/lib/dinsos/assessment-registry-input";
import { getAssessmentById } from "@/lib/dinsos/assessments";

import styles from "./print.module.css";

type Props = { params: Promise<{ assessmentId: string }> };

const date = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { assessmentId } = await params;
  try {
    const assessment = await getAssessmentById(assertAssessmentId(assessmentId));
    return { title: assessment ? `Laporan Asesmen ${assessment.assessmentCode}` : "Laporan Asesmen" };
  } catch {
    return { title: "Laporan Asesmen" };
  }
}

export default async function AssessmentPrintPage({ params }: Props) {
  const { assessmentId: rawAssessmentId } = await params;
  let assessment;
  try {
    assessment = await getAssessmentById(assertAssessmentId(rawAssessmentId));
  } catch {
    notFound();
  }
  if (!assessment) notFound();

  return (
    <article className={styles.report}>
      <PrintOnLoad />
      <div className={styles.actions}>
        <Link href={`/dinsos/asesmen?assessment=${assessment.assessmentId}`}>Kembali</Link>
        <PrintButton />
      </div>
      <div className={styles.reportHeader}>
        <p>Platform MBI · Dinas Sosial Kota Bandung</p>
        <h1>Laporan Asesmen Sosial</h1>
        <strong>{assessment.assessmentCode}</strong>
      </div>
      <section>
        <h2>Identitas Warga</h2>
        <dl>
          <div><dt>Nama</dt><dd>{assessment.namaLengkap}</dd></div>
          <div><dt>NIK</dt><dd>{assessment.maskedNik}</dd></div>
          <div><dt>Kelurahan</dt><dd>{assessment.kelurahan ?? "—"}</dd></div>
          <div><dt>Desil</dt><dd>{assessment.desil ? `Desil ${assessment.desil}` : "—"}</dd></div>
        </dl>
      </section>
      <section>
        <h2>Asesmen</h2>
        <dl>
          <div><dt>Jenis</dt><dd>{assessment.assessmentTypeLabel}</dd></div>
          <div><dt>Tanggal</dt><dd>{date.format(new Date(`${assessment.assessmentDate}T00:00:00+07:00`))}</dd></div>
          <div><dt>Petugas</dt><dd>{assessment.createdByName} · {assessment.createdByRole}</dd></div>
          <div><dt>Status</dt><dd>{assessment.status.replaceAll("_", " ")}</dd></div>
        </dl>
        <h3>Catatan Observasi &amp; Temuan</h3>
        <p className={styles.observation}>{assessment.observation ?? "Belum ada catatan observasi."}</p>
      </section>
      <section>
        <h2>Keputusan Supervisor</h2>
        {assessment.review ? (
          <>
            <dl>
              <div><dt>Keputusan</dt><dd>{assessment.review.decision.replaceAll("_", " ")}</dd></div>
              <div><dt>Jalur Disetujui</dt><dd>{assessment.review.approvedPath?.replaceAll("_", " ") ?? "—"}</dd></div>
              <div><dt>OPD Rujukan</dt><dd>{assessment.review.targetOpd ?? "—"}</dd></div>
              <div><dt>Reviewer</dt><dd>{assessment.review.reviewerName} · {assessment.review.reviewerRole}</dd></div>
            </dl>
            <h3>Catatan Review</h3>
            <p className={styles.observation}>{assessment.review.note}</p>
          </>
        ) : <p>Asesmen belum direview.</p>}
      </section>
    </article>
  );
}
