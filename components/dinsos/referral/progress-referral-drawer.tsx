"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useFokusDialog } from "@/components/dinsos/shared/use-fokus-dialog";
import type { ReferralTimelineItem } from "@/lib/dinsos/referral-progress";
import { dinsosPathLabel, type DinsosPath } from "@/lib/dinsos/path-values";

import styles from "./referral-registry.module.css";

const dateTime = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
});
const date = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric" });

export function ReferralProgressDrawer({ progress, closeHref }: {
  progress: {
    referralId: string; referralCode: string; warga: { nama: string; maskedNik: string };
    targetOpd: string; jalur: DinsosPath; program: string | null; status: string;
    timeline: ReferralTimelineItem[];
  };
  closeHref: string;
}) {
  const router = useRouter();
  const dialogRef = useFokusDialog<HTMLElement>();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") router.push(closeHref); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeHref, router]);
  return (
    <div className={styles.overlay}>
      <button className={styles.backdrop} type="button" aria-label="Tutup pelacakan referral" onClick={() => router.push(closeHref)} />
      <aside ref={dialogRef} tabIndex={-1} className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="progress-title">
        <header className={styles.dialogHeader}>
          <h2 id="progress-title">Lacak Progress Referral — {progress.referralCode}</h2>
          <Link href={closeHref} aria-label="Tutup pelacakan referral">×</Link>
        </header>
        <div className={styles.dialogContent}>
          <dl className={styles.progressSummary}>
            <div><dt>Nama Warga</dt><dd>{progress.warga.nama}</dd></div>
            <div><dt>NIK</dt><dd>{progress.warga.maskedNik}</dd></div>
            <div><dt>OPD Rujukan</dt><dd>{progress.targetOpd}</dd></div>
            <div><dt>Jalur MBI</dt><dd>{dinsosPathLabel(progress.jalur)}</dd></div>
            <div><dt>Program</dt><dd>{progress.program ?? "Belum ditentukan"}</dd></div>
            <div><dt>Status</dt><dd><span className={styles.statusBadge}>{progress.status.replaceAll("_", " ")}</span></dd></div>
          </dl>
          <section className={styles.timelineSection}>
            <h3>Timeline Referral</h3>
            {progress.timeline.length ? <ol className={styles.timeline}>{progress.timeline.map((event, index) => (
              <li key={`${event.type}-${event.happenedAt}-${index}`} aria-current={index === progress.timeline.length - 1 ? "step" : undefined}>
                <span aria-hidden="true" /><div><strong>{event.title}</strong><time dateTime={event.happenedAt}>{dateTime.format(new Date(event.happenedAt))}</time>{event.targetDate && <small>Target: {date.format(new Date(`${event.targetDate}T00:00:00+07:00`))}</small>}</div>
              </li>
            ))}</ol> : <p>Belum ada event referral.</p>}
          </section>
          <Link className={styles.printButton} href={`/dinsos/referral/${progress.referralId}/print`} target="_blank">Cetak Surat Rujukan</Link>
        </div>
      </aside>
    </div>
  );
}
