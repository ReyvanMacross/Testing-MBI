import { cleanupDiskopFixtures } from "./diskop-fixture-lib.mjs";

const result = await cleanupDiskopFixtures();
console.log(`Fixture Diskop dibersihkan: ${result.referrals} referral, ${result.programs} program.`);
