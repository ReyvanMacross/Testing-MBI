import { seedDinsosFixtures } from "./dinsos-fixture-lib.mjs";
const state=await seedDinsosFixtures();
console.log(`Fixture Dinsos dibuat: ${Object.keys(state).length} kasus.`);
