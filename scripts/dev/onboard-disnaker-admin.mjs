import { loadProjectEnvironment } from "../lib/project-env.mjs";
import { onboardOpdAdmin } from "./onboard-opd-admin-lib.mjs";

await loadProjectEnvironment();
await onboardOpdAdmin({
  envPrefix: "DISNAKER",
  expectedUsername: "admin.disnaker",
  opdCode: "DISNAKER",
  fullName: "Admin Disnaker Kota Bandung",
  institution: "Dinas Ketenagakerjaan Kota Bandung",
});
console.log("Admin Disnaker berhasil di-onboard.");
