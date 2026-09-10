import { cleanupDisdikFixtures } from "./disdik-fixture-lib.mjs";

const result = await cleanupDisdikFixtures();
console.log(`Fixture Disdik dibersihkan: ${result.referrals} referral, ${result.programs} program.`);
