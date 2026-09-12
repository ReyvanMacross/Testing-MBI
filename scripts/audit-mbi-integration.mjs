import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { PROJECT_ROOT } from "./lib/project-env.mjs";

const baselines = {
  diskominfo: "01977c7b32b010ce5ba19b7dca5e9a76f1758881",
  dinsos: "0f1b92a564cf93bf7714e2e68c45055e37bcc881",
  disnaker: "9b0c502cc4fc5c49430648b4d6adbac6beb27cf3",
  diskop: "e75a761bc1bf04cd8b2e487a7e1f71f7d3009d40",
  disdik: "f32fa8050c904e001832f623e3c1b0395790b65a",
  kecamatan: "96e55163bfae1598dcb29b730e40dfdeebf725b5",
  dp3a: "b36be9f9d4d007116c4f074e904733cba4275a0f",
  disdagin: "5cadabdde950b85343832ee6a4fd7bbd1cc755bf",
  dkpp: "8608ef1c465dbe6b0d91052a1cd5de68e362972e",
  disbudpar: "b0e3dc39b6505b7061beaa100e06e2d6a1b1a2ca",
  ciptaBintar: "f4eec71ba5c81b2928e25f0a1041dd5a24b1c5ee",
};

for (const [module, commit] of Object.entries(baselines)) {
  const result = spawnSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `Baseline ${module} (${commit}) bukan ancestor HEAD.`);
}

const tracked = spawnSync("git", ["ls-files", "-z"], {
  cwd: PROJECT_ROOT,
  encoding: "utf8",
});
assert.equal(tracked.status, 0, "Daftar file Git tidak dapat dibaca.");
for (const file of tracked.stdout.split("\0").filter(Boolean)) {
  let content;
  try {
    content = await readFile(path.join(PROJECT_ROOT, file), "utf8");
  } catch {
    continue;
  }
  if (content.includes("\0")) continue;
  assert.doesNotMatch(content, /^(?:<{7}|={7}|>{7})(?:\s|$)/gmu, `Conflict marker tersisa di ${file}.`);
}

const migrationDirectory = path.join(PROJECT_ROOT, "supabase", "migrations");
const migrationNames = (await readdir(migrationDirectory)).filter((name) => name.endsWith(".sql")).sort();
const migrationSql = (await Promise.all(
  migrationNames.map((name) => readFile(path.join(migrationDirectory, name), "utf8")),
)).join("\n");

for (const table of ["master_opd", "warga", "log_aktivitas", "referral_mbi", "master_program_layanan"]) {
  const pattern = new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}\\b`, "giu");
  assert.equal([...migrationSql.matchAll(pattern)].length, 1, `Shared table ${table} harus memiliki tepat satu definisi awal.`);
}

for (const table of [
  "dinsos_cases",
  "disnaker_interventions",
  "diskop_interventions",
  "disdik_interventions",
  "kecamatan_warga_usulan",
  "dp3a_cases",
  "disdagin_interventions",
  "dkpp_interventions",
  "disbudpar_interventions",
  "cipta_bintar_interventions",
  "bapperida_recommendations",
]) {
  const directRls = new RegExp(
    `alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,
    "iu",
  );
  const dynamicRls = new RegExp(
    `foreach\\s+\\w+\\s+in\\s+array\\s+array\\[[^\\]]*'${table}'[^\\]]*\\]\\s+loop[\\s\\S]{0,500}?alter table public\\.%I enable row level security`,
    "iu",
  );
  assert.ok(directRls.test(migrationSql) || dynamicRls.test(migrationSql), `RLS ${table} tidak ditemukan.`);
}

