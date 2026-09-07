import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CaseHero } from "@/components/dinsos/case-hero";
import { CaseTabs } from "@/components/dinsos/case-tabs";
import { PathReferralForm } from "@/components/dinsos/path-referral-form";
import { ReferralAction } from "@/components/dinsos/referral-action";
import referralStyles from "@/components/dinsos/referral.module.css";
import styles from "@/components/dinsos/case.module.css";
import { hasCapability } from "@/lib/auth/require-capability";
import { requireDinsosActor } from "@/lib/auth/require-dinsos-actor";
import { getDinsosCaseById } from "@/lib/dinsos/cases";
import {
  getCasePathContext,
  getPathTargetOptions,
} from "@/lib/dinsos/path-decisions";
import { dinsosPathLabel } from "@/lib/dinsos/path-values";

const dateTime = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function Score({ label, value }: { label: string; value: number | null }) {
  const width = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className={referralStyles.score}>
      <div>
        <span>{label}</span>
        <strong>{value === null ? "Belum dihitung" : `${value}/100`}</strong>
      </div>
      <div
        className={`${referralStyles.scoreTrack} ${value === null ? referralStyles.scoreEmpty : ""}`}
        role="img"
        aria-label={`${label}: ${value === null ? "Belum dihitung" : `${value} dari 100`}`}
      >
        <span style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default async function ReferralPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const actor = await requireDinsosActor();
  const item = await getDinsosCaseById(caseId, actor.profileId);
  if (!item) notFound();
  if (item.result?.status !== "CONFIRMED") {
    redirect(`/dinsos/kasus/${caseId}/hasil`);
  }

  const isStabilization = item.result.disposition === "STABILISASI_SOSIAL";
  const [pathContext, targetOpds, canOverridePath] = isStabilization
    ? [null, [], false]
    : await Promise.all([
        getCasePathContext(caseId),
        getPathTargetOptions(),
        hasCapability(actor.profileId, "DINSOS_PATH_OVERRIDE"),
      ]);

  return (
    <section>
      <div className={styles.breadcrumb}>
        <span>
          Antrian Kerja Harian &nbsp;/&nbsp; Data Warga &nbsp;/&nbsp; Asesmen Sosial
          &nbsp;/&nbsp; Hasil Desil &nbsp;/&nbsp; <strong>Split Jalur &amp; Referral</strong>
        </span>
        <Link className={styles.back} href="/dinsos">← Kembali ke Antrian</Link>
      </div>
      <CaseHero item={item} compact />
      <CaseTabs caseId={caseId} active="referral" assessmentReady resultReady />

      {isStabilization ? (
        <article className={referralStyles.panel}>
          <div>
            <span className={referralStyles.icon}>♢</span>
            {item.referral ? (
              <>
                <h2>Referral Proteksi &amp; Stabilisasi Telah Dikirim</h2>
                <p className={referralStyles.sent}>
                  Status: {String(item.referral.status)} ·{" "}
                  {item.referral.sent_at
                    ? dateTime.format(new Date(String(item.referral.sent_at)))
                    : "Waktu pengiriman belum tersedia"}
                </p>
              </>
            ) : (
              <>
                <h2>Perlu Stabilisasi Terlebih Dahulu</h2>
                <p>
                  Berdasarkan hasil asesmen, warga ini perlu melalui tahap Proteksi
                  dan Stabilisasi sebelum dapat masuk ke Inkubasi Sosial dan menerima
                  referral jalur intervensi.
                </p>
                <ReferralAction caseId={caseId} />
              </>
            )}
          </div>
        </article>
      ) : !pathContext ? (
        <article className={referralStyles.panel}>
          <div>
            <span className={referralStyles.icon}>◇</span>
            <h2>Split Jalur belum dapat diterbitkan</h2>
            <p>Asesmen masih menunggu review supervisor.</p>
          </div>
        </article>
      ) : pathContext.existingReferral ? (
        <section className={referralStyles.published} aria-live="polite">
          <header>
            <span aria-hidden="true">✓</span>
            <div>
              <p>Status Referral</p>
              <h2>{pathContext.existingReferral.status === "MENUNGGU_RUJUKAN" ? "Menunggu Rujukan" : "Referral Terkirim"}</h2>
              {pathContext.existingReferral.sentAt ? <time dateTime={pathContext.existingReferral.sentAt}>
                {dateTime.format(new Date(pathContext.existingReferral.sentAt))}
              </time> : <small>Jalur sudah final dan menunggu proses pengiriman ke OPD.</small>}
            </div>
          </header>
          <dl>
            <div><dt>ID Referral</dt><dd>{pathContext.existingReferral.code}</dd></div>
            <div><dt>Tujuan</dt><dd>{pathContext.existingReferral.targetOpdName}</dd></div>
            <div><dt>Jalur</dt><dd>{dinsosPathLabel(pathContext.existingReferral.path)}</dd></div>
            <div><dt>Jalur Ditetapkan</dt><dd>{pathContext.existingReferral.decisionSource === "MANUAL_OVERRIDE" ? "Override manual berwenang" : "Rekomendasi supervisor"}</dd></div>
            <div className={referralStyles.full}><dt>Catatan</dt><dd>{pathContext.existingReferral.instruction ?? "Tidak ada catatan referral."}</dd></div>
          </dl>
          <Link
            className={referralStyles.trackingLink}
            href={`/dinsos/referral?referral=${pathContext.existingReferral.id}&mode=${pathContext.existingReferral.status === "MENUNGGU_RUJUKAN" ? "process" : "progress"}`}
          >
            {pathContext.existingReferral.status === "MENUNGGU_RUJUKAN" ? "Proses Rujukan" : "Lihat Status di Pelacakan Referral"}
          </Link>
        </section>
      ) : (
        <div className={referralStyles.inkubasiGrid}>
          <article className={referralStyles.analysis}>
            <p className={referralStyles.eyebrow}>Hasil Analisis Jalur</p>
            <h2>Rekomendasi Utama</h2>
            <strong className={referralStyles.pathResult}>
              {dinsosPathLabel(pathContext.approvedPath)}
            </strong>
            <p className={referralStyles.rationale}>{pathContext.reviewerNote}</p>
            {!pathContext.warga.locationResolved && (
              <p className={referralStyles.locationWarning}>
                Wilayah warga belum terhubung ke master wilayah terverifikasi.
              </p>
            )}
            <div className={referralStyles.scores}>
              <Score label="Kesiapan Dasar (Basic Readiness)" value={pathContext.scores.readiness} />
              <Score label="Kesiapan Kerja (Employability)" value={pathContext.scores.employability} />
              <Score label="Kewirausahaan (Entrepreneurship)" value={pathContext.scores.entrepreneurship} />
            </div>
          </article>
          <PathReferralForm
            caseId={caseId}
            approvedPath={pathContext.approvedPath}
            reviewerTargetOpdId={pathContext.reviewerTargetOpdId}
            targetOpds={targetOpds}
            canOverride={canOverridePath}
          />
        </div>
      )}
    </section>
  );
}
