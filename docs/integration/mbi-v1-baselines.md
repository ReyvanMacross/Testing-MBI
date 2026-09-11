# Baseline Integrasi MBI v1

Branch `integration/mbi-v1` adalah source-of-truth pengembangan selama tahap prototype. Branch ini menyatukan sepuluh modul MBI pada satu schema dan satu project Supabase. Branch `main` tetap ditahan sampai seluruh prototype selesai dan integrasi final tervalidasi.

| Modul | Branch asal | Commit baseline | Gate yang dikunci |
| --- | --- | --- | --- |
| Diskominfo | `diskominfo` | `01977c7b32b010ce5ba19b7dca5e9a76f1758881` | Dashboard integrasi, peta desil, integration health, dan activity log. |
| Dinsos | `dinsos` | `0f1b92a564cf93bf7714e2e68c45055e37bcc881` | Workflow kasus, data warga, asesmen, path, referral, dan concurrency. |
| Disnaker | `disnaker` | `9b0c502cc4fc5c49430648b4d6adbac6beb27cf3` | Workflow intervensi, kuota, laporan, API guard, dan concurrency. |
| Diskop UKM | `feat/diskop-ukm-mvp` | `e75a761bc1bf04cd8b2e487a7e1f71f7d3009d40` | Workflow pendampingan, kuota, laporan, API guard, dan concurrency. |
| Disdik | `feat/disdik-mvp` | `f32fa8050c904e001832f623e3c1b0395790b65a` | Workflow pendidikan, kontrak, API guard, RLS, dan E2E. |
| Kecamatan | `feat/kecamatan-mvp` | `96e55163bfae1598dcb29b730e40dfdeebf725b5` | Usulan warga, survei, persetujuan, referral, yurisdiksi, dan concurrency. |
| DP3A | `feat/dp3a-mvp` | `b36be9f9d4d007116c4f074e904733cba4275a0f` | Workflow intervensi, kuota, laporan, API guard, dan concurrency. |
| Disdagin | `feat/disdagin-mvp` | `5cadabdde950b85343832ee6a4fd7bbd1cc755bf` | Workflow usaha, kuota, laporan omzet, API guard, dan concurrency. |
| DKPP | `feat/dkpp-mvp` | `8608ef1c465dbe6b0d91052a1cd5de68e362972e` | Workflow ketahanan pangan, kuota, laporan panen, API guard, dan concurrency. |
| Disbudpar | `feat/disbudpar-mvp` | `b0e3dc39b6505b7061beaa100e06e2d6a1b1a2ca` | Workflow ekonomi kreatif, kuota, laporan pembinaan, API guard, dan concurrency. |

## Kandidat modul berikutnya

Branch `feat/cipta-bintar-mvp` dimulai langsung dari baseline `integration/mbi-v1 @ ace3130420662c5acfad71174adbb989007294f2`. Modul ini memakai kode OPD canonical `CIPTA_BINTAR`, route `/cipta-bintar`, dan tabel domain `cipta_bintar_*`. Commit baseline Cipta Bintar baru ditambahkan ke tabel setelah branch diintegrasikan ke `integration/mbi-v1`.

Gate kandidat mencakup workflow rehabilitasi infrastruktur, kuota program, realisasi anggaran, laporan fisik, transactional RPC, API guard, RLS, concurrency, E2E desktop/mobile, serta verifikasi bahwa fixture pengujian dapat dibersihkan tanpa menghapus data demo persisten.

Validasi lintas modul juga mengunci tanggal bisnis Disdik ke `Asia/Jakarta`, sehingga realisasi progress yang dibuat setelah tengah malam WIB tidak lagi tertolak oleh tanggal UTC database yang masih berada pada hari sebelumnya.

`npm run audit:integration` memastikan semua commit baseline di atas adalah ancestor dari `HEAD`. Audit yang sama membaca migration langsung dari `supabase/migrations`, sehingga jumlah migration tidak disalin secara manual ke dokumen ini.

Fix custom test port dari DP3A `1e13b987699d43a039015286a077301c58daf43e` dipindahkan secara khusus ke jalur integrasi tanpa menggabungkan ulang branch DP3A yang sudah tertinggal. `playwright.config.ts` dan hosted verifier mengambil port dari `MBI_TEST_BASE_URL`, menolak nilai port yang tidak valid, dan memastikan `APP_ORIGIN` memakai origin yang sama.

## Gate integrasi

Validasi source menjalankan:

- ancestor sepuluh baseline, shared schema, urutan migration, RLS, routing auth, production preview guard, dan API guard seluruh OPD;
- kontrak source setiap modul, pemindaian PII dan secret, lint, TypeScript, build, serta audit dependency;
- pemeriksaan bahwa seluruh akun integrasi mengarah ke satu project Supabase.

Validasi hosted menjalankan:

- workflow real database dan concurrency seluruh modul;
- login, home routing, isolasi route, masking NIK, dan E2E integrasi sepuluh akun;
- E2E Kecamatan, DP3A, aliran Kecamatan–DP3A, Disdagin, DKPP, dan Disbudpar;
- audit schema/RLS/RPC lintas OPD dan cleanup fixture dengan data demo persisten tetap tersedia.

Pada branch kandidat Cipta Bintar, rangkaian source dan hosted di atas diperluas dengan kontrak, API guard, schema audit, workflow, concurrency, login/routing akun ke-11, dan E2E Cipta Bintar.

Freeze resmi sepuluh modul menghasilkan 605 pemeriksaan staging tanpa blocker. Validasi kandidat Cipta Bintar memperluas audit menjadi 643 pemeriksaan tanpa blocker, PII 0, secret 0, isolasi 11 akun, dan fixture pengujian tersisa 0. Data demo persisten tetap berjumlah 24 warga.

Status baseline saat ini:

> **HOSTED STAGING VALIDATED — READY FOR NEXT MVP**

Status kandidat Cipta Bintar:

> **11-MODULE CANDIDATE — HOSTED STAGING VALIDATED — READY TO FREEZE**
