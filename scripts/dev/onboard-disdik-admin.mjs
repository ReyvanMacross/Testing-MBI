import { loadProjectEnvironment } from "../lib/project-env.mjs";
import { onboardOpdAdmin } from "./onboard-opd-admin-lib.mjs";

await loadProjectEnvironment();
await onboardOpdAdmin({
  envPrefix: "DISDIK",
  expectedUsername: "admin.disdik",
  opdCode: "DISDIK",
  fullName: "Admin Disdik Kota Bandung",
  institution: "Dinas Pendidikan Kota Bandung",
});
console.log("Admin Disdik berhasil di-onboard.");
