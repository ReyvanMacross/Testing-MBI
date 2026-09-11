# Konfigurasi akun staging integrasi MBI

Git tidak menyimpan `.env.local` atau `.env.test.local`. Karena itu, pull branch hanya membawa kode dan migration; pull tidak membawa kata sandi akun Supabase Auth.

## Menyiapkan environment

Salin template aman, lalu isi nilai rahasia melalui penyimpanan rahasia tim:

```powershell
Copy-Item .env.test.example .env.test.local
```

Jalankan pemeriksaan berikut. Pemeriksaan hanya menampilkan **nama** variabel yang kurang dan tidak pernah mencetak nilainya. Pemeriksaan juga memastikan `.env.test.local`, `.env.local`, dan `.env.staging.local` menunjuk satu project Supabase yang sama.

```powershell
npm.cmd run check:integration-env
```

Untuk baseline prototype dan kandidat Cipta Bintar, akun Kecamatan, DP3A, Disdagin, DKPP, Disbudpar, dan Cipta Bintar memakai `SUPABASE_TEST_ADMIN_PASSWORD` jika password modul atau password E2E tidak diisi. Username bawaannya adalah:

- `admin.kecamatan`
- `admin.dp3a`
- `admin.disdagin`
- `admin.dkpp`
- `admin.disbudpar`
- `admin.cipta-bintar`

Jika password khusus modul diisi, nilainya mengambil prioritas. Variabel `E2E_*_PASSWORD` juga boleh dikosongkan karena pengujian akan memakai password admin modul, lalu fallback prototype bersama.

## Menyelaraskan akun hosted staging

Setelah migration tersedia dan `SUPABASE_SECRET_KEY` terisi, jalankan onboarding idempoten:

```powershell
npm.cmd run onboard:integration-actors
```

Perintah tersebut memeriksa target Supabase terlebih dahulu, kemudian membuat atau memperbarui profil Kecamatan, DP3A, Disdagin, DKPP, Disbudpar, dan Cipta Bintar, menyambungkan `auth_user_id`, lalu memverifikasi login OPD. `DISDAGIN_ADMIN_PROFILE_ID`, `DKPP_ADMIN_PROFILE_ID`, `DISBUDPAR_ADMIN_PROFILE_ID`, dan `CIPTA_BINTAR_ADMIN_PROFILE_ID` bersifat opsional; ID baru dibuat saat profil belum ada. Semua akun dan modul memakai `NEXT_PUBLIC_SUPABASE_URL`, publishable key, secret key, serta database URL yang sama.

Validasi lintas instansi dapat dijalankan setelah build dan server tersedia:

```powershell
npm.cmd run test:e2e:integration
```

Jangan menyalin password ke README, issue, commit, atau chat. Bagikan nilai rahasia melalui secret manager tim atau environment CI/staging.
