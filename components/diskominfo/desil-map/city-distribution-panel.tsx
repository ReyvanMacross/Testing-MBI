import type { DesilBucket } from "@/lib/diskominfo/desil-map";
import { DESIL_COLORS } from "@/lib/diskominfo/desil-colors";

import styles from "./desil-map.module.css";

type CityDistributionPanelProps = {
  distribution: DesilBucket[];
};

const descriptions = {
  1: "Sangat Miskin",
  2: "Miskin",
  3: "Rentan",
} as const;

export function CityDistributionPanel({
  distribution,
}: CityDistributionPanelProps) {
  return (
    <aside className={styles.panel} aria-labelledby="city-distribution-title">
      <h2 id="city-distribution-title" className={styles.panelTitle}>
        Persentase Desil (Kota Bandung)
      </h2>

      <p className={styles.panelHint}>
        <span aria-hidden="true">i</span>
        Klik area map untuk rincian per kecamatan.
      </p>

      <div className={styles.distributionList}>
        {distribution.map((item) => {
          const description =
            item.desil in descriptions
              ? descriptions[item.desil as keyof typeof descriptions]
              : null;
          const label = `${item.label}${description ? ` (${description})` : ""}`;

          return (
            <div className={styles.distributionItem} key={item.desil}>
              <div className={styles.distributionMeta}>
                <span>{label}</span>
                <strong>{item.percentage}%</strong>
              </div>

              <div
                className={styles.progressTrack}
                role="progressbar"
                aria-label={label}
                aria-valuenow={item.percentage}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span
                  className={styles.progressFill}
                  style={{
                    width: `${item.percentage}%`,
                    backgroundColor: DESIL_COLORS[item.desil],
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
