import { cleanupDkppFixtures } from "./dkpp-fixture-lib.mjs";

const result = await cleanupDkppFixtures();
console.log(`Fixture Dkpp dibersihkan: ${result.referrals} referral, ${result.programs} program.`);
