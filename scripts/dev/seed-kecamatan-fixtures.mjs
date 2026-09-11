import { seedKecamatanFixtures } from "./kecamatan-fixture-lib.mjs";

const state = await seedKecamatanFixtures();
console.log(`Fixture Kecamatan siap: ${Object.keys(state.citizens).length} warga sintetis.`);
