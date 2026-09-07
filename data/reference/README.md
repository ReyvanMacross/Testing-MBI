# Referensi wilayah Kota Bandung

`bandung-wilayah.csv` adalah snapshot yang direview untuk seed master wilayah MBI. Kode pada kolom `kode_wilayah` merupakan kode internal stabil dan bukan kode BPS atau Kemendagri.

Daftar 30 kecamatan dan 151 kelurahan disalin dari tabel "Daftar Kecamatan Beserta Kelurahan Kota Bandung Tahun 2021" dalam *Data Gender dan Anak Kota Bandung*, yang diterbitkan Pemerintah Kota Bandung dan mencantumkan BPS Kota Bandung 2022 sebagai sumber. Peraturan Wali Kota Bandung Nomor 28 Tahun 2024 dipakai sebagai rujukan organisasi kecamatan dan kelurahan yang berlaku.

Sumber:

- https://sipaten.bandung.go.id/api/public/uploads/file/profil_gender_dan_anak_kota_bandung_2022-1-2024-05-28234809.pdf
- https://jdih.bandung.go.id/home/produk-hukum/peraturan-perundang-undangan-daerah/23862

Hierarki nama pada CSV mengikuti tabel sumber. Ejaan `Dungus Cariang` dan `Kebon Jeruk` memakai bentuk terkini pada boundary resmi BIG; variasi lain dari dataset operasional harus ditangani melalui `wilayah_alias` setelah diverifikasi, bukan dengan fuzzy matching.

## Boundary kelurahan

`bandung-kelurahan-boundary.raw.geojson` diambil dari layanan resmi Badan Informasi Geospasial, layer `BATAS_DESAKEL_AR` edisi Juni 2026, dengan filter `WADMKK = 'Kota Bandung'`. Snapshot mentah disimpan agar proses normalisasi dapat diaudit dan dijalankan ulang tanpa bergantung pada layanan saat aplikasi berjalan.

- Sumber: https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/BATAS_DESAKEL_AR/MapServer/0

`boundary-name-aliases.json` hanya memuat perbedaan ejaan yang ditemukan antara snapshot BIG dan master Pemkot/BPS. Alias diberi konteks kecamatan dan tidak melakukan fuzzy matching.

## Referensi desil publik 2025

`bandung-public-desil-2025.json` berisi agregat jumlah jiwa Desil 1?5 yang
ditranskripsi dari dokumen resmi Pemerintah Kota Bandung. Data ini digunakan
sebagai referensi peta hanya ketika suatu wilayah belum mempunyai data desil
internal MBI.

Aturan penggunaan:

- Data internal MBI selalu diprioritaskan per wilayah.
- Referensi publik tidak dimasukkan ke tabel `warga` atau `penetapan_desil`.
- Agregat dari periode/sumber berbeda tidak dianggap sebagai cakupan penuh Kota
  Bandung.
- Total DTKS atau indikator kemiskinan lain tidak dikonversi menjadi desil.
- Setiap dataset wajib mempunyai URL sumber, periode referensi, satuan, dan lima
  hitungan desil non-negatif untuk setiap kelurahan.
