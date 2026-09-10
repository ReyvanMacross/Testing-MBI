# Baseline Integrasi MBI v1

Branch integrasi `integration/mbi-v1` dibentuk dari baseline Diskominfo, kemudian menggabungkan Dinsos, Disnaker, Diskop UKM, dan Disdik secara berurutan. Baseline ini tidak mengubah fitur modul yang sudah dibekukan.

| Modul | Branch | Commit baseline | Status sebelum integrasi |
| --- | --- | --- | --- |
| Diskominfo | `diskominfo` | `01977c7b32b010ce5ba19b7dca5e9a76f1758881` | Build, lint, migration chain, peta desil, integration health, dan activity log PASS. |
| Dinsos | `dinsos` | `0f1b92a564cf93bf7714e2e68c45055e37bcc881` | Build, workflow, warga, path, API guard, dan migration chain PASS. Fixture lama membutuhkan kompatibilitas hardening dari baseline berikutnya. |
| Disnaker | `disnaker` | `9b0c502cc4fc5c49430648b4d6adbac6beb27cf3` | Workflow real DB, quota/concurrency, API guard, migration chain, dan build PASS. |
| Diskop UKM | `feat/diskop-ukm-mvp` | `e75a761bc1bf04cd8b2e487a7e1f71f7d3009d40` | Workflow real DB, quota/concurrency, API guard, migration chain, build, serta koreksi isolasi fixture Dinsos PASS. |
| Disdik | `feat/disdik-mvp` | `f32fa8050c904e001832f623e3c1b0395790b65a` | Implementasi, kontrak source, API guard, build, dan E2E preview lokal 3/3 PASS. Hosted migration/RLS/RPC belum tervalidasi. |

## Hasil merge berurutan

1. Diskominfo menjadi pangkal branch integrasi.
2. Dinsos digabung tanpa konflik source.
3. Disnaker digabung tanpa konflik source dan tes Dinsos yang terkait referral kembali PASS.
4. Diskop UKM digabung tanpa konflik source dan seluruh regression test Dinsos/Disnaker yang dijalankan PASS.
5. Disdik digabung tanpa konflik source.

Audit ancestor, shared schema, migration order, RLS declaration, routing auth, API guard, production preview guard, PII, dan secret dijalankan melalui `npm run audit:integration`.

Validasi akhir lokal menghasilkan:

- 5 baseline commit menjadi ancestor branch integrasi;
- 30 migration unik dan monotonik;
- build dan TypeScript PASS;
- seluruh API guard Dinsos, Disnaker, Diskop, dan Disdik PASS;
- E2E login, home routing, isolasi route, dan masking NIK untuk 5 akun OPD PASS dengan preview OFF;
- audit hosted untuk integritas domain, privasi, security, dan fixture PASS dengan fixture tersisa 0.

## Batas validasi

E2E integrasi lokal membuktikan login, routing home, isolasi route antar-OPD, rendering modul, dan masking NIK. Alur data tunggal dari Dinsos menuju seluruh OPD serta agregasi hasil di Diskominfo tetap menjadi gate hosted staging.

Hosted database yang terkonfigurasi sudah memiliki tabel Disdik dari migration `202609100001_disdik_workflow_foundation.sql`, tetapi RPC `disdik_start_intervention` dari migration `202609100002_disdik_operational_rpcs.sql` belum tersedia di schema cache (`PGRST202`). Karena itu workflow Disdik real DB dan migration hardening `003` belum boleh dinyatakan tervalidasi. Preview tetap OFF saat pemeriksaan ini; kegagalan schema tidak diganti dengan fallback.

Status yang diizinkan saat ini:

> **LOCAL INTEGRATION VALIDATED — HOSTED STAGING PENDING**
