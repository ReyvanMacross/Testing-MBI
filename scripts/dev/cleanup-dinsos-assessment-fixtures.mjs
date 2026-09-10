import { cleanupDinsosAssessmentFixtures } from "./dinsos-assessment-fixture-lib.mjs";

const count = await cleanupDinsosAssessmentFixtures();
console.log(`Fixture asesmen Dinsos dibersihkan: ${count} asesmen.`);
