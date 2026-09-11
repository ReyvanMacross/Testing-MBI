import { loadProjectEnvironment } from "../lib/project-env.mjs";
import { onboardOpdAdmin } from "./onboard-opd-admin-lib.mjs";

await loadProjectEnvironment();
await onboardOpdAdmin({
  envPrefix: "DISDAGIN",
  expectedUsername: "admin.disdagin",
  opdCode: "DISDAGIN",
  fullName: "Admin Disdagin Kota Bandung",
  institution: "Dinas Perdagangan dan Perindustrian Kota Bandung",
});
console.log("Admin Disdagin berhasil di-onboard.");
