import { readFile } from "node:fs/promises";
import path from "node:path";

import { loadProjectEnvironment, parseEnvFile, PROJECT_ROOT } from "./lib/project-env.mjs";

await loadProjectEnvironment();

const missing = [];
const invalid = [];
const environmentFiles = [".env.test.local", ".env.local", ".env", ".env.staging.local"];
const fileEnvironments = [];

for (const file of environmentFiles) {
  try {
    fileEnvironments.push({ file, values: parseEnvFile(await readFile(path.join(PROJECT_ROOT, file), "utf8")) });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function assertConsistentVariable(name, normalize = (value) => value) {
  const assignments = fileEnvironments
    .map(({ file, values }) => ({ file, value: values.get(name)?.trim() }))
    .filter(({ value }) => value)
    .map(({ file, value }) => ({ file, value: normalize(value) }));
  if (new Set(assignments.map(({ value }) => value)).size > 1) {
    invalid.push(`${name} berbeda antara ${assignments.map(({ file }) => file).join(", ")}`);
  }
}

function projectRefFromApiUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname.match(/^([a-z0-9-]+)\.supabase\.co$/u)?.[1] ?? null;
  } catch {
    return null;
  }
}

function projectRefFromDatabaseUrl(value) {
  try {
    const parsed = new URL(value);
    const hostRef = parsed.hostname.toLowerCase().match(/^db\.([a-z0-9-]+)\.supabase\.(?:co|com)$/u)?.[1];
    const userRef = decodeURIComponent(parsed.username).toLowerCase().match(/^postgres\.([a-z0-9-]+)$/u)?.[1];
    return hostRef ?? userRef ?? null;
  } catch {
    return null;
  }
}

assertConsistentVariable("NEXT_PUBLIC_SUPABASE_URL", (value) => value.replace(/\/+$/u, ""));
assertConsistentVariable("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
assertConsistentVariable("SUPABASE_SECRET_KEY");
assertConsistentVariable("SUPABASE_DB_URL");

const projectRefs = [];
for (const { file, values } of fileEnvironments) {
  const apiUrl = values.get("NEXT_PUBLIC_SUPABASE_URL")?.trim();
  const databaseUrl = values.get("SUPABASE_DB_URL")?.trim();
  const apiRef = apiUrl ? projectRefFromApiUrl(apiUrl) : null;
  const databaseRef = databaseUrl ? projectRefFromDatabaseUrl(databaseUrl) : null;
  if (apiRef) projectRefs.push({ file, ref: apiRef });
  if (databaseRef) projectRefs.push({ file, ref: databaseRef });
}
if (new Set(projectRefs.map(({ ref }) => ref)).size > 1) {
  invalid.push(`Project Supabase berbeda antara ${[...new Set(projectRefs.map(({ file }) => file))].join(", ")}`);
}

function firstValue(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return { name, value };
  }
  return null;
}

function requireOne(label, ...names) {
  const resolved = firstValue(...names);
  if (!resolved) missing.push(`${label}: ${names.join(" atau ")}`);
  return resolved;
}

function requirePassword(label, minimum, ...names) {
  const resolved = requireOne(label, ...names);
  if (resolved && resolved.value.length < minimum) {
    invalid.push(`${label}: ${resolved.name} minimal ${minimum} karakter`);
  }
}

for (const name of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
]) {
  requireOne("Supabase staging", name);
}

