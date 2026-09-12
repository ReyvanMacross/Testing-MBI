import { loadProjectEnvironment } from "../lib/project-env.mjs";
import { onboardOpdAdmin } from "./onboard-opd-admin-lib.mjs";
await loadProjectEnvironment();
await onboardOpdAdmin({ envPrefix:"BAPPERIDA", expectedUsername:"admin.bapperida", opdCode:"BAPPERIDA", fullName:"Admin Bapperida Kota Bandung", institution:"Badan Perencanaan Pembangunan, Riset dan Inovasi Daerah Kota Bandung", fallbackPassword:process.env.SUPABASE_TEST_ADMIN_PASSWORD });
console.log("Admin BAPPERIDA berhasil di-onboard.");
