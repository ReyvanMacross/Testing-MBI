import { seedDinsosFullWorkflowFixture } from "./dinsos-full-workflow-fixture-lib.mjs";

const state = await seedDinsosFullWorkflowFixture();
console.log(`Fixture alur penuh Dinsos dibuat: ${state.high.caseId}, ${state.low.caseId}`);
