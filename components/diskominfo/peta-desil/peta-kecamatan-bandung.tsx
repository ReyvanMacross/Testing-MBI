"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import bentukKecamatan from "@/lib/diskominfo/map-assets/bandung-kecamatan.json";
import { DESIL_COLORS } from "@/lib/diskominfo/desil-colors";
import { normalizeWilayah } from "@/lib/diskominfo/wilayah";

import { InformasiPetaAktif } from "./informasi-peta-aktif";
import {
  BIDANG_PETA_KECAMATAN,
  POSISI_LABEL_KECAMATAN,
} from "./konfigurasi-peta-kecamatan";
import { LegendaDesil } from "./legenda-desil";
import type { DataKecamatanPeta } from "./tipe-peta-desil";
import styles from "./peta-kecamatan-bandung.module.css";

type PropertiPetaKecamatanBandung = {
  daftarKecamatan: DataKecamatanPeta[];
  basePath?: string;
};

export function PetaKecamatanBandung({
  daftarKecamatan,
  basePath = "/diskominfo/peta",
}: PropertiPetaKecamatanBandung) {
  const router = useRouter();
  const [kecamatanAktif, setKecamatanAktif] = useState<string | null>(null);
  const dataMenurutNama = useMemo(
    () =>
      new Map(
        daftarKecamatan.map((kecamatan) => [
          normalizeWilayah(kecamatan.kecamatan),
          kecamatan,
        ]),
      ),
    [daftarKecamatan],
  );
  const dataAktif = kecamatanAktif
    ? dataMenurutNama.get(normalizeWilayah(kecamatanAktif))
    : undefined;

  function bukaKecamatan(nama: string) {
    router.push(`${basePath}?kecamatan=${encodeURIComponent(nama)}`);
  }

  return (
    <div className={styles.kanvasPeta}>
      <InformasiPetaAktif
        judul={kecamatanAktif ?? "30 kecamatan Kota Bandung"}
        keterangan={
          kecamatanAktif
            ? buatKeteranganKecamatan(dataAktif)
            : "Arahkan, fokuskan, atau ketuk wilayah untuk melihat rinciannya."
        }
      />

      <div className={styles.wadahPeta}>
        <div className={styles.bingkaiPeta}>
          <svg
            viewBox="58 322 631 446"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Peta sebaran desil berdasarkan kecamatan di Kota Bandung"
            className={styles.peta}
          >
            <defs>
              <pattern
                id="pola-kecamatan-tanpa-data"
                width="9"
                height="9"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="9" height="9" fill="#edf1f5" />
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="9"
                  stroke="#d0d7e0"
                  strokeWidth="3"
                />
              </pattern>
            </defs>

            {bentukKecamatan.map((wilayah) => {
              const data = dataMenurutNama.get(normalizeWilayah(wilayah.name));
              const desilDominan = data?.dominantDesil ?? null;
              const deskripsi = buatDeskripsiAksesibel(wilayah.name, data);

              return (
                <path
                  key={wilayah.name}
                  d={wilayah.d}
                  fill={
                    desilDominan
                      ? DESIL_COLORS[desilDominan]
                      : "url(#pola-kecamatan-tanpa-data)"
                  }
                  stroke="#111111"
                  strokeWidth={1.5}
                  className={styles.wilayahKecamatan}
                  tabIndex={0}
                  role="link"
                  aria-label={deskripsi}
                  onClick={() => bukaKecamatan(wilayah.name)}
                  onMouseEnter={() => setKecamatanAktif(wilayah.name)}
                  onMouseLeave={() => setKecamatanAktif(null)}
                  onFocus={() => setKecamatanAktif(wilayah.name)}
                  onBlur={() => setKecamatanAktif(null)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      bukaKecamatan(wilayah.name);
                    }
                  }}
                >
                  <title>{deskripsi}</title>
                </path>
              );
            })}
          </svg>

          <div className={styles.lapisanLabel} aria-hidden="true">
            {POSISI_LABEL_KECAMATAN.map((label) => (
              <span
                key={label.nama}
                className={styles.labelKecamatan}
                style={buatPosisiLabel(label.x, label.y)}
                data-label-kecamatan={label.nama}
              >
                {label.baris.map((baris) => (
                  <span key={`${label.nama}-${baris}`}>{baris}</span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </div>

      <LegendaDesil />
    </div>
  );
}

function buatPosisiLabel(x: number, y: number) {
  return {
    left: `${
      ((x - BIDANG_PETA_KECAMATAN.xAwal) / BIDANG_PETA_KECAMATAN.lebar) * 100
    }%`,
    top: `${
      ((y - BIDANG_PETA_KECAMATAN.yAwal) / BIDANG_PETA_KECAMATAN.tinggi) * 100
    }%`,
  };
}

function buatDeskripsiAksesibel(
  nama: string,
  data?: DataKecamatanPeta,
) {
  if (!data?.dominantDesil) {
    return `${nama}, belum ada sumber desil terverifikasi`;
  }

  return `${nama}, dominan Desil ${data.dominantDesil}, ${buatLabelSumber(
    data.source,
  )}`;
}

function buatKeteranganKecamatan(data?: DataKecamatanPeta) {
  if (!data?.dominantDesil) {
    return "Belum ada sumber Desil 1–5 terverifikasi.";
  }

  return `Dominan D${data.dominantDesil}${
    data.dominantDesil === 5 ? "+" : ""
  } · ${data.totalWithDesil.toLocaleString("id-ID")} jiwa · ${buatLabelSumber(
    data.source,
  )}`;
}

function buatLabelSumber(sumber: DataKecamatanPeta["source"]) {
  if (sumber?.kind === "PUBLIC_REFERENCE") {
    return `referensi publik ${sumber.period}`;
  }

  return sumber ? "data internal MBI" : "sumber tidak tersedia";
}