const accounts = [
  { label: "Diskominfo", identifiers: ["E2E_ADMIN_IDENTIFIER", "SUPABASE_TEST_EMAIL"], passwords: ["E2E_ADMIN_PASSWORD", "SUPABASE_TEST_PASSWORD"] },
  { label: "Dinsos", identifiers: ["E2E_DINSOS_IDENTIFIER", "DINSOS_ADMIN_USERNAME"], passwords: ["E2E_DINSOS_PASSWORD", "DINSOS_ADMIN_PASSWORD"] },
  { label: "Disnaker", identifiers: ["E2E_DISNAKER_IDENTIFIER", "DISNAKER_ADMIN_USERNAME"], passwords: ["E2E_DISNAKER_PASSWORD", "DISNAKER_ADMIN_PASSWORD"] },
  { label: "Diskop UKM", identifiers: ["E2E_DISKOP_IDENTIFIER", "DISKOP_ADMIN_USERNAME"], passwords: ["E2E_DISKOP_PASSWORD", "DISKOP_ADMIN_PASSWORD"] },
  { label: "Disdik", identifiers: ["E2E_DISDIK_IDENTIFIER", "DISDIK_ADMIN_USERNAME"], passwords: ["E2E_DISDIK_PASSWORD", "DISDIK_ADMIN_PASSWORD"] },
  { label: "Kecamatan", defaultIdentifier: "admin.kecamatan", identifiers: ["E2E_KECAMATAN_IDENTIFIER", "KECAMATAN_ADMIN_USERNAME"], passwords: ["E2E_KECAMATAN_PASSWORD", "KECAMATAN_ADMIN_PASSWORD", "SUPABASE_TEST_ADMIN_PASSWORD"] },
  { label: "DP3A", defaultIdentifier: "admin.dp3a", identifiers: ["E2E_DP3A_IDENTIFIER", "DP3A_ADMIN_USERNAME"], passwords: ["E2E_DP3A_PASSWORD", "DP3A_ADMIN_PASSWORD", "SUPABASE_TEST_ADMIN_PASSWORD"] },
  { label: "Disdagin", defaultIdentifier: "admin.disdagin", identifiers: ["E2E_DISDAGIN_IDENTIFIER", "DISDAGIN_ADMIN_USERNAME"], passwords: ["E2E_DISDAGIN_PASSWORD", "DISDAGIN_ADMIN_PASSWORD", "SUPABASE_TEST_ADMIN_PASSWORD"] },
  { label: "DKPP", defaultIdentifier: "admin.dkpp", identifiers: ["E2E_DKPP_IDENTIFIER", "DKPP_ADMIN_USERNAME"], passwords: ["E2E_DKPP_PASSWORD", "DKPP_ADMIN_PASSWORD", "SUPABASE_TEST_ADMIN_PASSWORD"] },
  { label: "Disbudpar", defaultIdentifier: "admin.disbudpar", identifiers: ["E2E_DISBUDPAR_IDENTIFIER", "DISBUDPAR_ADMIN_USERNAME"], passwords: ["E2E_DISBUDPAR_PASSWORD", "DISBUDPAR_ADMIN_PASSWORD", "SUPABASE_TEST_ADMIN_PASSWORD"] },
  { label: "Cipta Bintar", defaultIdentifier: "admin.cipta-bintar", identifiers: ["E2E_CIPTA_BINTAR_IDENTIFIER", "CIPTA_BINTAR_ADMIN_USERNAME"], passwords: ["E2E_CIPTA_BINTAR_PASSWORD", "CIPTA_BINTAR_ADMIN_PASSWORD", "SUPABASE_TEST_ADMIN_PASSWORD"] },
  { label: "Bapperida", defaultIdentifier: "admin.bapperida", identifiers: ["E2E_BAPPERIDA_IDENTIFIER", "BAPPERIDA_ADMIN_USERNAME"], passwords: ["E2E_BAPPERIDA_PASSWORD", "BAPPERIDA_ADMIN_PASSWORD", "SUPABASE_TEST_ADMIN_PASSWORD"] },
  { label: "Wali Kota", defaultIdentifier: "admin.walikota", identifiers: ["E2E_WALIKOTA_IDENTIFIER", "WALIKOTA_ADMIN_USERNAME"], passwords: ["E2E_WALIKOTA_PASSWORD", "WALIKOTA_ADMIN_PASSWORD", "SUPABASE_TEST_ADMIN_PASSWORD"] },
  { label: "Kelurahan", defaultIdentifier: "admin.kelurahan", identifiers: ["E2E_KELURAHAN_IDENTIFIER", "KELURAHAN_ADMIN_USERNAME"], passwords: ["E2E_KELURAHAN_PASSWORD", "KELURAHAN_ADMIN_PASSWORD", "SUPABASE_TEST_VILLAGE_PASSWORD", "SUPABASE_TEST_ADMIN_PASSWORD"] },
];

for (const account of accounts) {
  if (!account.defaultIdentifier) requireOne(`${account.label} identifier`, ...account.identifiers);
  requirePassword(`${account.label} password`, 12, ...account.passwords);
}

for (const variable of ["DISDAGIN_ADMIN_PROFILE_ID", "DKPP_ADMIN_PROFILE_ID", "DISBUDPAR_ADMIN_PROFILE_ID", "CIPTA_BINTAR_ADMIN_PROFILE_ID", "BAPPERIDA_ADMIN_PROFILE_ID", "WALIKOTA_ADMIN_PROFILE_ID"]) {
  const profileId = process.env[variable]?.trim();
  if (profileId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(profileId)) {
    invalid.push(`${variable} harus berupa UUID jika diisi`);
  }
}

if (missing.length || invalid.length) {
  if (missing.length) console.error(`Variabel belum tersedia:\n- ${missing.join("\n- ")}`);
  if (invalid.length) console.error(`Konfigurasi tidak valid:\n- ${invalid.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(`Environment integrasi MBI: ${accounts.length} akun dan satu target Supabase PASS`);
}
