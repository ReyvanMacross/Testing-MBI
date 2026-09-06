import type { IntegrationListItem } from "@/lib/diskominfo/integrations";

import styles from "./integrations.module.css";

type Props = {
  integrations: IntegrationListItem[];
  hasFilters: boolean;
  onDetail: (item: IntegrationListItem) => void;
  onEdit: (item: IntegrationListItem) => void;
  onTest: (item: IntegrationListItem) => void;
  testingId: string | null;
};

export function statusLabel(status: IntegrationListItem["status"]) {
  return status === "BELUM_DITEST" ? "BELUM DITES" : status;
}

export function statusClass(status: IntegrationListItem["status"]) {
  if (status === "ONLINE") return styles.statusOnline;
  if (status === "LAMBAT") return styles.statusSlow;
  if (status === "OFFLINE") return styles.statusOffline;
  return styles.statusUntested;
}

function formatDate(value: string | null) {
  if (!value) return "Belum pernah";
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function ActionButtons({ item, onDetail, onEdit, onTest, testingId }: Omit<Props, "integrations" | "hasFilters"> & { item: IntegrationListItem }) {
  return (
    <div className={styles.rowActions}>
      <button type="button" onClick={() => onTest(item)} disabled={!item.endpointUrl || testingId === item.id} aria-label={`Uji koneksi ${item.layanan}`}>
        {testingId === item.id ? "Menguji..." : "Uji Koneksi"}
      </button>
      <button type="button" onClick={() => onDetail(item)} aria-label={`Lihat detail ${item.layanan}`}>Detail</button>
      <button type="button" onClick={() => onEdit(item)} aria-label={`Edit ${item.layanan}`}>Edit</button>
    </div>
  );
}

export function IntegrationTable(props: Props) {
  const { integrations, hasFilters } = props;
  if (!integrations.length) {
    return <div className={styles.emptyState}>{hasFilters ? "Tidak ada integrasi yang sesuai dengan filter." : "Belum ada integrasi API."}</div>;
  }
  return (
    <>
      <div className={styles.desktopTable}>
        <table className={styles.table}>
          <thead><tr><th scope="col">Layanan</th><th scope="col">Instansi / OPD</th><th scope="col">Endpoint</th><th scope="col">Latency</th><th scope="col">Status</th><th scope="col">Terakhir Dicek</th><th scope="col">Aksi</th></tr></thead>
          <tbody>{integrations.map((item) => (
            <tr key={item.id}>
              <td><strong className={styles.serviceName}>{item.layanan}</strong>{item.isCritical ? <span className={styles.criticalBadge}>KRITIS</span> : null}</td>
              <td>{item.opdNama ?? item.instansi}<small>{item.opdNama ? item.instansi : "Sumber eksternal"}</small></td>
              <td><span className={styles.endpoint} title={item.endpointUrl ?? "Endpoint belum dikonfigurasi"}>{item.endpointUrl ?? "Belum dikonfigurasi"}</span></td>
              <td>{item.latencyMs === null ? "—" : `${item.latencyMs}ms`}</td>
              <td><span className={`${styles.statusBadge} ${statusClass(item.status)}`}>{statusLabel(item.status)}</span></td>
              <td>{formatDate(item.lastTestAt)}</td>
              <td><ActionButtons item={item} {...props} /></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className={styles.mobileCards}>
        {integrations.map((item) => (
          <article className={styles.integrationCard} key={item.id}>
            <div className={styles.cardHeading}><div><h2>{item.layanan}</h2><p>{item.opdNama ?? item.instansi}</p></div><span className={`${styles.statusBadge} ${statusClass(item.status)}`}>{statusLabel(item.status)}</span></div>
            {item.isCritical ? <span className={styles.criticalBadge}>ENDPOINT KRITIS</span> : null}
            <dl><div><dt>Latency</dt><dd>{item.latencyMs === null ? "—" : `${item.latencyMs}ms`}</dd></div><div><dt>Terakhir cek</dt><dd>{formatDate(item.lastTestAt)}</dd></div><div><dt>Endpoint</dt><dd className={styles.endpoint}>{item.endpointUrl ?? "Belum dikonfigurasi"}</dd></div></dl>
            <ActionButtons item={item} {...props} />
          </article>
        ))}
      </div>
    </>
  );
}
