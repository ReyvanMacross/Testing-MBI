import { cleanupKecamatanFixtures } from "./kecamatan-fixture-lib.mjs";

const result = await cleanupKecamatanFixtures();
console.log(`Cleanup Kecamatan PASS: ${result.remaining} fixture tersisa.`);
