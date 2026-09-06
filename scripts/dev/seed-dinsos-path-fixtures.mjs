import { seedDinsosPathFixtures } from "./dinsos-path-fixture-lib.mjs";

const state = await seedDinsosPathFixtures();
console.log(`Seeded ${Object.keys(state).length} Dinsos path fixtures.`);
