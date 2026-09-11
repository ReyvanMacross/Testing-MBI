import { loadProjectEnvironment } from "../lib/project-env.mjs";
import { onboardOpdAdmin } from "./onboard-opd-admin-lib.mjs";

await loadProjectEnvironment();
await onboardOpdAdmin({
  envPrefix: "DISKOP",
  expectedUsername: "admin.diskop",
  opdCode: "DISKOP",
  fullName: "Admin Diskop UKM Kota Bandung",
  institution: "Dinas Koperasi dan UKM Kota Bandung",
});
console.log("Admin Diskop berhasil di-onboard.");
