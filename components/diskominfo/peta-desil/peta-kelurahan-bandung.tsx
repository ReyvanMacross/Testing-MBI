"use client";

import { geoMercator, geoPath } from "d3-geo";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson";

import dataBatasWilayah from "@/lib/diskominfo/map-assets/bandung-kelurahan-boundary.json";
import { DESIL_COLORS } from "@/lib/diskominfo/desil-colors";
import { normalizeWilayah } from "@/lib/diskominfo/wilayah";

import { InformasiPetaAktif } from "./informasi-peta-aktif";
import { LegendaDesil } from "./legenda-desil";
import type { DataKelurahanPeta } from "./tipe-peta-desil";
import styles from "./peta-kelurahan-bandung.module.css";

type PropertiBatasWilayah = {
  kode_wilayah: string;
  nama: string;
  kecamatan_kode: string;
  kecamatan: string;
};

type PropertiPetaKelurahanBandung = {
  kecamatan: string;
  daftarKelurahan: DataKelurahanPeta[];
  kodeKelurahanTerpilih?: string;
  basePath?: string;
};

const batasWilayahKota = dataBatasWilayah as unknown as FeatureCollection<
  Geometry,
  PropertiBatasWilayah
>;

export function PetaKelurahanBandung({
  kecamatan,
  daftarKelurahan,
  kodeKelurahanTerpilih,
  basePath = "/diskominfo/peta",
}: PropertiPetaKelurahanBandung) {
  const router = useRouter();
  const [kodeAktif, setKodeAktif] = useState<string | null>(
    kodeKelurahanTerpilih ?? null,
  );
  const daftarBentuk = batasWilayahKota.features
    .filter(
      (bentuk) =>
        normalizeWilayah(bentuk.properties.kecamatan) ===
        normalizeWilayah(kecamatan),
    )
    .map(siapkanBentukUntukD3);

  if (daftarBentuk.length === 0) {
    throw new Error(`Tidak ada geometri untuk Kecamatan ${kecamatan}`);
  }

  const kumpulanBentuk: FeatureCollection<Geometry, PropertiBatasWilayah> = {
    type: "FeatureCollection",
    features: daftarBentuk,
  };
  const proyeksi = geoMercator().fitExtent(
    [
      [24, 24],
      [576, 416],
    ],
    kumpulanBentuk,
  );
  const pembuatJalur = geoPath(proyeksi);
  const dataMenurutKode = new Map(
    daftarKelurahan.map((kelurahan) => [kelurahan.kode, kelurahan]),
  );
  const dataAktif = kodeAktif ? dataMenurutKode.get(kodeAktif) : null;

  function pilihKelurahan(kode: string) {
    router.push(
      `${basePath}?kecamatan=${encodeURIComponent(
        kecamatan,
      )}&kelurahan=${encodeURIComponent(kode)}`,
    );
  }

  return (
    <div className={styles.wadahPeta}>
      <InformasiPetaAktif
        judul={dataAktif ? `Kel. ${dataAktif.nama}` : `${daftarKelurahan.length} kelurahan`}
        keterangan={
          dataAktif
            ? buatKeteranganKelurahan(dataAktif)
            : "Ketuk wilayah untuk menyorot rincian pada daftar."
        }
      />

      <svg
        className={styles.peta}
        viewBox="0 0 600 440"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Peta kelurahan Kecamatan ${kecamatan}`}
      >
        <defs>
          <pattern
            id="pola-kelurahan-tanpa-data"
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="10" height="10" fill="#edf1f5" />
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="10"
              stroke="#d0d7e0"
              strokeWidth="3"
            />
          </pattern>
        </defs>

        {daftarBentuk.map((bentuk) => {
          const kode = bentuk.properties.kode_wilayah;

          return (
            <WilayahKelurahan
              key={kode}
              bentuk={bentuk}
              jalur={pembuatJalur(bentuk) ?? ""}
              data={dataMenurutKode.get(kode)}
              terpilih={kodeKelurahanTerpilih === kode}
              saatDipilih={() => pilihKelurahan(kode)}
              saatAktif={() => setKodeAktif(kode)}
              saatTidakAktif={() => setKodeAktif(kodeKelurahanTerpilih ?? null)}
            />
          );
        })}

        <g className={styles.lapisanLabel} aria-hidden="true">
          {daftarBentuk.map((bentuk) => {
            const [xMentah, yMentah] = pembuatJalur.centroid(bentuk);
            const x = bulatkanKoordinatSvg(xMentah);
            const y = bulatkanKoordinatSvg(yMentah);
            const nama = bentuk.properties.nama;
            const kode = bentuk.properties.kode_wilayah;
            const barisNama = pecahNamaKelurahan(nama);

            return (
              <text
                key={kode}
                x={x}
                y={y - ((barisNama.length - 1) * 7) / 2}
                className={`${styles.labelKelurahan} ${
                  kodeKelurahanTerpilih === kode ? styles.labelTerpilih : ""
                }`}
              >
                {barisNama.map((baris, index) => (
                  <tspan
                    key={`${baris}-${index}`}
                    x={x}
                    dy={index === 0 ? 0 : 14}
                  >
                    {baris}
                  </tspan>
                ))}
              </text>
            );
          })}
        </g>
      </svg>

      <LegendaDesil tampilan="ringkas" />
    </div>
  );
}

function siapkanBentukUntukD3(
  bentuk: Feature<Geometry, PropertiBatasWilayah>,
): Feature<Geometry, PropertiBatasWilayah> {
  if (bentuk.geometry.type === "Polygon") {
    return {
      ...bentuk,
      geometry: {
        ...bentuk.geometry,
        coordinates: arahkanUlangPoligon(bentuk.geometry.coordinates),
      } satisfies Polygon,
    };
  }

  if (bentuk.geometry.type === "MultiPolygon") {
    return {
      ...bentuk,
      geometry: {
        ...bentuk.geometry,
        coordinates: bentuk.geometry.coordinates.map(arahkanUlangPoligon),
      } satisfies MultiPolygon,
    };
  }

  return bentuk;
}

function arahkanUlangPoligon(lingkaran: Position[][]) {
  return lingkaran.map((jalur, index) => {
    const seharusnyaSearahJarumJam = index === 0;
    const searahJarumJam = hitungLuasBertanda(jalur) < 0;

    return seharusnyaSearahJarumJam === searahJarumJam
      ? jalur
      : [...jalur].reverse();
  });
}

function hitungLuasBertanda(jalur: Position[]) {
  let luas = 0;

  for (let index = 0; index < jalur.length - 1; index += 1) {
    const titikSaatIni = jalur[index];
    const titikBerikutnya = jalur[index + 1];

    luas +=
      titikSaatIni[0] * titikBerikutnya[1] -
      titikBerikutnya[0] * titikSaatIni[1];
  }

  return luas / 2;
}

type PropertiWilayahKelurahan = {
  bentuk: Feature<Geometry, PropertiBatasWilayah>;
  jalur: string;
  data?: DataKelurahanPeta;
  terpilih: boolean;
  saatDipilih: () => void;
  saatAktif: () => void;
  saatTidakAktif: () => void;
};

function WilayahKelurahan({
  bentuk,
  jalur,
  data,
  terpilih,
  saatDipilih,
  saatAktif,
  saatTidakAktif,
}: PropertiWilayahKelurahan) {
  const desilDominan = data?.dominantDesil ?? null;
  const deskripsi = desilDominan
    ? `${bentuk.properties.nama}, dominan Desil ${desilDominan}, ${(
        data?.totalWarga ?? 0
      ).toLocaleString("id-ID")} jiwa, ${buatLabelSumber(data?.source ?? null)}`
    : `${bentuk.properties.nama}, belum ada sumber Desil 1–5 terverifikasi`;

  return (
    <path
      d={jalur}
      fill={
        desilDominan
          ? DESIL_COLORS[desilDominan]
          : "url(#pola-kelurahan-tanpa-data)"
      }
      stroke="#111111"
      strokeWidth={1.25}
      vectorEffect="non-scaling-stroke"
      className={`${styles.wilayahKelurahan} ${
        terpilih ? styles.terpilih : ""
      }`}
      tabIndex={0}
      role="button"
      aria-label={deskripsi}
      aria-pressed={terpilih}
      onClick={saatDipilih}
      onMouseEnter={saatAktif}
      onMouseLeave={saatTidakAktif}
      onFocus={saatAktif}
      onBlur={saatTidakAktif}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          saatDipilih();
        }
      }}
    >
      <title>{deskripsi}</title>
    </path>
  );
}

function buatKeteranganKelurahan(data: DataKelurahanPeta) {
  if (!data.dominantDesil) {
    return "Belum ada sumber Desil 1–5 terverifikasi";
  }

  return `Dominan D${data.dominantDesil}${
    data.dominantDesil === 5 ? "+" : ""
  } · ${data.totalWithDesil.toLocaleString("id-ID")} jiwa · ${buatLabelSumber(
    data.source,
  )}`;
}

function buatLabelSumber(sumber: DataKelurahanPeta["source"]) {
  if (sumber?.kind === "PUBLIC_REFERENCE") {
    return `referensi publik ${sumber.period}`;
  }

  return sumber ? "data internal MBI" : "sumber tidak tersedia";
}

function pecahNamaKelurahan(nama: string) {
  return nama.split(" ");
}

function bulatkanKoordinatSvg(nilai: number) {
  return Math.round(nilai * 10) / 10;
}
