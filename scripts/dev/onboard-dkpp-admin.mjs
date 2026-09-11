import { loadProjectEnvironment } from "../lib/project-env.mjs";
import { onboardOpdAdmin } from "./onboard-opd-admin-lib.mjs";

await loadProjectEnvironment();
await onboardOpdAdmin({
  envPrefix: "DKPP",
  expectedUsername: "admin.dkpp",
  opdCode: "DKPP",
  fullName: "Admin DKPP Kota Bandung",
  institution: "Dinas Ketahanan Pangan dan Pertanian Kota Bandung",
  fallbackPassword: process.env.SUPABASE_TEST_ADMIN_PASSWORD,
});
console.log("Admin DKPP berhasil di-onboard.");
