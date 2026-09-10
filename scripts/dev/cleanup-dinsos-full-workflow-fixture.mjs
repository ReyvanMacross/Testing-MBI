import { cleanupDinsosFullWorkflowFixture } from "./dinsos-full-workflow-fixture-lib.mjs";

const count = await cleanupDinsosFullWorkflowFixture();
console.log(`Fixture alur penuh Dinsos dibersihkan: ${count} kasus.`);
