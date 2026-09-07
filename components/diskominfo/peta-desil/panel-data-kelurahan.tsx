import Link from "next/link";

import type {
  DesilSourceInfo,
  KelurahanDrilldownItem,
} from "@/lib/diskominfo/desil-map";
import { DESIL_COLORS } from "@/lib/diskominfo/desil-colors";

import styles from "./panel-data-kelurahan.module.css";

type PropertiPanelDataKelurahan = {
  kecamatan: string;
  daftarKelurahan: KelurahanDrilldownItem[];
  wargaBelumTerpetakan: number;
  daftarSumber: DesilSourceInfo[];
  kodeKelurahanTerpilih?: string;
};

export function PanelDataKelurahan({
  kecamatan,
  daftarKelurahan,
  wargaBelumTerpetakan,
  daftarSumber,
  kodeKelurahanTerpilih,
}: PropertiPanelDataKelurahan) {
  const selectedSubdistrict = kodeKelurahanTerpilih
    ? daftarKelurahan.find((item) => item.kode === kodeKelurahanTerpilih)
    : null;

  return (
    <aside className={styles.panel} aria-labelledby="subdistrict-data-title">
      <h2 id="subdistrict-data-title" className={styles.title}>
        Data Kelurahan ({kecamatan})
      </h2>

      {selectedSubdistrict && (
        <section className={styles.selectedSummary} aria-label="Kelurahan terpilih">
          <div>
            <span>Kelurahan terpilih</span>
            <h3>{selectedSubdistrict.nama}</h3>
            <p>{selectedSubdistrict.kode}</p>
          </div>
          <strong>
            {selectedSubdistrict.dominantDesil
              ? `D${selectedSubdistrict.dominantDesil}${
                  selectedSubdistrict.dominantDesil === 5 ? "+" : ""
                }`
              : "Belum ada data"}
          </strong>
        </section>
      )}

      {wargaBelumTerpetakan > 0 && (
        <p className={styles.warning} role="status">
          <strong>{wargaBelumTerpetakan} data warga</strong> pada Kecamatan {kecamatan}{" "}
          belum terpetakan ke kelurahan master yang terverifikasi.
        </p>
      )}

      {daftarSumber.length > 0 && (
        <section className={styles.sources} aria-label="Sumber data desil">
          <strong>Sumber data</strong>
          {daftarSumber.map((source) => (
            <p key={`${source.kind}:${source.url ?? source.label}`}>
              <span>
                {source.kind === "INTERNAL_MBI"
                  ? "Data internal MBI"
                  : `Referensi publik · ${source.period}`}
              </span>
              {source.url ? (
                <a href={source.url} target="_blank" rel="noreferrer">
                  Lihat dokumen resmi
                </a>
              ) : null}
            </p>
          ))}
        </section>
      )}

      <div className={styles.list}>
        {daftarKelurahan.map((item, index) => {
          const hasVerifiedData = item.totalWithDesil > 0;
          const dominantLabel = item.dominantDesil
            ? `D${item.dominantDesil}${item.dominantDesil === 5 ? "+" : ""} Dominan`
            : "BELUM ADA DATA";
          const isSelected = kodeKelurahanTerpilih === item.kode;

          return (
            <article
              className={`${styles.item} ${isSelected ? styles.itemSelected : ""}`}
              key={item.kode}
              aria-current={isSelected ? "true" : undefined}
            >
              <div className={styles.itemHeader}>
                <span className={styles.sequence} aria-hidden="true">
                  {index + 1}
                </span>
                <div className={styles.itemIdentity}>
                  <h3>
                    <Link
                      href={`/diskominfo/peta?kecamatan=${encodeURIComponent(
                        kecamatan,
                      )}&kelurahan=${encodeURIComponent(item.kode)}`}
                    >
                      Kel. {item.nama}
                    </Link>
                  </h3>
                  <span>{item.kode}</span>
                </div>
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
                  <span className={styles.emptyBar} />
                )}
              </div>

              <p className={styles.itemMeta}>
                {getItemMeta(item)}
              </p>
            </article>
          );
        })}
      </div>
    </aside>
  );
}

function getItemMeta(item: KelurahanDrilldownItem) {
  if (item.totalWarga === 0) {
    return "Belum ada sumber Desil 1–5 terverifikasi";
  }

  if (item.source?.kind === "PUBLIC_REFERENCE") {
    return `${item.totalWithDesil.toLocaleString("id-ID")} jiwa · Referensi publik ${item.source.period}`;
  }

  return `${item.totalWithDesil.toLocaleString("id-ID")} dari ${item.totalWarga.toLocaleString("id-ID")} warga memiliki data desil`;
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
