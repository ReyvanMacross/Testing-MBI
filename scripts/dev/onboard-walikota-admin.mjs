import { loadProjectEnvironment } from "../lib/project-env.mjs";
import { onboardOpdAdmin } from "./onboard-opd-admin-lib.mjs";

await loadProjectEnvironment();
await onboardOpdAdmin({
  envPrefix: "WALIKOTA",
  expectedUsername: "admin.walikota",
  opdCode: "WALIKOTA",
  expectedRole: "WALIKOTA",
  fullName: "Wali Kota Bandung",
  institution: "Pemerintah Kota Bandung",
  fallbackPassword: process.env.SUPABASE_TEST_ADMIN_PASSWORD,
});
console.log("Akun eksekutif WALIKOTA berhasil di-onboard dan login terverifikasi.");
