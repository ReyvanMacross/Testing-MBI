import { cleanupDisnakerFixtures } from "./disnaker-fixture-lib.mjs";

const result = await cleanupDisnakerFixtures();
console.log(`Fixture Disnaker dibersihkan: ${result.referrals} referral, ${result.programs} program.`);
