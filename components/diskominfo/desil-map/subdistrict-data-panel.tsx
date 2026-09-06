import type { KelurahanDrilldownItem } from "@/lib/diskominfo/desil-map";
import { DESIL_COLORS, NO_DATA_COLOR } from "@/lib/diskominfo/desil-colors";

import styles from "./subdistrict-data-panel.module.css";

type SubdistrictDataPanelProps = {
  kecamatan: string;
  kelurahan: KelurahanDrilldownItem[];
  unresolvedWarga: number;
};

export function SubdistrictDataPanel({
  kecamatan,
  kelurahan,
  unresolvedWarga,
}: SubdistrictDataPanelProps) {
  return (
    <aside className={styles.panel} aria-labelledby="subdistrict-data-title">
      <h2 id="subdistrict-data-title" className={styles.title}>
        Data Kelurahan ({kecamatan})
      </h2>

      {unresolvedWarga > 0 && (
        <p className={styles.warning} role="status">
          <strong>{unresolvedWarga} data warga</strong> pada Kecamatan {kecamatan}{" "}
          belum terpetakan ke kelurahan master yang terverifikasi.
        </p>
      )}

      <div className={styles.list}>
        {kelurahan.map((item) => {
          const hasVerifiedData = item.totalWithDesil > 0;
          const dominantLabel = item.dominantDesil
            ? `D${item.dominantDesil}${item.dominantDesil === 5 ? "+" : ""} Dominan`
            : "BELUM ADA DATA";

          return (
            <article className={styles.item} key={item.kode}>
              <div className={styles.itemHeader}>
                <h3>Kel. {item.nama}</h3>
                <span
                  className={
                    hasVerifiedData ? styles.dominantBadge : styles.emptyBadge
                  }
                >
                  {dominantLabel}
                </span>
              </div>

              <div
                className={styles.stackBar}
                role="img"
                aria-label={getDistributionLabel(item)}
              >
                {hasVerifiedData ? (
                  item.distribution
                    .filter((bucket) => bucket.count > 0)
                    .map((bucket) => (
                      <span
                        key={bucket.desil}
                        style={{
                          width: `${bucket.percentage}%`,
                          backgroundColor: DESIL_COLORS[bucket.desil],
                        }}
                        title={`${bucket.label}: ${bucket.count} warga`}
                      />
                    ))
                ) : (
                  <span
                    className={styles.emptyBar}
                    style={{ backgroundColor: NO_DATA_COLOR }}
                  />
                )}
              </div>

              <p className={styles.itemMeta}>
                {item.totalWarga === 0
                  ? "0 warga terverifikasi"
                  : `${item.totalWithDesil} dari ${item.totalWarga} warga memiliki data desil`}
              </p>
            </article>
          );
        })}
      </div>
    </aside>
  );
}

function getDistributionLabel(item: KelurahanDrilldownItem) {
  if (item.totalWithDesil === 0) {
    return `${item.nama}: belum ada data desil terverifikasi`;
  }

  const details = item.distribution
    .map((bucket) => `${bucket.label} ${bucket.count}`)
    .join(", ");

  return `${item.nama}: ${details}`;
}