import { seedDinsosProgramFixtures } from "./dinsos-program-fixture-lib.mjs";
console.log(JSON.stringify(await seedDinsosProgramFixtures(), null, 2));
