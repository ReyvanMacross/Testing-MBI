import type { SystemAlert } from "@/lib/diskominfo/dashboard";

import styles from "./system-alerts.module.css";

type SystemAlertsProps = {
  alerts: SystemAlert[];
};

function getSeverityClass(severity: SystemAlert["severity"]) {
  switch (severity) {
    case "CRITICAL":
      return styles.critical;
    case "WARNING":
      return styles.warning;
    default:
      return styles.info;
  }
}

function formatAlertTime(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function SystemAlerts({ alerts }: SystemAlertsProps) {
  return (
    <section className={styles.card} aria-labelledby="system-alerts-title">
      <h2 id="system-alerts-title" className={styles.title}>
        Log Peringatan
      </h2>

      {alerts.length === 0 ? (
        <div className={styles.emptyState}>Tidak ada peringatan aktif.</div>
      ) : (
        <div className={styles.alertList}>
          {alerts.map((alert) => (
            <article
              key={alert.id}
              className={`${styles.alertItem} ${getSeverityClass(alert.severity)}`}
            >
              <div className={styles.alertBody}>
                <p className={styles.alertTitle}>{alert.title}</p>
                <p className={styles.alertMessage}>{alert.message}</p>
                <time
                  className={styles.alertTime}
                  dateTime={alert.occurred_at}
                >
                  {formatAlertTime(alert.occurred_at)}
                </time>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
