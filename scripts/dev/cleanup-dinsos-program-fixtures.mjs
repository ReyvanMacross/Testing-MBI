import { cleanupDinsosProgramFixtures } from "./dinsos-program-fixture-lib.mjs";
console.log(JSON.stringify({ deleted: await cleanupDinsosProgramFixtures() }, null, 2));
