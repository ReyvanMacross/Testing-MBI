import { formatActivityDateTime } from "@/lib/diskominfo/activity-log-format";
import type { ActivityLog } from "@/lib/diskominfo/activity-logs";

import styles from "./activity-logs.module.css";

type ActivityLogMobileListProps = {
  logs: ActivityLog[];
  onView: (log: ActivityLog) => void;
  renderStatus: (status: string) => React.ReactNode;
};

export function ActivityLogMobileList({
  logs,
  onView,
  renderStatus,
}: ActivityLogMobileListProps) {
  return (
    <div className={styles.mobileCards}>
      {logs.map((log) => {
        const time = formatActivityDateTime(log.created_at);

        return (
          <article className={styles.logCard} key={log.id}>
            <time className={styles.mobileTime} dateTime={log.created_at}>
              {time.date} • {time.time} WIB
            </time>

            <div className={styles.mobileActorRow}>
              <div>
                <h2>{log.nama_pengguna}</h2>
                <p>{log.role_pengguna}</p>
              </div>
              {renderStatus(log.status)}
            </div>

            <p className={styles.mobileActivity}>{log.aktivitas}</p>
            <p className={styles.mobileModule}>{log.modul}</p>

            <button
              className={styles.mobileDetailButton}
              type="button"
              aria-label={`Lihat detail aktivitas ${log.aktivitas}`}
              onClick={() => onView(log)}
            >
              Lihat Detail
            </button>
          </article>
        );
      })}
    </div>
  );
}
