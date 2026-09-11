import { cleanupStagingWargaDemo } from "./staging-warga-demo-lib.mjs";

const count = await cleanupStagingWargaDemo();
console.log(`Data warga prototype staging dibersihkan: ${count}.`);
