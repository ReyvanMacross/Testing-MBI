import { loadProjectEnvironment } from "./lib/project-env.mjs";

await loadProjectEnvironment();

const missing = [];
const invalid = [];

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
];

for (const account of accounts) {
  if (!account.defaultIdentifier) requireOne(`${account.label} identifier`, ...account.identifiers);
  requirePassword(`${account.label} password`, 12, ...account.passwords);
}

const profileId = process.env.DISDAGIN_ADMIN_PROFILE_ID?.trim();
if (profileId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(profileId)) {
  invalid.push("DISDAGIN_ADMIN_PROFILE_ID harus berupa UUID jika diisi");
}

if (missing.length || invalid.length) {
  if (missing.length) console.error(`Variabel belum tersedia:\n- ${missing.join("\n- ")}`);
  if (invalid.length) console.error(`Konfigurasi tidak valid:\n- ${invalid.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(`Environment integrasi MBI: ${accounts.length} akun dan konfigurasi Supabase PASS`);
}
