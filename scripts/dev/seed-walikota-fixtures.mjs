import { seedWalikotaFixtures } from "./walikota-fixture-lib.mjs";
const seeded = await seedWalikotaFixtures();
console.log(`Fixture WALIKOTA siap: ${seeded.recommendationId}`);