const requiredFiles = [
  "supabase/audits/dinsos-final-schema-check.sql",
  "supabase/audits/disnaker-final-schema-check.sql",
  "supabase/audits/diskop-final-schema-check.sql",
  "supabase/audits/disdik-final-schema-check.sql",
  "supabase/audits/kecamatan-final-schema-check.sql",
  "supabase/audits/dp3a-final-schema-check.sql",
  "supabase/audits/disdagin-final-schema-check.sql",
  "supabase/audits/dkpp-final-schema-check.sql",
  "supabase/audits/disbudpar-final-schema-check.sql",
  "supabase/audits/cipta-bintar-final-schema-check.sql",
  "supabase/audits/bapperida-final-schema-check.sql",
  "scripts/audit-dinsos-api-guards.mjs",
  "scripts/audit-disnaker-api-guards.mjs",
  "scripts/audit-diskop-api-guards.mjs",
  "scripts/audit-disdik-api-guards.mjs",
  "scripts/audit-kecamatan-api-guards.mjs",
  "scripts/audit-dp3a-api-guards.mjs",
  "scripts/audit-disdagin-api-guards.mjs",
  "scripts/audit-dkpp-api-guards.mjs",
  "scripts/audit-disbudpar-api-guards.mjs",
  "scripts/audit-cipta-bintar-api-guards.mjs",
  "scripts/audit-bapperida-api-guards.mjs",
  "scripts/dev/seed-disdagin-demo.mjs",
  "scripts/dev/seed-dkpp-demo.mjs",
  "scripts/dev/seed-disbudpar-demo.mjs",
  "scripts/dev/seed-cipta-bintar-demo.mjs",
  "scripts/dev/seed-bapperida-demo.mjs",
  "tests/e2e/disdagin.spec.ts",
  "tests/e2e/dkpp.spec.ts",
  "tests/e2e/disbudpar.spec.ts",
  "tests/e2e/cipta-bintar.spec.ts",
  "tests/e2e/bapperida.spec.ts",
  "tests/e2e/kecamatan-dp3a.spec.ts",
  "scripts/dev/seed-staging-warga-demo.mjs",
  "scripts/audit-staging-warga-demo.mjs",
  "docs/integration/warga-data-dependencies.md",
  ".env.test.example",
  "docs/integration/staging-environment.md",
  "scripts/check-integration-env.mjs",
];
for (const file of requiredFiles) {
  assert.ok(tracked.stdout.split("\0").includes(file), `${file} belum tergabung.`);
}

const homeRoutes = await readFile(path.join(PROJECT_ROOT, "lib", "auth", "resolve-home-route.ts"), "utf8");
for (const [opd, route] of [["DINSOS", "/dinsos"], ["DISNAKER", "/disnaker"], ["DISKOP", "/diskop"], ["DISDIK", "/disdik"], ["DP3A", "/dp3a"], ["DISDAGIN", "/disdagin"], ["DKPP", "/dkpp"], ["DISBUDPAR", "/disbudpar"], ["CIPTA_BINTAR", "/cipta-bintar"], ["BAPPERIDA", "/bapperida"]]) {
  assert.ok(homeRoutes.includes(`opdCode === "${opd}"`) && homeRoutes.includes(`return "${route}"`), `Routing ${opd} belum tergabung.`);
}
assert.ok(homeRoutes.includes('profile.role === "Operator Kecamatan"') && homeRoutes.includes('return "/kecamatan"'), "Routing Kecamatan belum tergabung.");

const packageJson = JSON.parse(await readFile(path.join(PROJECT_ROOT, "package.json"), "utf8"));
for (const script of [
  "test-migration-chain",
  "audit:dinsos-api-guards",
  "audit:disnaker-api-guards",
  "audit:diskop-api-guards",
  "audit:disdik-api-guards",
  "audit:kecamatan-api-guards",
  "audit:dp3a-api-guards",
  "test:disdagin-contract",
  "audit:disdagin-api-guards",
  "staging:seed-disdagin-demo",
  "test:dkpp-contract",
  "audit:dkpp-api-guards",
  "staging:seed-dkpp-demo",
  "test:disbudpar-contract",
  "audit:disbudpar-api-guards",
  "staging:seed-disbudpar-demo",
  "test:cipta-bintar-contract",
  "audit:cipta-bintar-api-guards",
  "staging:seed-cipta-bintar-demo",
  "test:bapperida-contract",
  "audit:bapperida-api-guards",
  "staging:seed-bapperida-demo",
  "scan:pii",
  "scan:secrets",
  "check:integration-env",
  "onboard:integration-actors",
]) {
  assert.ok(packageJson.scripts?.[script], `Package script ${script} hilang setelah merge.`);
}
assert.match(
  packageJson.scripts["onboard:integration-actors"],
  /^npm run check:integration-env &&/u,
  "Onboarding aktor integrasi wajib memeriksa kesamaan target Supabase terlebih dahulu.",
);

