import { cleanupDinsosFixtures } from "./dinsos-fixture-lib.mjs";
const count=await cleanupDinsosFixtures();
console.log(`Fixture Dinsos dibersihkan: ${count} kasus.`);
