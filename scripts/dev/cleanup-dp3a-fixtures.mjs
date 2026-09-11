import { cleanupDP3AFixtures } from "./dp3a-fixture-lib.mjs";

const result = await cleanupDP3AFixtures();
console.log(`Fixture DP3A dibersihkan: ${result.referrals} referral, ${result.programs} program.`);