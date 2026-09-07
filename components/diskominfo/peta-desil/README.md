# Komponen Peta Desil

Folder ini hanya berisi komponen tampilan peta. Pengambilan dan penggabungan
data tetap berada di `lib/diskominfo/desil-map.ts` agar komponen tidak mengakses
Supabase secara langsung dari browser.

## Susunan komponen

- `penjelajah-peta-desil.tsx`: memilih tampilan Kota Bandung atau drill-down kecamatan.
- `peta-kecamatan-bandung.tsx`: peta 30 kecamatan dan interaksi pilih kecamatan.
- `konfigurasi-peta-kecamatan.ts`: posisi serta pemenggalan nama kecamatan.
- `peta-kelurahan-bandung.tsx`: peta kelurahan dalam kecamatan terpilih.
- `panel-distribusi-kota.tsx`: cakupan sumber dan persentase desil kota.
- `panel-data-kelurahan.tsx`: daftar kelurahan, distribusi, dan sumber data.
- `legenda-desil.tsx`: legenda warna bersama untuk kedua tingkat peta.
- `informasi-peta-aktif.tsx`: keterangan wilayah ketika diarahkan atau difokuskan.
- `tipe-peta-desil.ts`: tipe data aman yang dipakai komponen client.

## Cara revisi

- Ubah posisi atau pemenggalan nama kecamatan di `konfigurasi-peta-kecamatan.ts`.
- Ubah warna desil pada `lib/diskominfo/desil-colors.ts`.
- Tambahkan referensi publik tervalidasi pada `data/reference/bandung-public-desil-2025.json`.
- Jangan mengisi wilayah abu-abu dari total DTKS/DTSEN jika sumber tidak menyediakan
  rincian Desil 1–5.
