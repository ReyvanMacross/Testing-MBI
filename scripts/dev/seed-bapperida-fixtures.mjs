import { seedBapperidaFixtures } from "./bapperida-fixture-lib.mjs";
const seeded=await seedBapperidaFixtures();console.log(`Fixture BAPPERIDA siap: ${seeded.recommendationId}`);
