import type { CriticalEndpoint } from "@/lib/diskominfo/dashboard";

import styles from "./critical-endpoints-table.module.css";

type CriticalEndpointsTableProps = {
  endpoints: CriticalEndpoint[];
};

function getStatusClass(status: string) {
  switch (status.toUpperCase()) {
    case "ONLINE":
      return styles.statusOnline;
    case "LAMBAT":
      return styles.statusSlow;
    case "OFFLINE":
      return styles.statusOffline;
    default:
      return styles.statusNeutral;
  }
}

export function CriticalEndpointsTable({
  endpoints,
}: CriticalEndpointsTableProps) {
  return (
    <section className={styles.card} aria-labelledby="critical-endpoints-title">
      <h2 id="critical-endpoints-title" className={styles.title}>
        Status Endpoint Kritis
      </h2>

      {endpoints.length === 0 ? (
        <div className={styles.emptyState}>
          Belum ada endpoint kritis yang dikonfigurasi.
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Layanan</th>
                <th scope="col">Instansi</th>
                <th scope="col">Latency</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((endpoint) => (
                <tr key={endpoint.id}>
                  <td>{endpoint.layanan}</td>
                  <td>{endpoint.instansi}</td>
                  <td>
                    {endpoint.latency?.trim() ? endpoint.latency : "—"}
                  </td>
                  <td>
                    <span
                      className={`${styles.statusBadge} ${getStatusClass(endpoint.status)}`}
                    >
                      {endpoint.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
