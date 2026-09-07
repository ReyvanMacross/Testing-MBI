import type { DesilBucket } from "@/lib/diskominfo/desil-map";
import { DESIL_COLORS } from "@/lib/diskominfo/desil-colors";

import styles from "./panel-distribusi-kota.module.css";

type PropertiPanelDistribusiKota = {
  distribusi: DesilBucket[];
  totalKecamatan: number;
  kecamatanDenganData: number;
  kecamatanInternal: number;
  kecamatanReferensiPublik: number;
};

const descriptions = {
  1: "Sangat Miskin",
  2: "Miskin",
  3: "Rentan",
} as const;

export function PanelDistribusiKota({
  distribusi,
  totalKecamatan,
  kecamatanDenganData,
  kecamatanInternal,
  kecamatanReferensiPublik,
}: PropertiPanelDistribusiKota) {
  return (
    <aside className={styles.panel} aria-labelledby="city-distribution-title">
      <h2 id="city-distribution-title" className={styles.panelTitle}>
        Persentase Desil (Data Tersedia)
      </h2>

      <p className={styles.panelHint}>
        <span aria-hidden="true">i</span>
        Klik area peta untuk membuka kelurahan pada kecamatan terpilih.
      </p>

      <div className={styles.coverageCard}>
        <div>
          <span>Kecamatan dengan data desil</span>
          <strong>
            {kecamatanDenganData} dari {totalKecamatan}
          </strong>
        </div>
        <div
          className={styles.coverageTrack}
          role="progressbar"
          aria-label="Cakupan kecamatan dengan data desil"
          aria-valuemin={0}
          aria-valuemax={totalKecamatan}
          aria-valuenow={kecamatanDenganData}
        >
          <span
            style={{
              width: `${
                totalKecamatan > 0
                  ? Math.round((kecamatanDenganData / totalKecamatan) * 100)
                  : 0
              }%`,
            }}
          />
        </div>
        <p>
          {kecamatanInternal} kecamatan dari data MBI · {kecamatanReferensiPublik}{" "}
          dari referensi publik. Wilayah berpola belum memiliki sumber Desil
          1–5 yang dapat diverifikasi.
        </p>
      </div>

      <p className={styles.sourceNote}>
        Data internal diprioritaskan per wilayah. Referensi publik dipakai hanya
        ketika data internal belum tersedia, sehingga tidak dihitung ganda.
      </p>

      <div className={styles.distributionList}>
        {distribusi.map((item) => {
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
