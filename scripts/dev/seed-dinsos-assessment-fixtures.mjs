import { seedDinsosAssessmentFixtures } from "./dinsos-assessment-fixture-lib.mjs";

const state = await seedDinsosAssessmentFixtures();
console.log(`Fixture asesmen Dinsos dibuat: ${Object.keys(state).length} asesmen.`);
