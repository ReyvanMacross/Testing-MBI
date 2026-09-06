import { cleanupDinsosPathFixtures } from "./dinsos-path-fixture-lib.mjs";

const removed = await cleanupDinsosPathFixtures();
console.log(`Removed ${removed} Dinsos path fixtures.`);
