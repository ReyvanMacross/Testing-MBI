# Platform MBI — Diskominfo Kota Bandung

## Menjalankan project

Dari folder project, pasang dependency lalu jalankan aplikasi:

```powershell
npm.cmd ci
npm.cmd run dev
```

Buka http://localhost:3000/login.

Konfigurasi lokal dan akun staging tidak disimpan di Git. Salin `.env.test.example` menjadi `.env.test.local`, isi secret melalui penyimpanan rahasia tim, lalu periksa konfigurasinya:

```powershell
Copy-Item .env.test.example .env.test.local
npm.cmd run check:integration-env
```

Petunjuk akun Kecamatan, DP3A, Disdagin, DKPP, Disbudpar, Cipta Bintar, dan onboarding hosted staging tersedia di [docs/integration/staging-environment.md](docs/integration/staging-environment.md).

## Cakupan aplikasi

- Layout desktop 50:50, form maksimal 420 px, font Inter, dan tombol utama `#134B9E`.
- Panel kiri memakai aset placeholder asli dari Figma, disimpan di `public/images/login-panel.png`.
- Pada layar sampai 900 px, panel kiri disembunyikan dan form dipusatkan.
- Tombol mata menampilkan/menyembunyikan kata sandi tanpa mengubah nilainya.
- Form login memakai Supabase Auth dan mengarahkan pengguna berdasarkan role serta OPD.
- Baseline integrasi mencakup:
  - Diskominfo
  - Dinsos
  - Disnaker
  - Diskop UKM
  - Disdik
  - Kecamatan
  - DP3A
  - Disdagin
  - DKPP
  - Disbudpar
  - Cipta Bintar
- Baseline resmi sebelas modul mencakup Dinas Cipta Bintar dengan kode OPD canonical `CIPTA_BINTAR`, route `/cipta-bintar`, dan schema `cipta_bintar_*`.
- Selama tahap prototype, source-of-truth pengembangan adalah branch `integration/mbi-v1`. Branch `main` diperbarui setelah seluruh prototype selesai dan baseline final tervalidasi.
- Data warga menggunakan tabel bersama `warga`; tabel domain OPD hanya menyimpan data proses dan layanan khusus.

## Pemeriksaan

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run verify:integration-source
```
