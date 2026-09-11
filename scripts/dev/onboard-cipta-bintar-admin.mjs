import { loadProjectEnvironment } from "../lib/project-env.mjs";
import { onboardOpdAdmin } from "./onboard-opd-admin-lib.mjs";

await loadProjectEnvironment();
await onboardOpdAdmin({
  envPrefix: "CIPTA_BINTAR",
  expectedUsername: "admin.cipta-bintar",
  opdCode: "CIPTA_BINTAR",
  fullName: "Admin Dinas Cipta Bintar Kota Bandung",
  institution: "Dinas Cipta Karya, Bina Konstruksi dan Tata Ruang Kota Bandung",
  fallbackPassword: process.env.SUPABASE_TEST_ADMIN_PASSWORD,
});
console.log("Admin CIPTA_BINTAR berhasil di-onboard.");
