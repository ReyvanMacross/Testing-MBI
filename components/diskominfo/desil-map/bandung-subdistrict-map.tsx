"use client";

import { geoMercator, geoPath } from "d3-geo";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson";

import boundaryData from "@/lib/diskominfo/map-assets/bandung-kelurahan-boundary.json";
import {
  DESIL_COLORS,
  NO_DATA_COLOR,
  type DesilLevel,
} from "@/lib/diskominfo/desil-colors";
import { normalizeWilayah } from "@/lib/diskominfo/wilayah";

import styles from "./bandung-subdistrict-map.module.css";

type BoundaryProperties = {
  kode_wilayah: string;
  nama: string;
  kecamatan_kode: string;
  kecamatan: string;
};

type SubdistrictDatum = {
  kode: string;
  nama: string;
  dominantDesil: DesilLevel | null;
  totalWarga: number;
};

type BandungSubdistrictMapProps = {
  kecamatan: string;
  kelurahan: SubdistrictDatum[];
};

const canonicalBoundary = boundaryData as unknown as FeatureCollection<
  Geometry,
  BoundaryProperties
>;

export function BandungSubdistrictMap({
  kecamatan,
  kelurahan,
}: BandungSubdistrictMapProps) {
  const features = canonicalBoundary.features.filter(
    (feature) =>
      normalizeWilayah(feature.properties.kecamatan) ===
      normalizeWilayah(kecamatan),
  ).map(prepareFeatureForD3);

  if (features.length === 0) {
    throw new Error(`Tidak ada geometry untuk kecamatan ${kecamatan}`);
  }

  const featureCollection: FeatureCollection<Geometry, BoundaryProperties> = {
    type: "FeatureCollection",
    features,
  };
  const projection = geoMercator().fitExtent(
    [
      [24, 24],
      [576, 416],
    ],
    featureCollection,
  );
  const pathGenerator = geoPath(projection);
  const dataMap = new Map(kelurahan.map((item) => [item.kode, item]));

  return (
    <div className={styles.mapWrapper}>
      <svg
        className={styles.map}
        viewBox="0 0 600 440"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Peta kelurahan Kecamatan ${kecamatan}`}
      >
        {features.map((feature) => (
          <SubdistrictPath
            key={feature.properties.kode_wilayah}
            feature={feature}
            pathData={pathGenerator(feature) ?? ""}
            datum={dataMap.get(feature.properties.kode_wilayah)}
          />
        ))}
      </svg>
    </div>
  );
}

function prepareFeatureForD3(
  feature: Feature<Geometry, BoundaryProperties>,
): Feature<Geometry, BoundaryProperties> {
  if (feature.geometry.type === "Polygon") {
    return {
      ...feature,
      geometry: {
        ...feature.geometry,
        coordinates: rewindPolygon(feature.geometry.coordinates),
      } satisfies Polygon,
    };
  }

  if (feature.geometry.type === "MultiPolygon") {
    return {
      ...feature,
      geometry: {
        ...feature.geometry,
        coordinates: feature.geometry.coordinates.map(rewindPolygon),
      } satisfies MultiPolygon,
    };
  }

  return feature;
}

function rewindPolygon(rings: Position[][]) {
  return rings.map((ring, index) => {
    const shouldBeClockwise = index === 0;
    const isClockwise = getSignedArea(ring) < 0;

    return shouldBeClockwise === isClockwise ? ring : [...ring].reverse();
  });
}

function getSignedArea(ring: Position[]) {
  let area = 0;

  for (let index = 0; index < ring.length - 1; index += 1) {
    const current = ring[index];
    const next = ring[index + 1];

    area += current[0] * next[1] - next[0] * current[1];
  }

  return area / 2;
}

type SubdistrictPathProps = {
  feature: Feature<Geometry, BoundaryProperties>;
  pathData: string;
  datum?: SubdistrictDatum;
};

function SubdistrictPath({
  feature,
  pathData,
  datum,
}: SubdistrictPathProps) {
  const dominant = datum?.dominantDesil ?? null;
  const fill = dominant ? DESIL_COLORS[dominant] : NO_DATA_COLOR;
  const description = dominant
    ? `${feature.properties.nama}, dominan Desil ${dominant}, ${datum?.totalWarga ?? 0} warga terverifikasi`
    : `${feature.properties.nama}, belum ada data terverifikasi`;

  return (
    <path
      d={pathData}
      fill={fill}
      stroke="#111111"
      strokeWidth={1.25}
      vectorEffect="non-scaling-stroke"
      className={styles.subdistrict}
      tabIndex={0}
      role="img"
      aria-label={description}
    >
      <title>{description}</title>
    </path>
  );
}
