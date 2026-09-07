import type { DesilLevel } from "@/lib/diskominfo/desil-colors";

export type SumberDataRingkas = {
  kind: "INTERNAL_MBI" | "PUBLIC_REFERENCE";
  period: string;
};

export type DataKecamatanPeta = {
  kecamatan: string;
  totalWarga: number;
  totalWithDesil: number;
  dominantDesil: DesilLevel | null;
  source: SumberDataRingkas | null;
};

export type DataKelurahanPeta = {
  kode: string;
  nama: string;
  dominantDesil: DesilLevel | null;
  totalWarga: number;
  totalWithDesil: number;
  source: SumberDataRingkas | null;
};

export type PosisiLabelKecamatan = {
  nama: string;
  x: number;
  y: number;
  baris: readonly string[];
};
