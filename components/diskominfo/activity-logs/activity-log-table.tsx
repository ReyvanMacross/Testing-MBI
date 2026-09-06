"use client";

import { useCallback, useState } from "react";

import { formatActivityDateTime } from "@/lib/diskominfo/activity-log-format";
import type { ActivityLog } from "@/lib/diskominfo/activity-logs";

import { ActivityLogDetail } from "./activity-log-detail";
import { ActivityLogMobileList } from "./activity-log-mobile-list";
import styles from "./activity-logs.module.css";

type ActivityLogTableProps = {
  logs: ActivityLog[];
  hasFilters: boolean;
};

function getStatusClass(status: string) {
  switch (status.toUpperCase()) {
    case "BERHASIL":
      return styles.statusSuccess;
    case "GAGAL":
      return styles.statusFailed;
    case "PERINGATAN":
      return styles.statusWarning;
    default:
      return styles.statusNeutral;
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`${styles.statusBadge} ${getStatusClass(status)}`}>
      {status}
    </span>
  );
}

export function ActivityLogTable({ logs, hasFilters }: ActivityLogTableProps) {
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const closeDetail = useCallback(() => setSelectedLog(null), []);
  const renderStatus = useCallback(
    (status: string) => <StatusBadge status={status} />,
    [],
  );

  if (logs.length === 0) {
    return (
      <div className={styles.emptyState}>
        {hasFilters
          ? "Tidak ada aktivitas yang sesuai dengan filter."
          : "Belum ada aktivitas yang tercatat."}
      </div>
    );
  }

  return (
    <>
      <div className={styles.desktopTable}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Waktu</th>
              <th scope="col">Pengguna</th>
              <th scope="col">Aktivitas</th>
              <th scope="col">Modul</th>
              <th scope="col">Status</th>
              <th scope="col">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const time = formatActivityDateTime(log.created_at);

              return (
                <tr key={log.id}>
                  <td>
                    <time className={styles.timeCell} dateTime={log.created_at}>
                      <strong>{time.date}</strong>
                      <span>{time.time} WIB</span>
                    </time>
                  </td>
                  <td>
                    <strong className={styles.actorName}>
                      {log.nama_pengguna}
                    </strong>
                    <span className={styles.actorRole}>{log.role_pengguna}</span>
                  </td>
                  <td className={styles.activityCell}>{log.aktivitas}</td>
                  <td>{log.modul}</td>
                  <td>
                    <StatusBadge status={log.status} />
                  </td>
                  <td>
                    <button
                      className={styles.detailButton}
                      type="button"
                      aria-label={`Lihat detail aktivitas ${log.aktivitas}`}
                      onClick={() => setSelectedLog(log)}
                    >
                      Lihat
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ActivityLogMobileList
        logs={logs}
        onView={setSelectedLog}
        renderStatus={renderStatus}
      />

      <ActivityLogDetail
        log={selectedLog}
        onClose={closeDetail}
        renderStatus={renderStatus}
      />
    </>
  );
}
