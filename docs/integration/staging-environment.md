# Konfigurasi akun staging integrasi MBI

Git tidak menyimpan `.env.local` atau `.env.test.local`. Karena itu, pull branch hanya membawa kode dan migration; pull tidak membawa kata sandi akun Supabase Auth.

## Menyiapkan environment

Salin template aman, lalu isi nilai rahasia melalui penyimpanan rahasia tim:

```powershell
Copy-Item .env.test.example .env.test.local
```

Jalankan pemeriksaan berikut. Pemeriksaan hanya menampilkan **nama** variabel yang kurang dan tidak pernah mencetak nilainya.

```powershell
npm.cmd run check:integration-env
```

Untuk baseline prototype, akun Kecamatan, DP3A, dan Disdagin memakai `SUPABASE_TEST_ADMIN_PASSWORD` jika password modul atau password E2E tidak diisi. Username bawaannya adalah:

- `admin.kecamatan`
- `admin.dp3a`
- `admin.disdagin`

Jika password khusus modul diisi, nilainya mengambil prioritas. Variabel `E2E_*_PASSWORD` juga boleh dikosongkan karena pengujian akan memakai password admin modul, lalu fallback prototype bersama.

## Menyelaraskan akun hosted staging

Setelah migration tersedia dan `SUPABASE_SECRET_KEY` terisi, jalankan onboarding idempoten:

```powershell
npm.cmd run onboard:integration-actors
```

Perintah tersebut membuat atau memperbarui profil Kecamatan, DP3A, dan Disdagin, menyambungkan `auth_user_id`, lalu memverifikasi login OPD. Untuk Disdagin, `DISDAGIN_ADMIN_PROFILE_ID` bersifat opsional; ID baru dibuat saat profil belum ada.

Validasi lintas instansi dapat dijalankan setelah build dan server tersedia:

```powershell
npm.cmd run test:e2e:integration
```

Jangan menyalin password ke README, issue, commit, atau chat. Bagikan nilai rahasia melalui secret manager tim atau environment CI/staging.
