import type { PosisiLabelKecamatan } from "./tipe-peta-desil";

export const BIDANG_PETA_KECAMATAN = {
  xAwal: 58,
  yAwal: 322,
  lebar: 631,
  tinggi: 446,
} as const;

/**
 * Posisi label mengikuti viewBox peta kecamatan (58 322 631 446).
 * Nama panjang dipecah menjadi dua baris supaya tetap terbaca pada layar kecil.
 */
export const POSISI_LABEL_KECAMATAN: readonly PosisiLabelKecamatan[] = [
  { nama: "Sukasari", x: 189, y: 405, baris: ["Sukasari"] },
  { nama: "Cidadap", x: 262, y: 414, baris: ["Cidadap"] },
  { nama: "Coblong", x: 287, y: 473, baris: ["Coblong"] },
  { nama: "Cibeunying Kaler", x: 343, y: 481, baris: ["Cibeunying", "Kaler"] },
  { nama: "Sukajadi", x: 193, y: 500, baris: ["Sukajadi"] },
  { nama: "Cicendo", x: 164, y: 530, baris: ["Cicendo"] },
  { nama: "Bandung Wetan", x: 295, y: 543, baris: ["Bandung", "Wetan"] },
  { nama: "Cibeunying Kidul", x: 394, y: 521, baris: ["Cibeunying", "Kidul"] },
  { nama: "Mandalajati", x: 469, y: 520, baris: ["Mandalajati"] },
  { nama: "Ujungberung", x: 574, y: 552, baris: ["Ujungberung"] },
  { nama: "Andir", x: 154, y: 566, baris: ["Andir"] },
  { nama: "Sumur Bandung", x: 289, y: 576, baris: ["Sumur", "Bandung"] },
  { nama: "Antapani", x: 431, y: 591, baris: ["Antapani"] },
  { nama: "Arcamanik", x: 490, y: 603, baris: ["Arcamanik"] },
  { nama: "Cibiru", x: 637, y: 584, baris: ["Cibiru"] },
  { nama: "Batununggal", x: 346, y: 617, baris: ["Batununggal"] },
  { nama: "Kiaracondong", x: 401, y: 606, baris: ["Kiara-", "condong"] },
  { nama: "Cinambo", x: 536, y: 626, baris: ["Cinambo"] },
  { nama: "Bandung Kulon", x: 105, y: 633, baris: ["Bandung", "Kulon"] },
  { nama: "Bojongloa Kaler", x: 202, y: 633, baris: ["Bojongloa", "Kaler"] },
  { nama: "Lengkong", x: 307, y: 648, baris: ["Lengkong"] },
  { nama: "Panyileukan", x: 586, y: 641, baris: ["Panyileukan"] },
  { nama: "Astana Anyar", x: 242, y: 659, baris: ["Astana", "Anyar"] },
  { nama: "Regol", x: 276, y: 679, baris: ["Regol"] },
  { nama: "Babakan Ciparay", x: 159, y: 670, baris: ["Babakan", "Ciparay"] },
  { nama: "Bojongloa Kidul", x: 225, y: 699, baris: ["Bojongloa", "Kidul"] },
  { nama: "Buahbatu", x: 416, y: 690, baris: ["Buahbatu"] },
  { nama: "Rancasari", x: 472, y: 708, baris: ["Rancasari"] },
  { nama: "Gedebage", x: 554, y: 706, baris: ["Gedebage"] },
  { nama: "Bandung Kidul", x: 331, y: 719, baris: ["Bandung", "Kidul"] },
] as const;
