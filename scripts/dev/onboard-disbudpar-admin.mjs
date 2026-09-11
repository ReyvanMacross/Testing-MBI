import { loadProjectEnvironment } from "../lib/project-env.mjs";
import { onboardOpdAdmin } from "./onboard-opd-admin-lib.mjs";

await loadProjectEnvironment();
await onboardOpdAdmin({
  envPrefix: "DISBUDPAR",
  expectedUsername: "admin.disbudpar",
  opdCode: "DISBUDPAR",
  fullName: "Admin DISBUDPAR Kota Bandung",
  institution: "Dinas Kebudayaan dan Pariwisata Kota Bandung",
  fallbackPassword: process.env.SUPABASE_TEST_ADMIN_PASSWORD,
});
console.log("Admin DISBUDPAR berhasil di-onboard.");
