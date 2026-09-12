# Baseline Integrasi MBI v1

Branch `integration/mbi-v1` adalah source-of-truth pengembangan selama tahap prototype. Branch ini menyatukan dua belas modul MBI pada satu schema dan satu project Supabase. Branch `main` tetap ditahan sampai seluruh prototype selesai dan integrasi final tervalidasi.

Branch `feat/walikota-mvp` adalah kandidat modul ke-13 yang dibangun langsung dari freeze `7c80a64ecffa37a64a4c3def90f5beab858be4a0`. Baseline resmi tetap 12 modul sampai kandidat ini melalui hosted staging regression dan dikunci pada `integration/mbi-v1`.

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
| Cipta Bintar | `feat/cipta-bintar-mvp` | `f4eec71ba5c81b2928e25f0a1041dd5a24b1c5ee` | Workflow rehabilitasi infrastruktur, kuota, realisasi anggaran, laporan fisik, API guard, dan concurrency. |
| Bapperida | `feat/bapperida-mvp` | `def01f34015934fedc61eac8a4a2d6ffc0592b82` | Dashboard outcome lintas OPD, snapshot evaluasi, rekomendasi kebijakan, shared map, API guard, dan optimistic concurrency. |

## Riwayat migration Disdik

Migration Disdik `202609100002_disdik_operational_rpcs.sql` dipertahankan byte-for-byte seperti saat pertama diterapkan. Perbaikan tanggal bisnis Disdik diterapkan melalui forward migration `202609160006_disdik_bandung_business_date.sql`, yang mengunci tanggal ke `Asia/Jakarta` tanpa mengubah riwayat migration lama.

`npm run audit:integration` memastikan semua commit baseline di atas adalah ancestor dari `HEAD`. Audit yang sama membaca migration langsung dari `supabase/migrations`, sehingga jumlah migration tidak disalin secara manual ke dokumen ini.

Fix custom test port dari DP3A `1e13b987699d43a039015286a077301c58daf43e` dipindahkan secara khusus ke jalur integrasi tanpa menggabungkan ulang branch DP3A yang sudah tertinggal. `playwright.config.ts` dan hosted verifier mengambil port dari `MBI_TEST_BASE_URL`, menolak nilai port yang tidak valid, dan memastikan `APP_ORIGIN` memakai origin yang sama.

## Gate integrasi

Validasi source menjalankan:

- ancestor dua belas baseline, shared schema, urutan migration, RLS, routing auth, production preview guard, dan API guard seluruh OPD;
- kontrak source setiap modul, pemindaian PII dan secret, lint, TypeScript, build, serta audit dependency;
- pemeriksaan bahwa seluruh akun integrasi mengarah ke satu project Supabase.

Validasi hosted menjalankan:

- workflow real database dan concurrency seluruh modul;
- login, home routing, isolasi route, masking NIK, dan E2E integrasi dua belas akun;
- E2E peta Diskominfo, Kecamatan, DP3A, aliran Kecamatan-DP3A, Disdagin, DKPP, Disbudpar, Cipta Bintar, dan Bapperida;
- audit schema/RLS/RPC lintas OPD dan cleanup fixture dengan data demo persisten tetap tersedia.

Freeze resmi dua belas modul menghasilkan 671 pemeriksaan staging tanpa blocker, PII 0, secret 0, isolasi 12 akun, dan fixture pengujian tersisa 0. Data demo persisten tetap berjumlah 24 warga, ditambah snapshot outcome dan rekomendasi Bapperida.

Status baseline saat ini:

> **MBI PROTOTYPE — 12 MODULE BASELINE — HOSTED STAGING VALIDATED**

## Arsitektur Bapperida

Branch `feat/bapperida-mvp` dibangun langsung dari freeze integrasi `2d675062f8ce910a4e1f5305203a79ae01ce8137`. Baseline `def01f34015934fedc61eac8a4a2d6ffc0592b82` menambahkan dashboard outcome lintas OPD, laporan evaluasi, rekomendasi kebijakan dengan optimistic concurrency, dan drill-down peta yang memakai aset Diskominfo.

Bapperida tidak menyalin tabel intervensi OPD. Read model `bapperida_v_cross_opd_outcomes` mengagregasi `referral_mbi`, `warga`, `master_opd`, dan desil terkini; schema `bapperida_*` dibatasi pada target indikator, snapshot evaluasi, rekomendasi, penerima rekomendasi, serta event keputusan.

## Kandidat Wali Kota

Wali Kota adalah lapisan eksekutif read-heavy di atas outcome lintas OPD dan rekomendasi Bapperida. Dashboard membaca view agregasi bersama dan memakai peta Diskominfo. Schema baru dibatasi pada `walikota_decisions`, `walikota_dispositions`, dan `walikota_decision_events`; tidak ada salinan warga, referral, program, atau outcome operasional.

Aktor memakai role `WALIKOTA` dan kode OPD `WALIKOTA`. Mutasi hanya tersedia melalui RPC transaksional untuk menyetujui rekomendasi, meminta revisi, menetapkan prioritas, menyimpan catatan pimpinan, dan menerbitkan disposisi dengan optimistic concurrency.
