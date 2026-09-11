import { cleanupDisdaginFixtures } from "./disdagin-fixture-lib.mjs";

const result = await cleanupDisdaginFixtures();
console.log(`Fixture Disdagin dibersihkan: ${result.referrals} referral, ${result.programs} program.`);
