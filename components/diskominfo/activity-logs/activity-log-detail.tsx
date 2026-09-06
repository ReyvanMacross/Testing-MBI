"use client";

import { useEffect, useRef } from "react";

import { formatActivityDateTimeLong } from "@/lib/diskominfo/activity-log-format";
import type { ActivityLog } from "@/lib/diskominfo/activity-logs";

import styles from "./activity-logs.module.css";

type ActivityLogDetailProps = {
  log: ActivityLog | null;
  onClose: () => void;
  renderStatus: (status: string) => React.ReactNode;
};

export function ActivityLogDetail({
  log,
  onClose,
  renderStatus,
}: ActivityLogDetailProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!log) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [log, onClose]);

  if (!log) {
    return null;
  }

  const hasMetadata = Object.keys(log.metadata).length > 0;

  return (
    <div
      className={styles.dialogOverlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-detail-title"
      >
        <header className={styles.dialogHeader}>
          <div>
            <h2 id="activity-detail-title">Detail Aktivitas</h2>
            <p>Informasi audit tersimpan dan tidak dapat diedit.</p>
          </div>
          <button
            ref={closeButtonRef}
            className={styles.dialogClose}
            type="button"
            aria-label="Tutup detail aktivitas"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className={styles.dialogBody}>
          <dl className={styles.detailGrid}>
            <div>
              <dt>Waktu</dt>
              <dd>{formatActivityDateTimeLong(log.created_at)} WIB</dd>
            </div>
            <div>
              <dt>Pengguna</dt>
              <dd>{log.nama_pengguna}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{log.role_pengguna}</dd>
            </div>
            <div>
              <dt>Modul</dt>
              <dd>{log.modul}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{renderStatus(log.status)}</dd>
            </div>
            <div>
              <dt>ID Log</dt>
              <dd className={styles.logId}>{log.id}</dd>
            </div>
            <div className={styles.detailFullWidth}>
              <dt>Aktivitas</dt>
              <dd>{log.aktivitas}</dd>
            </div>
          </dl>

          {hasMetadata ? (
            <section className={styles.technicalDetail}>
              <h3>Detail Teknis</h3>
              <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
            </section>
          ) : null}
        </div>
      </section>
    </div>
  );
}
