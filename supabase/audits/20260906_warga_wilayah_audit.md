# Audit pasangan wilayah warga — 6 September 2026

Query sumber:

```sql
select distinct
  trim(kecamatan) as kecamatan,
  trim(kelurahan) as kelurahan
from public.warga
order by 1, 2;
```

Hasil:

- Total record warga: 153
- Pasangan kecamatan/kelurahan unik: 23
- MATCH: 0
- ALIAS: 0
- UNRESOLVED: 23

Klasifikasi dilakukan pada pasangan kecamatan–kelurahan. Perbedaan kapitalisasi
nama kecamatan dapat dinormalisasi, tetapi pasangan tetap `UNRESOLVED` apabila
kelurahannya tidak berada di bawah kecamatan tersebut.

Tidak ada record `warga` yang diubah. Daftar lengkap terdapat di
`20260906_warga_wilayah_distinct.csv`.

Referensi verifikasi:

- Profil Gender dan Anak Kota Bandung 2022, Tabel 1: Daftar Kecamatan Beserta
  Kelurahan Kota Bandung Tahun 2021, halaman 63–70.
- https://sipaten.bandung.go.id/api/public/uploads/file/profil_gender_dan_anak_kota_bandung_2022-1-2024-05-28234809.pdf
