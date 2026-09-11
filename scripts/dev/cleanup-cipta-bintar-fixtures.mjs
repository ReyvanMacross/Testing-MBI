import { cleanupCiptaBintarFixtures } from "./cipta-bintar-fixture-lib.mjs";

const result = await cleanupCiptaBintarFixtures();
console.log(`Fixture CiptaBintar dibersihkan: ${result.referrals} referral, ${result.programs} program.`);
