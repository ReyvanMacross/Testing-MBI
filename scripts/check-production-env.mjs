import { loadProjectEnvironment } from "./lib/project-env.mjs";

await loadProjectEnvironment();

const production = process.env.NODE_ENV === "production";
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "APP_ORIGIN",
];
const missing = production
  ? required.filter((name) => !process.env[name])
  : [];

for (const name of required) {
  console.log(`${name}: ${process.env[name] ? "configured" : "missing"}`);
}
console.log(`INTEGRATION_ALLOWED_HOSTS: ${process.env.INTEGRATION_ALLOWED_HOSTS ? "configured" : "empty"}`);

if (missing.length > 0) {
  console.error(`Missing production environment variables: ${missing.join(", ")}`);
  process.exitCode = 1;
}

for (const name of ["DISNAKER_PREVIEW_MODE", "DISKOP_PREVIEW_MODE", "DISDIK_PREVIEW_MODE", "DP3A_PREVIEW_MODE", "DISDAGIN_PREVIEW_MODE", "DKPP_PREVIEW_MODE", "DISBUDPAR_PREVIEW_MODE"]) {
  if (production && process.env[name] === "true") {
    console.error(`${name}=true is forbidden in production.`);
    process.exitCode = 1;
  }
}