const environmentTemplate = await readFile(path.join(PROJECT_ROOT, ".env.test.example"), "utf8");
for (const variable of [
  "SUPABASE_TEST_ADMIN_PASSWORD",
  "KECAMATAN_ADMIN_USERNAME",
  "KECAMATAN_ADMIN_PASSWORD",
  "E2E_KECAMATAN_IDENTIFIER",
  "E2E_KECAMATAN_PASSWORD",
  "DP3A_ADMIN_USERNAME",
  "DP3A_ADMIN_PASSWORD",
  "E2E_DP3A_IDENTIFIER",
  "E2E_DP3A_PASSWORD",
  "DISDAGIN_ADMIN_PROFILE_ID",
  "DISDAGIN_ADMIN_USERNAME",
  "DISDAGIN_ADMIN_PASSWORD",
  "E2E_DISDAGIN_IDENTIFIER",
  "E2E_DISDAGIN_PASSWORD",
  "DKPP_ADMIN_PROFILE_ID",
  "DKPP_ADMIN_USERNAME",
  "DKPP_ADMIN_PASSWORD",
  "E2E_DKPP_IDENTIFIER",
  "E2E_DKPP_PASSWORD",
  "DISBUDPAR_ADMIN_PROFILE_ID",
  "DISBUDPAR_ADMIN_USERNAME",
  "DISBUDPAR_ADMIN_PASSWORD",
  "E2E_DISBUDPAR_IDENTIFIER",
  "E2E_DISBUDPAR_PASSWORD",
  "CIPTA_BINTAR_ADMIN_PROFILE_ID",
  "CIPTA_BINTAR_ADMIN_USERNAME",
  "CIPTA_BINTAR_ADMIN_PASSWORD",
  "E2E_CIPTA_BINTAR_IDENTIFIER",
  "E2E_CIPTA_BINTAR_PASSWORD",
  "BAPPERIDA_ADMIN_PROFILE_ID",
  "BAPPERIDA_ADMIN_USERNAME",
  "BAPPERIDA_ADMIN_PASSWORD",
  "E2E_BAPPERIDA_IDENTIFIER",
  "E2E_BAPPERIDA_PASSWORD",
]) {
  assert.match(environmentTemplate, new RegExp(`^${variable}=`, "mu"), `${variable} belum didokumentasikan di template env.`);
}

const productionGuard = await readFile(path.join(PROJECT_ROOT, "scripts", "check-production-env.mjs"), "utf8");
for (const flag of ["DISNAKER_PREVIEW_MODE", "DISKOP_PREVIEW_MODE", "DISDIK_PREVIEW_MODE", "DP3A_PREVIEW_MODE", "DISDAGIN_PREVIEW_MODE", "DKPP_PREVIEW_MODE", "DISBUDPAR_PREVIEW_MODE", "CIPTA_BINTAR_PREVIEW_MODE", "BAPPERIDA_PREVIEW_MODE"]) {
  assert.ok(productionGuard.includes(flag), `Production guard ${flag} hilang.`);
}

console.log(`Audit integrasi MBI: ${Object.keys(baselines).length} baseline, ${migrationNames.length} migration, shared schema, RLS, auth, dan API guard PASS`);
