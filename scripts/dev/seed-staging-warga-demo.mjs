import { seedStagingWargaDemo } from "./staging-warga-demo-lib.mjs";

const result = await seedStagingWargaDemo();
console.log("Data warga prototype staging berhasil disiapkan.");
console.log(JSON.stringify(result, null, 2));
