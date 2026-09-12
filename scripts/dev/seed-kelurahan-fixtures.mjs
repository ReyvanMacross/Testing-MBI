import { seedKelurahanFixtures } from "./kelurahan-fixture-lib.mjs";
const state=await seedKelurahanFixtures();
console.log(`Fixture Kelurahan siap: ${Object.keys(state.proposals).length} usulan.`);
