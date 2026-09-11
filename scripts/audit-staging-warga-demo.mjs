import { auditStagingWargaDemo } from "./dev/staging-warga-demo-lib.mjs";

const result = await auditStagingWargaDemo();
console.log("Audit data warga prototype staging: PASS");
console.log(JSON.stringify(result, null, 2));
