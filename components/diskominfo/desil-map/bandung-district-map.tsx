"use client";

import { useRouter } from "next/navigation";

import areas from "@/lib/diskominfo/map-assets/bandung-kecamatan.json";
import {
  DESIL_COLORS,
  NO_DATA_COLOR,
  type DesilLevel,
} from "@/lib/diskominfo/desil-colors";
import { normalizeWilayah } from "@/lib/diskominfo/wilayah";

import styles from "./bandung-district-map.module.css";

type DistrictMapDatum = {
  kecamatan: string;
  totalWarga: number;
  totalWithDesil: number;
  dominantDesil: DesilLevel | null;
};

type BandungDistrictMapProps = {
  districts: DistrictMapDatum[];
};

const legendItems: Array<{
  label: string;
  color: string;
}> = [
  { label: "D5+", color: DESIL_COLORS[5] },
  { label: "D4", color: DESIL_COLORS[4] },
  { label: "D3", color: DESIL_COLORS[3] },
  { label: "D2", color: DESIL_COLORS[2] },
  { label: "D1", color: DESIL_COLORS[1] },
  { label: "Belum ada data", color: NO_DATA_COLOR },
];

export function BandungDistrictMap({
  districts,
}: BandungDistrictMapProps) {
  const router = useRouter();
  const districtMap = new Map(
    districts.map((district) => [
      normalizeWilayah(district.kecamatan),
      district,
    ]),
  );

  function openDistrict(name: string) {
    router.push(
      `/diskominfo/peta?kecamatan=${encodeURIComponent(name)}`,
    );
  }

  return (
    <div className={styles.mapCanvas}>
      <div className={styles.mapWrapper}>
        <svg
          viewBox="58 322 631 446"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Peta sebaran desil berdasarkan kecamatan di Kota Bandung"
          className={styles.map}
        >
          {areas.map((area) => {
            const district = districtMap.get(
              normalizeWilayah(area.name),
            );
            const dominantDesil = district?.dominantDesil ?? null;
            const fill = dominantDesil
              ? DESIL_COLORS[dominantDesil]
              : NO_DATA_COLOR;
            const description = dominantDesil
              ? `${area.name}, dominan Desil ${dominantDesil}`
              : `${area.name}, belum ada data desil`;

            return (
              <path
                key={area.name}
                d={area.d}
                fill={fill}
                stroke="#111111"
                strokeWidth={1.5}
                className={styles.district}
                tabIndex={0}
                role="link"
                aria-label={description}
                onClick={() => openDistrict(area.name)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openDistrict(area.name);
                  }
                }}
              >
                <title>{description}</title>
              </path>
            );
          })}
        </svg>
      </div>

      <div className={styles.legend} aria-label="Legend desil dominan">
        <p className={styles.legendTitle}>Legend (Desil Dominan)</p>
        <ul className={styles.legendList}>
          {legendItems.map((item) => (
            <li key={item.label}>
              <span
                className={styles.legendSwatch}
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              {item.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
