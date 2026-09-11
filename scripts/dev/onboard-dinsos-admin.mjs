import { loadProjectEnvironment } from "../lib/project-env.mjs";
import { onboardOpdAdmin } from "./onboard-opd-admin-lib.mjs";

await loadProjectEnvironment();
const { admin, profileId } = await onboardOpdAdmin({
  envPrefix: "DINSOS",
  expectedUsername: "admin.dinsos",
  opdCode: "DINSOS",
  fullName: "Admin Dinsos Kota Bandung",
  institution: "Dinas Sosial Kota Bandung",
  preferredEmail: "dinsos@bandung.go.id",
});

const { error: capabilityError } = await admin.from("user_capabilities").upsert([
  { user_id: profileId, capability: "DINSOS_DESIL_OVERRIDE", granted_by: profileId },
  { user_id: profileId, capability: "DINSOS_WARGA_EDIT", granted_by: profileId },
  { user_id: profileId, capability: "DINSOS_ASSESSMENT_REVIEW", granted_by: profileId },
  { user_id: profileId, capability: "DINSOS_PATH_OVERRIDE", granted_by: profileId },
], { onConflict: "user_id,capability" });
if (capabilityError) throw capabilityError;

console.log("Admin Dinsos berhasil di-onboard dan capability Dinsos sudah diberikan.");
