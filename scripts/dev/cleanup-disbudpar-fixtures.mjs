import { cleanupDisbudparFixtures } from "./disbudpar-fixture-lib.mjs";

const result = await cleanupDisbudparFixtures();
console.log(`Fixture Disbudpar dibersihkan: ${result.referrals} referral, ${result.programs} program.`);
